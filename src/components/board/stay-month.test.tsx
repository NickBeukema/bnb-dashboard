import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LAKE_BREEZE, RED, WAVESONG, day, makeStay } from "../../../test/board-fixtures";
import { daysAtProperties, type Stay } from "./model";
import { PhoneStays } from "./phone-stays";
import { StayMonth } from "./stay-month";

const today = day(8);

const joseph = makeStay({ guest: "Joseph", property: WAVESONG, checkIn: day(5), checkOut: day(8) });
const michelle = makeStay({
  guest: "Michelle",
  property: WAVESONG,
  checkIn: day(8),
  checkOut: day(11),
});
const anna = makeStay({ guest: "Anna", property: RED, checkIn: day(6), checkOut: day(10) });
const closure = makeStay({
  guest: "Closed",
  closed: true,
  property: LAKE_BREEZE,
  checkIn: day(1),
  checkOut: day(1, 5, 2027),
});
const stays = [joseph, michelle, anna, closure];

function renderMonth(list: Stay[] = stays) {
  const onSelectStay = vi.fn();
  const onMonthChange = vi.fn();
  render(
    <StayMonth
      today={today}
      stays={list}
      onSelectStay={onSelectStay}
      onMonthChange={onMonthChange}
    />,
  );
  return { onSelectStay, onMonthChange };
}

const panel = () => screen.getByRole("region", { name: /^\w+day, \w+ \d+/ });
const dayButton = (name: RegExp) => screen.getByRole("button", { name });

describe("daysAtProperties", () => {
  it("splits a property's day into leaving, arriving, staying and closed", () => {
    const [wavesong, red, lakeBreeze, nauticalNest] = daysAtProperties(today, stays);
    expect(wavesong).toMatchObject({ out: joseph, in: michelle, staying: null, closed: null });
    expect(red).toMatchObject({ out: null, in: null, staying: anna });
    expect(lakeBreeze).toMatchObject({ out: null, in: null, staying: null, closed: closure });
    expect(nauticalNest).toMatchObject({ out: null, in: null, staying: null, closed: null });
  });
});

describe("StayMonth", () => {
  it("shows the whole month in full weeks, with today selected", () => {
    renderMonth();
    // October 2026 starts on a Thursday: Sep 27 to Oct 31 is five weeks
    expect(screen.getAllByRole("button", { pressed: false }).length).toBe(34);
    expect(screen.getByRole("button", { pressed: true })).toHaveAccessibleName(
      /^Thursday, October 8, today\./,
    );
  });

  it("names every property with something on in each day's label", () => {
    renderMonth();
    expect(dayButton(/October 8, today/)).toHaveAccessibleName(
      "Thursday, October 8, today. Wavesong: Joseph leaves, Michelle arrives. Red: Anna. Lake Breeze: closed",
    );
    expect(dayButton(/October 20/)).toHaveAccessibleName(
      "Tuesday, October 20. Lake Breeze: closed",
    );
  });

  it("lists every property for the selected day", () => {
    renderMonth();
    const rows = within(panel()).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/^Wavesong.*Joseph.*Checks out.*Michelle.*Checks in, 3 nights/),
      expect.stringMatching(/^Red.*Anna.*Night 3 of 4, leaves Oct 10/),
      expect.stringMatching(/^Lake Breeze.*Closed for the season.*Until May 1/),
      "Nautical NestEmpty",
    ]);
  });

  it("shows another day when it's tapped, and opens a stay from the list", async () => {
    const user = userEvent.setup();
    const { onSelectStay } = renderMonth();
    await user.click(dayButton(/^Friday, October 9\./));
    expect(dayButton(/^Friday, October 9\./)).toHaveAttribute("aria-pressed", "true");
    expect(panel()).toHaveAccessibleName("Friday, October 9 Tomorrow");
    await user.click(within(panel()).getByRole("button", { name: /Michelle/ }));
    expect(onSelectStay).toHaveBeenCalledWith(michelle);
  });

  it("moves between months with the buttons and back with Today", async () => {
    const user = userEvent.setup();
    const { onMonthChange } = renderMonth();
    expect(screen.getByRole("button", { name: "Today" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next month, November" }));
    expect(onMonthChange).toHaveBeenLastCalledWith(day(1, 11));
    expect(screen.getByRole("button", { pressed: true })).toHaveAccessibleName(
      /^Sunday, November 1\./,
    );

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(onMonthChange).toHaveBeenLastCalledWith(day(1, 10));
    expect(screen.getByRole("button", { pressed: true })).toHaveAccessibleName(/today/);
  });

  it("jumps to the neighbouring month when a day outside this one is tapped", async () => {
    const user = userEvent.setup();
    const { onMonthChange } = renderMonth();
    await user.click(dayButton(/^Sunday, September 27\./));
    expect(onMonthChange).toHaveBeenLastCalledWith(day(1, 9));
    expect(dayButton(/^Sunday, September 27\./)).toHaveAttribute("aria-pressed", "true");
  });

  it("turns the month with a sideways swipe, but not a scroll", () => {
    const { onMonthChange } = renderMonth();
    const grid = dayButton(/October 8, today/).closest(".touch-pan-y")!;
    const swipe = (from: [number, number], to: [number, number]) => {
      fireEvent.touchStart(grid, { touches: [{ clientX: from[0], clientY: from[1] }] });
      fireEvent.touchEnd(grid, { changedTouches: [{ clientX: to[0], clientY: to[1] }] });
    };

    swipe([300, 100], [280, 300]);
    expect(onMonthChange).not.toHaveBeenCalled();
    swipe([300, 100], [200, 110]);
    expect(onMonthChange).toHaveBeenLastCalledWith(day(1, 11));
    swipe([100, 100], [200, 90]);
    expect(onMonthChange).toHaveBeenLastCalledWith(day(1, 10));
  });
});

describe("PhoneStays", () => {
  beforeEach(() => localStorage.clear());

  const renderPhone = () =>
    render(<PhoneStays today={today} stays={stays} onSelectStay={vi.fn()} />);

  it("starts on the list and remembers switching to the calendar", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPhone();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Stays this month");
    expect(screen.getByRole("radio", { name: "List" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Calendar" }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("October 2026");
    expect(localStorage.getItem("bnb-phone-view")).toBe("month");

    unmount();
    renderPhone();
    expect(screen.getByRole("radio", { name: "Calendar" })).toBeChecked();
  });

  it("names the month on show in the heading", async () => {
    localStorage.setItem("bnb-phone-view", "month");
    const user = userEvent.setup();
    renderPhone();
    await user.click(screen.getByRole("button", { name: "Previous month, September" }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("September 2026");
  });

  it("keeps the list when the selected view is tapped again", async () => {
    const user = userEvent.setup();
    renderPhone();
    await user.click(screen.getByRole("radio", { name: "List" }));
    expect(screen.getByRole("radio", { name: "List" })).toBeChecked();
    expect(localStorage.getItem("bnb-phone-view")).toBeNull();
  });
});
