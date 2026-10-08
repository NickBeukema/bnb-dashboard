import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RED, day, makeStay } from "../../../test/board-fixtures";
import type { Stay } from "./model";
import { StayAgenda, stayDates } from "./stay-agenda";

const today = day(7);

function renderAgenda(stays: Stay[]) {
  const onSelectStay = vi.fn();
  render(<StayAgenda today={today} stays={stays} onSelectStay={onSelectStay} />);
  return { onSelectStay };
}

const rows = () => screen.queryAllByRole("button");

describe("stayDates", () => {
  it("drops the repeated month within one month", () => {
    expect(stayDates(makeStay({ checkIn: day(9), checkOut: day(13) }))).toBe("Oct 9 – 13");
  });

  it("names both months across a month boundary", () => {
    expect(stayDates(makeStay({ checkIn: day(29), checkOut: day(2, 11) }))).toBe("Oct 29 – Nov 2");
  });
});

describe("StayAgenda", () => {
  it("lists stays from today through the next 30 days", () => {
    renderAgenda([
      makeStay({ guest: "Gone", checkIn: day(1), checkOut: day(6) }),
      makeStay({ guest: "Leaving today", checkIn: day(3), checkOut: today }),
      makeStay({ guest: "Soon", checkIn: day(10), checkOut: day(12) }),
      makeStay({ guest: "Day 30", checkIn: day(6, 11), checkOut: day(8, 11) }),
      makeStay({ guest: "Too far", checkIn: day(7, 11), checkOut: day(9, 11) }),
    ]);
    expect(
      rows().map((r) => within(r).getByText(/^[A-Z]/, { selector: ".text-lg" }).textContent),
    ).toEqual(["Leaving today", "Soon", "Day 30"]);
  });

  it("leaves out seasonal closures", () => {
    renderAgenda([makeStay({ guest: "Closed", closed: true, checkIn: day(9), checkOut: day(10) })]);
    expect(rows()).toHaveLength(0);
  });

  it("says when nothing is booked", () => {
    renderAgenda([]);
    expect(screen.getByText("No bookings in the next 30 days.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("marks guests who are already here", () => {
    renderAgenda([
      makeStay({ guest: "Amber", checkIn: day(5), checkOut: day(9) }),
      makeStay({ guest: "Jamie", checkIn: day(12), checkOut: day(14) }),
    ]);
    const [amber, jamie] = rows();
    expect(within(amber).getByText("Here now")).toBeInTheDocument();
    expect(within(jamie).queryByText("Here now")).toBeNull();
  });

  it("counts nights with the right plural", () => {
    renderAgenda([
      makeStay({ guest: "One", checkIn: day(9), checkOut: day(10) }),
      makeStay({ guest: "Two", checkIn: day(11), checkOut: day(13) }),
    ]);
    expect(screen.getByText("Oct 9 – 10, 1 night")).toBeInTheDocument();
    expect(screen.getByText("Oct 11 – 13, 2 nights")).toBeInTheDocument();
  });

  it("shows the property", () => {
    renderAgenda([
      makeStay({ property: RED, guest: "Dennis", checkIn: day(15), checkOut: day(18) }),
    ]);
    expect(within(rows()[0]).getByText("Red")).toBeInTheDocument();
  });

  it("opens a stay", async () => {
    const stay = makeStay({ guest: "Nikki", checkIn: day(9), checkOut: day(12) });
    const { onSelectStay } = renderAgenda([stay]);
    await userEvent.click(screen.getByRole("button", { name: /Nikki/ }));
    expect(onSelectStay).toHaveBeenCalledExactlyOnceWith(stay);
  });
});
