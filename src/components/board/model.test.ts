import { describe, expect, it } from "vitest";
import type { CalendarEvent, CalendarSource, Task } from "@/lib/calendar-types";
import {
  type BoardTask,
  PROPERTIES,
  type Stay,
  isOverdue,
  movementsOn,
  propertyByName,
  propertyStyle,
  stayOnNight,
  toStays,
  toTasks,
} from "./model";

// Local calendar days in the test timezone (America/New_York)
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

/** An event as the API sends it: plain local check-in and checkout days */
const apiEvent = (overrides: Partial<CalendarEvent> & { id: string }): CalendarEvent => ({
  title: "Reserved - Jen",
  checkIn: "2026-10-09",
  checkOut: "2026-10-12",
  description: null,
  ...overrides,
});

const source = (name: string, events: CalendarEvent[]): CalendarSource => ({
  name,
  events,
  color: "#000",
});

const task = (overrides: Partial<Task> & { id: string }): Task => ({
  name: "Send Welcome Letter (Reserved - Jen)",
  description: "bnb-abc-123-send-welcome-letter",
  completed: false,
  dueDate: "2026-10-07",
  priority: 1,
  labels: ["Wavesong"],
  ...overrides,
});

const stay = (overrides: Partial<Stay> & { id: string }): Stay => ({
  property: propertyByName("Wavesong"),
  guest: "Jen",
  closed: false,
  checkIn: day(2026, 10, 9),
  checkOut: day(2026, 10, 12),
  nights: 3,
  ...overrides,
});

describe("PROPERTIES", () => {
  it("lists the four properties in lane order", () => {
    expect(PROPERTIES.map((p) => p.name)).toEqual([
      "Wavesong",
      "Red",
      "Lake Breeze",
      "Nautical Nest",
    ]);
    expect(PROPERTIES.map((p) => p.initial)).toEqual(["W", "R", "L", "N"]);
  });
});

describe("propertyByName", () => {
  it("finds a known property", () => {
    expect(propertyByName("Lake Breeze")).toBe(PROPERTIES[2]);
  });

  it("falls back to a muted property that keeps the unknown name", () => {
    expect(propertyByName("Betsie")).toEqual({
      name: "Betsie",
      token: "muted-foreground",
      initial: "?",
    });
  });

  it('calls a missing name "Other"', () => {
    expect(propertyByName(undefined)).toEqual({
      name: "Other",
      token: "muted-foreground",
      initial: "?",
    });
  });
});

describe("propertyStyle", () => {
  it("points --prop and --prop-ink at the property's tokens", () => {
    expect(propertyStyle(propertyByName("Red"))).toEqual({
      "--prop": "var(--red-house)",
      "--prop-ink": "var(--red-house-ink, var(--background))",
    });
  });
});

