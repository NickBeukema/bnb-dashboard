import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Board } from "./board";
import { day, makeStay, makeTask } from "../../../test/board-fixtures";
import type { BoardData } from "./model";
import { useBoard } from "./use-board";

vi.mock("./use-board", () => ({ useBoard: vi.fn() }));

type BoardState = ReturnType<typeof useBoard>;
const refresh = vi.fn();
const complete = vi.fn();

function mockBoard(state: Partial<BoardState>) {
  vi.mocked(useBoard).mockReturnValue({
    data: null,
    tasks: [],
    status: "loading",
    refresh,
    complete,
    ...state,
  });
}

const stay = makeStay({ id: "s1", guest: "Amber", checkIn: day(7), checkOut: day(10) });
const tasks = [makeTask({ due: day(7), title: "Door code", kind: "door-code", stayId: "s1" })];
const data: BoardData = {
  stays: [stay],
  tasks,
  failed: [],
  lastUpdated: new Date(2026, 9, 7, 20, 50),
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 7, 20, 57));
  refresh.mockReset();
  complete.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("Board", () => {
  it("shows the day, date and time", () => {
    mockBoard({});
    render(<Board />);
    expect(screen.getByText("Wednesday")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "October 7" })).toBeInTheDocument();
    expect(screen.getByLabelText("Time 8:57 PM")).toHaveTextContent("8:57PM");
  });

  it("shows skeletons while loading", () => {
    mockBoard({ status: "loading" });
    const { container } = render(<Board />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(5);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All to-dos/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refresh now" })).toBeDisabled();
  });

  it("offers a retry when the first load fails", async () => {
    mockBoard({ status: "error" });
    render(<Board />);
    expect(screen.getByText("Couldn't load the calendars")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps showing the last data when a refresh fails", () => {
    mockBoard({ status: "error", data, tasks });
    render(<Board />);
    expect(screen.queryByText("Couldn't load the calendars")).toBeNull();
    expect(screen.getByText("Couldn't refresh. Showing 8:50 PM")).toHaveClass("text-destructive");
  });

  it("renders the runway, calendar and phone agenda once loaded", () => {
    mockBoard({ status: "ready", data, tasks });
    render(<Board />);
    expect(screen.getByRole("region", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Stays this month" })).toBeInTheDocument();
    expect(screen.getByText("Updated 8:50 PM")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh now" })).toBeEnabled();
  });

  it("says when it's showing an offline copy, with the date once it's not today's", () => {
    mockBoard({
      status: "offline",
      data: { ...data, lastUpdated: new Date(2026, 9, 5, 18, 30) },
      tasks,
    });
    render(<Board />);
    expect(screen.getByText("Offline. Showing Oct 5, 6:30 PM")).toHaveClass("text-destructive");
    expect(screen.getByRole("button", { name: "Refresh now" })).toBeEnabled();
  });

  it("names the properties whose feed failed", () => {
    mockBoard({ status: "ready", data: { ...data, failed: ["Red", "Lake Breeze"] }, tasks });
    render(<Board />);
    expect(screen.getByText("Couldn't reach Red and Lake Breeze. Updated 8:50 PM")).toHaveClass(
      "text-destructive",
    );
  });

  it("puts the calendar above the next three days", () => {
    mockBoard({ status: "ready", data, tasks });
    render(<Board />);
    const calendar = screen.getByRole("heading", { name: "October 2026" });
    const runway = screen.getByRole("region", { name: "Today" });
    expect(
      calendar.compareDocumentPosition(runway) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("spins the refresh button while refreshing", () => {
    mockBoard({ status: "refreshing", data, tasks });
    render(<Board />);
    const button = screen.getByRole("button", { name: "Refresh now" });
    expect(button).toBeDisabled();
    expect(button.querySelector("svg")).toHaveClass("animate-spin");
  });

  it("refreshes on demand", async () => {
    mockBoard({ status: "ready", data, tasks });
    render(<Board />);
    await userEvent.click(screen.getByRole("button", { name: "Refresh now" }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("counts open to-dos and opens the full list", async () => {
    mockBoard({ status: "ready", data, tasks });
    render(<Board />);
    const button = screen.getByRole("button", { name: /All to-dos/ });
    expect(button).toHaveTextContent("All to-dos1");
    await userEvent.click(button);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "All to-dos" })).toBeInTheDocument();
  });

  it("opens a stay's details", async () => {
    mockBoard({ status: "ready", data, tasks });
    render(<Board />);
    await userEvent.click(screen.getByRole("button", { name: "Amber arrives" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Amber" })).toBeInTheDocument();
    expect(within(dialog).getByText("Door code")).toBeInTheDocument();
  });

  // A task due soon shows in the runway and in an open sheet at the same time. Each row needs
  // its own checkbox id, or tapping the sheet row's text ticks the hidden runway row instead.
  it("ticks the sheet's own checkbox when its row text is tapped", async () => {
    mockBoard({ status: "ready", data, tasks });
    render(<Board />);
    await userEvent.click(screen.getByRole("button", { name: "Amber arrives" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByText("Door code"));
    expect(within(dialog).getByRole("checkbox")).toBeChecked();
    const ids = [...document.querySelectorAll('[role="checkbox"]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has the theme switch", () => {
    mockBoard({});
    render(<Board />);
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
  });
});
