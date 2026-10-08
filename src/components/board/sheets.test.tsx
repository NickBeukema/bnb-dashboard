import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LAKE_BREEZE, day, makeStay, makeTask } from "../../../test/board-fixtures";
import type { BoardTask, Stay } from "./model";
import { AllTasksSheet, StaySheet } from "./sheets";

const today = day(7);

function renderStaySheet(stay: Stay | null, tasks: BoardTask[] = []) {
  const onClose = vi.fn();
  const onCompleteTask = vi.fn();
  render(
    <StaySheet
      stay={stay}
      today={today}
      tasks={tasks}
      onClose={onClose}
      onCompleteTask={onCompleteTask}
    />,
  );
  return { onClose, onCompleteTask };
}

describe("StaySheet", () => {
  const stay = makeStay({
    id: "uid-1",
    property: LAKE_BREEZE,
    guest: "Nikki",
    checkIn: day(9),
    checkOut: day(12),
  });

  it("stays closed without a stay", () => {
    renderStaySheet(null);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the guest, property and dates", async () => {
    renderStaySheet(stay);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Nikki" })).toBeInTheDocument();
    expect(within(dialog).getByText("Lake Breeze")).toBeInTheDocument();
    const facts = Object.fromEntries(
      within(dialog)
        .getAllByRole("term")
        .map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]),
    );
    expect(facts).toEqual({ "Check-in": "Fri, Oct 9", Checkout: "Mon, Oct 12", Nights: "3" });
  });

  it("lists only this stay's to-dos, with due days", async () => {
    renderStaySheet(stay, [
      makeTask({ stayId: "uid-1", title: "Door code", kind: "door-code", due: day(6) }),
      makeTask({ stayId: "uid-1", title: "Review request", kind: "review", due: day(14) }),
      makeTask({ stayId: "other", title: "Someone else's", due: day(8) }),
    ]);
    const dialog = await screen.findByRole("dialog");
    const items = within(dialog).getAllByRole("checkbox");
    expect(items.map((c) => c.closest("label")!.textContent)).toEqual([
      expect.stringContaining("Door code"),
      expect.stringContaining("Review request"),
    ]);
    expect(within(dialog).getByText("Due Oct 6")).toBeInTheDocument();
    expect(within(dialog).getByText("Wed 14")).toBeInTheDocument();
  });

  it("explains an empty to-do list", async () => {
    renderStaySheet(stay);
    expect(await screen.findByText(/Nothing open for this stay/)).toBeInTheDocument();
  });

  it("titles an owner block and leaves out to-dos", async () => {
    renderStaySheet(
      makeStay({ id: "b", blocked: true, guest: "Blocked", checkIn: day(9), checkOut: day(10) }),
      [makeTask({ stayId: "b", due: day(8) })],
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Blocked" })).toBeInTheDocument();
    expect(within(dialog).queryByText("To-dos")).toBeNull();
    expect(within(dialog).queryByRole("checkbox")).toBeNull();
  });

  it("closes from the Close button", async () => {
    const { onClose } = renderStaySheet(stay);
    await userEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});

function renderAllTasks(tasks: BoardTask[], open = true) {
  const onOpenChange = vi.fn();
  render(
    <AllTasksSheet
      open={open}
      onOpenChange={onOpenChange}
      today={today}
      tasks={tasks}
      onCompleteTask={vi.fn()}
    />,
  );
  return { onOpenChange };
}

describe("AllTasksSheet", () => {
  it("stays closed until opened", () => {
    renderAllTasks([], false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("groups to-dos from overdue to later, in order", async () => {
    renderAllTasks([
      makeTask({ title: "Overdue one", kind: "other", due: day(3) }),
      makeTask({ title: "Today one", kind: "other", due: today }),
      makeTask({ title: "Tomorrow one", kind: "other", due: day(8) }),
      makeTask({ title: "Week one", kind: "other", due: day(13) }),
      makeTask({ title: "Later one", kind: "other", due: day(14) }),
    ]);
    const dialog = await screen.findByRole("dialog");
    const groups = within(dialog).getAllByRole("region");
    expect(groups.map((g) => g.getAttribute("aria-label"))).toEqual([
      "Overdue",
      "Today",
      "Tomorrow",
      "This week",
      "Later",
    ]);
    expect(within(groups[0]).getByText("Overdue one")).toBeInTheDocument();
    expect(within(groups[3]).getByText("Week one")).toBeInTheDocument();
    expect(within(groups[4]).getByText("Later one")).toBeInTheDocument();
    expect(within(groups[0]).getByRole("heading", { name: "Overdue" })).toHaveClass(
      "text-destructive",
    );
  });

  it("shows due days only in the week and later groups", async () => {
    renderAllTasks([
      makeTask({ title: "Tomorrow one", kind: "other", due: day(8) }),
      makeTask({ title: "Week one", kind: "other", due: day(10) }),
      makeTask({ title: "Later one", kind: "other", due: day(20) }),
    ]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText("Thu 8")).toBeNull();
    expect(within(dialog).getByText("Sat 10")).toBeInTheDocument();
    expect(within(dialog).getByText("Tue 20")).toBeInTheDocument();
  });

  it("counts open to-dos", async () => {
    renderAllTasks([makeTask({ due: day(8) }), makeTask({ due: day(9) })]);
    expect(await screen.findByText("2 open, soonest first.")).toBeInTheDocument();
  });

  it("says when everything is done", async () => {
    renderAllTasks([]);
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("closes from the Close button", async () => {
    const { onOpenChange } = renderAllTasks([]);
    await userEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