describe("toStays", () => {
  it("reads check-in and checkout as local days", () => {
    const [s] = toStays([source("Wavesong", [apiEvent({ id: "a" })])]);
    expect(s.checkIn).toEqual(day(2026, 10, 9));
    expect(s.checkOut).toEqual(day(2026, 10, 12));
    expect(s.nights).toBe(3);
    expect(s.id).toBe("a");
    expect(s.property).toBe(PROPERTIES[0]);
  });

  // The old API sent shifted timestamps, and the old calendar popup showed the wrong checkout
  // when the clocks fell back on checkout day (seen on a real Nov 1→2, 2025 stay)
  it.each([
    [
      "clocks fall back on checkout day",
      "2026-10-31",
      "2026-11-01",
      day(2026, 10, 31),
      day(2026, 11, 1),
      1,
    ],
    [
      "clocks fall back mid-stay",
      "2026-10-30",
      "2026-11-02",
      day(2026, 10, 30),
      day(2026, 11, 2),
      3,
    ],
    [
      "clocks spring forward on checkout day",
      "2027-03-13",
      "2027-03-14",
      day(2027, 3, 13),
      day(2027, 3, 14),
      1,
    ],
    [
      "clocks spring forward on check-in day",
      "2027-03-14",
      "2027-03-16",
      day(2027, 3, 14),
      day(2027, 3, 16),
      2,
    ],
  ])("keeps the real days when the %s", (_, checkIn, checkOut, expectedIn, expectedOut, nights) => {
    const [s] = toStays([source("Wavesong", [apiEvent({ id: "dst", checkIn, checkOut })])]);
    expect(s.checkIn).toEqual(expectedIn);
    expect(s.checkOut).toEqual(expectedOut);
    expect(s.nights).toBe(nights);
  });

  it("parses the guest from the title", () => {
    const stays = toStays([
      source("Wavesong", [
        apiEvent({ id: "1", title: "Reserved - Jen" }),
        apiEvent({ id: "2", title: "reserved -   Ann Marie  " }),
        apiEvent({ id: "3", title: "Reserved" }),
        apiEvent({ id: "4", title: "Reserved - " }),
        apiEvent({ id: "5", title: "Owner stay" }),
      ]),
    ]);
    expect(stays.map((s) => s.guest)).toEqual([
      "Jen",
      "Ann Marie",
      "Reserved",
      "Reserved",
      "Owner stay",
    ]);
  });

  it("shows short owner blocks as private bookings", () => {
    const stays = toStays([
      source("Wavesong", [
        apiEvent({ id: "1", title: "Blocked" }),
        apiEvent({ id: "2", title: "blocked dates" }),
        apiEvent({ id: "3", title: "Airbnb (Not available)" }),
        apiEvent({ id: "4", title: "Reserved - Blockedson" }),
        apiEvent({ id: "5", title: "Unblocked" }),
      ]),
    ]);
    expect(stays.map((s) => [s.guest, s.closed])).toEqual([
      ["Private booking", false],
      ["Private booking", false],
      ["Private booking", false],
      ["Blockedson", false],
      ["Unblocked", false],
    ]);
  });

  it("closes the property for owner blocks over two weeks", () => {
    const stays = toStays([
      source("Wavesong", [
        apiEvent({ id: "14", title: "Blocked", checkIn: "2026-11-01", checkOut: "2026-11-15" }),
        apiEvent({ id: "15", title: "Blocked", checkIn: "2026-11-01", checkOut: "2026-11-16" }),
        apiEvent({ id: "guest", checkIn: "2026-11-01", checkOut: "2026-12-01" }),
      ]),
    ]);
    expect(stays.map((s) => [s.id, s.guest, s.closed])).toEqual([
      ["14", "Private booking", false],
      ["15", "Closed", true],
      ["guest", "Jen", false],
    ]);
  });

  it("names a private booking's tasks after the booking", () => {
    const [letter] = toTasks([
      {
        id: "t",
        name: "Send Welcome Letter (Blocked)",
        description: "bnb-b1-send-welcome-letter",
        completed: false,
        dueDate: "2026-10-09",
        priority: 1,
        labels: ["Wavesong"],
      },
    ]);
    expect(letter.guest).toBe("Private booking");
  });

  it("sorts stays across sources by check-in", () => {
    const stays = toStays([
      source("Wavesong", [apiEvent({ id: "late", checkIn: "2026-10-20", checkOut: "2026-10-23" })]),
      source("Red", [apiEvent({ id: "early", checkIn: "2026-10-02", checkOut: "2026-10-05" })]),
      source("Lake Breeze", [apiEvent({ id: "mid" })]),
    ]);
    expect(stays.map((s) => s.id)).toEqual(["early", "mid", "late"]);
  });

  it("keeps stays from an unknown source with a fallback property", () => {
    const [s] = toStays([source("Betsie", [apiEvent({ id: "b" })])]);
    expect(s.property.name).toBe("Betsie");
    expect(s.property.token).toBe("muted-foreground");
  });

  it("returns nothing for no sources", () => {
    expect(toStays([])).toEqual([]);
  });
});

