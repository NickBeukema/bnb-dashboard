import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LAKE_BREEZE, NAUTICAL_NEST, RED, WAVESONG, day, makeStay } from "../../../test/board-fixtures";
import type { Stay } from "./model";
import { StayCalendar, StayCalendarSkeleton } from "./stay-calendar";

const today = day(7); // Wed Oct 7, so the grid starts Sun Oct 4 and ends Sat Oct 31

function renderCalendar(stays: Stay[] = [], when = today) {
  const onSelectStay = vi.fn();
  const utils = render(<StayCalendar today={when} stays={stays} onSelectStay={onSelectStay} />);
  const lanes = (name: string) => utils.container.querySelectorAll(`[title="${name}"]`).length;
  return { ...utils, onSelectStay, lanes, user: userEvent.setup() };
}

const title = () => screen.getByRole("heading", { level: 2 }).textContent;

describe("StayCalendar", () => {
  it("titles a grid inside one month with that month", () => {
    renderCalendar();
    expect(title()).toBe("October 2026");
  });

  it("titles a grid that spans two months with both", () => {
    renderCalendar([], day(20));
    expect(title()).toBe("October – November 2026");
  });

  it("draws four weeks with a lane per property in each", () => {
    const { lanes } = renderCalendar();
    for (const p of [WAVESONG, RED, LAKE_BREEZE, NAUTICAL_NEST]) expect(lanes(p.name)).toBe(4);
    expect(screen.getByText("Oct 4")).toBeInTheDocument();
    expect(screen.getByText("31")).toBeInTheDocument();
    expect(screen.queryByText("Nov 1")).toBeNull();
  });

  it("marks today and dims the days before it", () => {
    renderCalendar();
    expect(screen.getByText("7")).toHaveClass("bg-today");
    expect(screen.getByText("5")).toHaveClass("text-muted-foreground");
    expect(screen.getByText("8")).not.toHaveClass("text-muted-foreground");
  });

  it("labels the first of a month with its name", () => {
    renderCalendar([], day(20));
    expect(screen.getByText("Nov 1")).toBeInTheDocument();
  });

  it("pages four weeks at a time and returns to today", async () => {
    const { user } = renderCalendar();
    const todayButton = screen.getByRole("button", { name: "Today" });
    expect(todayButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next four weeks" }));
    expect(title()).toBe("November 2026");
    expect(todayButton).toBeEnabled();

    await user.click(todayButton);
    expect(title()).toBe("October 2026");

    await user.click(screen.getByRole("button", { name: "Previous four weeks" }));
    expect(title()).toBe("September – October 2026");
  });

  it("hides a property's lanes from the legend and shows them again", async () => {
    const { user, lanes } = renderCalendar();
    const red = screen.getByRole("button", { name: "Red" });
    expect(red).toHaveAttribute("aria-pressed", "true");

    await user.click(red);
    expect(red).toHaveAttribute("aria-pressed", "false");
    expect(lanes("Red")).toBe(0);
    expect(lanes("Wavesong")).toBe(4);

    await user.click(red);
    expect(lanes("Red")).toBe(4);
  });

  it("won't hide the last property", async () => {
    const { user, lanes } = renderCalendar();
    for (const name of ["Wavesong", "Red", "Lake Breeze"]) await user.click(screen.getByRole("button", { name }));
    const last = screen.getByRole("button", { name: "Nautical Nest" });
    await user.click(last);
    expect(last).toHaveAttribute("aria-pressed", "true");
    expect(lanes("Nautical Nest")).toBe(4);
  });

  it("gives each stay an accessible bar", () => {
    renderCalendar([makeStay({ property: RED, guest: "Dennis", checkIn: day(15), checkOut: day(17) })]);
    expect(screen.getByRole("button", { name: "Dennis, Red, Oct 15 to Oct 17" })).toHaveTextContent("Dennis");
  });

  it("splits a stay that crosses a week into one bar per week", () => {
    renderCalendar([makeStay({ guest: "Jamie", checkIn: day(9), checkOut: day(13) })]);
    const bars = screen.getAllByRole("button", { name: "Jamie, Wavesong, Oct 9 to Oct 13" });
    expect(bars).toHaveLength(2);
    // Starts mid-week, so the first piece is rounded on the left only
    expect(bars[0]).toHaveClass("rounded-l-full", "rounded-r-none");
    expect(bars[1]).toHaveClass("rounded-l-none", "rounded-r-full");
  });

  it("runs bars from midday to midday", () => {
    renderCalendar([makeStay({ guest: "Eva", checkIn: day(5), checkOut: day(7) })]);
    const bar = screen.getByRole("button", { name: /^Eva,/ });
    // Mon (index 1) + half a day to Wed (index 3) + half a day
    expect(bar.style.left).toBe("calc(21.4286% + 3px)");
    expect(bar.style.right).toBe("calc(50% + 3px)");
  });

  it("leaves out stays beyond the four weeks", () => {
    renderCalendar([
      makeStay({ guest: "Later", checkIn: day(20, 11), checkOut: day(22, 11) }),
      makeStay({ guest: "Earlier", checkIn: day(1, 9), checkOut: day(3, 9) }),
    ]);
    expect(screen.queryByRole("button", { name: /^Later,/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Earlier,/ })).toBeNull();
  });

  it("hides the name on a bar too short to fit it", () => {
    // Checks out on the grid's first day: only the morning half of Sunday is left
    renderCalendar([makeStay({ guest: "Sheila", checkIn: day(1), checkOut: day(4) })]);
    expect(screen.getByText("Sheila")).toHaveClass("sr-only");
  });

  it("opens a stay from its bar", async () => {
    const stay = makeStay({ property: NAUTICAL_NEST, guest: "George", checkIn: day(12), checkOut: day(16) });
    const { user, onSelectStay } = renderCalendar([stay]);
    await user.click(screen.getByRole("button", { name: /^George,/ }));
    expect(onSelectStay).toHaveBeenCalledExactlyOnceWith(stay);
  });

  it("labels owner blocks as Blocked", () => {
    renderCalendar([makeStay({ blocked: true, guest: "Not available", checkIn: day(13), checkOut: day(14) })]);
    const bar = screen.getByRole("button", { name: "Blocked, Wavesong, Oct 13 to Oct 14" });
    expect(bar).toHaveTextContent("Blocked");
    expect(bar).toHaveClass("stripes");
  });

  it("renders a skeleton", () => {
    const { container } = render(<StayCalendarSkeleton className="extra" />);
    expect(container.firstChild).toHaveClass("extra");
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
  });
});
