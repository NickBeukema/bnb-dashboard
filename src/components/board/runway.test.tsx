import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  LAKE_BREEZE,
  NAUTICAL_NEST,
  RED,
  WAVESONG,
  day,
  makeStay,
  makeTask,
} from "../../../test/board-fixtures";
import type { BoardTask, Stay } from "./model";
import { Runway } from "./runway";

const today = day(7); // Wednesday

function renderRunway(stays: Stay[] = [], tasks: BoardTask[] = []) {
  const onSelectStay = vi.fn();
  const onCompleteTask = vi.fn();
  render(
    <Runway
      today={today}
      stays={stays}
      tasks={tasks}
      onSelectStay={onSelectStay}
      onCompleteTask={onCompleteTask}
    />,
  );
  const column = (name: string) => screen.getByRole("region", { name });
  return { onSelectStay, onCompleteTask, column };
}

describe("Runway", () => {
  it("shows today, tomorrow and the day after by name", () => {
    renderRunway();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Today",
      "Tomorrow",
      "Friday",
    ]);
    expect(screen.getByText("Oct 7")).toBeInTheDocument();
    expect(screen.getByText("Oct 9")).toBeInTheDocument();
  });

  it("says when a day is quiet", () => {
    renderRunway();
    expect(screen.getAllByText("Nothing on. Enjoy the quiet.")).toHaveLength(3);
  });

  it("puts overdue work under Today", () => {
    const { column } = renderRunway(
      [],
      [
        makeTask({ due: day(2), title: "Old letter" }),
        makeTask({ due: today, title: "Today letter" }),
      ],
    );
    const todayCol = column("Today");
    expect(within(todayCol).getByText("Old letter")).toBeInTheDocument();
    expect(within(todayCol).getByText("Today letter")).toBeInTheDocument();
    expect(within(todayCol).getByText("Due Oct 2")).toBeInTheDocument();
  });

  it("only lists a later day's own tasks", () => {
    const { column } = renderRunway(
      [],
      [
        makeTask({ due: day(2), title: "Old letter" }),
        makeTask({ due: day(8), title: "Tomorrow letter" }),
        makeTask({ due: day(9), title: "Friday letter" }),
        makeTask({ due: day(10), title: "Saturday letter" }),
      ],
    );
    const tomorrow = column("Tomorrow");
    expect(within(tomorrow).getByText("Tomorrow letter")).toBeInTheDocument();
    expect(within(tomorrow).queryByText("Old letter")).toBeNull();
    expect(within(tomorrow).queryByText("Friday letter")).toBeNull();
    expect(within(column("Friday")).getByText("Friday letter")).toBeInTheDocument();
    expect(screen.queryByText("Saturday letter")).toBeNull();
  });

  it("lists arrivals and departures per property", () => {
    const { column } = renderRunway([
      makeStay({ property: RED, guest: "Tarren", checkIn: day(4), checkOut: today }),
      makeStay({ property: LAKE_BREEZE, guest: "Deb", checkIn: today, checkOut: day(12) }),
    ]);
    const todayCol = column("Today");
    const list = within(todayCol).getByRole("list", { name: "Arrivals and departures" });
    expect(within(list).getByRole("button", { name: /^Tarren\s*leaves$/ })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Deb arrives" })).toBeInTheDocument();
    expect(within(list).queryByText("Same-day turnover")).toBeNull();
  });

  it("badges a same-day turnover", () => {
    const { column } = renderRunway([
      makeStay({ property: NAUTICAL_NEST, guest: "Joseph", checkIn: day(2), checkOut: day(9) }),
      makeStay({ property: NAUTICAL_NEST, guest: "Michelle", checkIn: day(9), checkOut: day(14) }),
    ]);
    const friday = column("Friday");
    expect(within(friday).getByText("Same-day turnover")).toBeInTheDocument();
    const names = within(friday)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(names).toEqual(["Joseph leaves", "Michelle arrives"]);
  });

  it("leaves blocked dates out of the movements", () => {
    renderRunway([
      makeStay({
        property: WAVESONG,
        blocked: true,
        guest: "Blocked",
        checkIn: today,
        checkOut: day(9),
      }),
    ]);
    expect(screen.queryByRole("list", { name: "Arrivals and departures" })).toBeNull();
  });

  it("reads the guest and verb as separate words", () => {
    renderRunway([makeStay({ guest: "Amber", checkIn: today, checkOut: day(10) })]);
    expect(screen.getByRole("button", { name: "Amber arrives" })).toBeInTheDocument();
  });

  it("opens a stay from its guest", async () => {
    const stay = makeStay({ guest: "Amber", checkIn: today, checkOut: day(10) });
    const { onSelectStay } = renderRunway([stay]);
    await userEvent.click(screen.getByRole("button", { name: "Amber arrives" }));
    expect(onSelectStay).toHaveBeenCalledExactlyOnceWith(stay);
  });

  it("completes a task", () => {
    vi.useFakeTimers();
    try {
      const task = makeTask({ due: day(8), title: "Door code" });
      const { onCompleteTask } = renderRunway([], [task]);
      fireEvent.click(screen.getByRole("checkbox", { name: /Door code/ }));
      act(() => vi.runAllTimers());
      expect(onCompleteTask).toHaveBeenCalledExactlyOnceWith(task);
    } finally {
      vi.useRealTimers();
    }
  });

  it("names each day's to-do list", () => {
    renderRunway([], [makeTask({ due: day(8) })]);
    expect(screen.getByRole("list", { name: "To-dos tomorrow" })).toBeInTheDocument();
  });
});