describe("toTasks", () => {
  it("drops completed tasks and tasks without a due date", () => {
    const tasks = toTasks([
      task({ id: "open" }),
      task({ id: "done", completed: true }),
      task({ id: "undated", dueDate: "" }),
    ]);
    expect(tasks.map((t) => t.id)).toEqual(["open"]);
  });

  it("reads the kind, title, guest, property and stay from generated tasks", () => {
    const tasks = toTasks([
      task({ id: "w", description: "bnb-uid-1-send-welcome-letter" }),
      task({
        id: "r",
        name: "Send Review Request (Reserved - Deb)",
        description: "bnb-uid-2-send-review-request",
        labels: ["Red"],
      }),
      task({
        id: "d",
        name: "Make Door Code (Reserved - Amber)",
        description: "bnb-3b24b7a5-8270-4cb5-a5c9-8b4c652f0565-make-door-code",
        labels: ["Lake Breeze"],
      }),
    ]);
    expect(tasks).toEqual<BoardTask[]>([
      {
        id: "w",
        kind: "welcome",
        title: "Welcome letter",
        guest: "Jen",
        property: PROPERTIES[0],
        stayId: "uid-1",
        due: day(2026, 10, 7),
      },
      {
        id: "r",
        kind: "review",
        title: "Review request",
        guest: "Deb",
        property: PROPERTIES[1],
        stayId: "uid-2",
        due: day(2026, 10, 7),
      },
      {
        id: "d",
        kind: "door-code",
        title: "Door code",
        guest: "Amber",
        property: PROPERTIES[2],
        stayId: "3b24b7a5-8270-4cb5-a5c9-8b4c652f0565",
        due: day(2026, 10, 7),
      },
    ]);
  });

  it('keeps an unparenthesised "Reserved" guest as Reserved and drops a missing one', () => {
    const [withReserved, withoutGuest] = toTasks([
      task({ id: "a", name: "Send Review Request (Reserved)" }),
      task({ id: "b", name: "Send Review Request", dueDate: "2026-10-08" }),
    ]);
    expect(withReserved.guest).toBe("Reserved");
    expect(withoutGuest.guest).toBeNull();
  });

  it("keeps the name of other tasks and gives them no guest or stay", () => {
    const [t] = toTasks([
      task({ id: "o", name: "Buy coffee (the good one)", description: "", labels: [] }),
    ]);
    expect(t).toMatchObject({
      kind: "other",
      title: "Buy coffee (the good one)",
      guest: null,
      stayId: null,
      property: null,
    });
  });

  it("treats a description that only looks like a task id as other", () => {
    const [t] = toTasks([task({ id: "x", description: "bnb-uid-clean-the-hot-tub" })]);
    expect(t.kind).toBe("other");
    expect(t.stayId).toBeNull();
  });

  it("copes with a missing description", () => {
    const [t] = toTasks([task({ id: "x", description: undefined as unknown as string })]);
    expect(t.kind).toBe("other");
  });

  it("takes the property from the first label that names one", () => {
    const [t] = toTasks([task({ id: "x", labels: ["urgent", "Nautical Nest", "Red"] })]);
    expect(t.property).toBe(PROPERTIES[3]);
    const [none] = toTasks([task({ id: "y", labels: ["Betsie"] })]);
    expect(none.property).toBeNull();
  });

  it("parses date-only and date-time due values to the start of the local day", () => {
    const [dateOnly, dateTime, utcEvening] = toTasks([
      task({ id: "a", dueDate: "2026-10-07" }),
      task({ id: "b", dueDate: "2026-10-08T15:00:00" }),
      // 2026-10-10T02:00Z is the evening of Oct 9 in New York
      task({ id: "c", dueDate: "2026-10-10T02:00:00Z" }),
    ]);
    expect(dateOnly.due).toEqual(day(2026, 10, 7));
    expect(dateTime.due).toEqual(day(2026, 10, 8));
    expect(utcEvening.due).toEqual(day(2026, 10, 9));
  });

  it("sorts by due day", () => {
    const tasks = toTasks([
      task({ id: "c", dueDate: "2026-10-12" }),
      task({ id: "a", dueDate: "2026-10-01" }),
      task({ id: "b", dueDate: "2026-10-07" }),
    ]);
    expect(tasks.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
});

describe("isOverdue", () => {
  const today = day(2026, 10, 7);
  const due = (d: Date) => ({ due: d }) as BoardTask;

  it("is true only for days before today", () => {
    expect(isOverdue(due(day(2026, 10, 6)), today)).toBe(true);
    expect(isOverdue(due(day(2026, 10, 7)), today)).toBe(false);
    expect(isOverdue(due(day(2026, 10, 8)), today)).toBe(false);
  });
});

describe("movementsOn", () => {
  const today = day(2026, 10, 9);

  it("lists departures and arrivals per property", () => {
    const leaving = stay({ id: "out", checkIn: day(2026, 10, 5), checkOut: today });
    const arriving = stay({
      id: "in",
      property: propertyByName("Red"),
      checkIn: today,
      checkOut: day(2026, 10, 12),
    });
    const elsewhere = stay({
      id: "x",
      property: propertyByName("Lake Breeze"),
      checkIn: day(2026, 10, 8),
      checkOut: day(2026, 10, 11),
    });
    expect(movementsOn(today, [leaving, arriving, elsewhere])).toEqual([
      { property: PROPERTIES[0], out: leaving, in: null },
      { property: PROPERTIES[1], out: null, in: arriving },
    ]);
  });

  it("pairs a same-day turnover at one property", () => {
    const out = stay({ id: "out", checkIn: day(2026, 10, 5), checkOut: today });
    const arriving = stay({ id: "in", checkIn: today, checkOut: day(2026, 10, 12) });
    expect(movementsOn(today, [arriving, out])).toEqual([
      { property: PROPERTIES[0], out, in: arriving },
    ]);
  });

  it("ignores seasonal closures", () => {
    const closed = stay({ id: "b", closed: true, guest: "Closed", checkIn: today });
    expect(movementsOn(today, [closed])).toEqual([]);
  });

  it("follows PROPERTIES order, not stay order", () => {
    const nest = stay({ id: "n", property: propertyByName("Nautical Nest"), checkIn: today });
    const wave = stay({ id: "w", property: propertyByName("Wavesong"), checkIn: today });
    expect(movementsOn(today, [nest, wave]).map((t) => t.property.name)).toEqual([
      "Wavesong",
      "Nautical Nest",
    ]);
  });

  it("matches by calendar day, ignoring the time of day", () => {
    const s = stay({ id: "s", checkIn: today });
    expect(movementsOn(new Date(2026, 9, 9, 18, 30), [s])).toHaveLength(1);
  });

  it("ignores stays at properties outside PROPERTIES", () => {
    expect(
      movementsOn(today, [stay({ id: "s", property: propertyByName("Betsie"), checkIn: today })]),
    ).toEqual([]);
  });
});

describe("stayOnNight", () => {
  const wave = PROPERTIES[0];
  const s = stay({ id: "s", checkIn: day(2026, 10, 9), checkOut: day(2026, 10, 12) });

  it("finds the stay for every night from check-in up to checkout", () => {
    expect(stayOnNight(wave, day(2026, 10, 9), [s])).toBe(s);
    expect(stayOnNight(wave, day(2026, 10, 11), [s])).toBe(s);
  });

  it("excludes the checkout night and the night before check-in", () => {
    expect(stayOnNight(wave, day(2026, 10, 12), [s])).toBeNull();
    expect(stayOnNight(wave, day(2026, 10, 8), [s])).toBeNull();
  });

  it("excludes other properties and seasonal closures", () => {
    expect(stayOnNight(PROPERTIES[1], day(2026, 10, 10), [s])).toBeNull();
    const closed = { ...s, closed: true };
    expect(stayOnNight(wave, day(2026, 10, 10), [closed])).toBeNull();
  });
});
