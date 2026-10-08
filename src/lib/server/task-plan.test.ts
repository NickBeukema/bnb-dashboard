// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/lib/calendar-types";
import { PROPERTY_CONFIG } from "@/lib/properties";
import { planTasks, syncWindow, taskId } from "./task-plan";
import { todoistErrorMessage } from "./todoist";

const [wavesong, red] = PROPERTY_CONFIG;
// Noon on Wed Oct 7, 2026 in New York
const now = new Date("2026-10-07T16:00:00.000Z");

const stay = (
  id: string,
  checkIn: string,
  checkOut: string,
  title = "Reserved - Jen",
): CalendarEvent => ({
  id,
  title,
  checkIn,
  checkOut,
  description: null,
});

describe("taskId", () => {
  it("slugs the task type after the event uid", () => {
    expect(taskId("abc", "Send Welcome Letter")).toBe("bnb-abc-send-welcome-letter");
  });
});

describe("syncWindow", () => {
  it("runs from the start of today to the end of the day 30 days out", () => {
    const { start, end } = syncWindow(now);
    expect(start).toEqual(new Date(2026, 9, 7));
    expect(end).toEqual(new Date(2026, 10, 6, 23, 59, 59, 999));
  });
});

describe("planTasks", () => {
  it("plans all three tasks, labelled with the property, for a property with door codes", () => {
    const tasks = planTasks([stay("s1", "2026-10-12", "2026-10-15")], wavesong, new Set(), now);
    expect(tasks).toEqual([
      {
        content: "Send Welcome Letter (Reserved - Jen)",
        description: "bnb-s1-send-welcome-letter",
        dueDate: new Date("2026-10-09T11:00:00").toISOString(),
        labels: ["Wavesong"],
      },
      {
        content: "Send Review Request (Reserved - Jen)",
        description: "bnb-s1-send-review-request",
        dueDate: new Date("2026-10-18T00:00:00").toISOString(),
        labels: ["Wavesong"],
      },
      {
        content: "Make Door Code (Reserved - Jen)",
        description: "bnb-s1-make-door-code",
        dueDate: new Date("2026-10-09T11:00:00").toISOString(),
        labels: ["Wavesong"],
      },
    ]);
  });

  it("skips door codes where the property doesn't need them", () => {
    const tasks = planTasks([stay("s1", "2026-10-12", "2026-10-15")], red, new Set(), now);
    expect(tasks.map((t) => t.description)).toEqual([
      "bnb-s1-send-welcome-letter",
      "bnb-s1-send-review-request",
    ]);
  });

  it("skips tasks that already exist", () => {
    const tasks = planTasks(
      [stay("s1", "2026-10-12", "2026-10-15")],
      wavesong,
      new Set(["bnb-s1-send-welcome-letter", "bnb-s1-make-door-code"]),
      now,
    );
    expect(tasks.map((t) => t.description)).toEqual(["bnb-s1-send-review-request"]);
  });

  it("plans a repeated event only once", () => {
    const event = stay("s1", "2026-10-12", "2026-10-15");
    expect(planTasks([event, event], red, new Set(), now)).toHaveLength(2);
  });

  it("plans the welcome letter and door code from check-in, which must be in the window", () => {
    const events = [
      stay("past", "2026-10-06", "2026-10-20"),
      stay("far", "2026-11-07", "2026-11-09"),
    ];
    const descriptions = planTasks(events, wavesong, new Set(), now).map((t) => t.description);
    expect(descriptions).not.toContain("bnb-past-send-welcome-letter");
    expect(descriptions).not.toContain("bnb-far-send-welcome-letter");
    expect(descriptions).not.toContain("bnb-far-make-door-code");
  });

  it("plans the review request from checkout, even for a stay that began before today", () => {
    // Checked in last week (before the window), checks out Oct 20
    const tasks = planTasks([stay("past", "2026-09-28", "2026-10-20")], wavesong, new Set(), now);
    expect(tasks).toEqual([
      {
        content: "Send Review Request (Reserved - Jen)",
        description: "bnb-past-send-review-request",
        dueDate: new Date("2026-10-23T00:00:00").toISOString(),
        labels: ["Wavesong"],
      },
    ]);
  });

  it("plans the review request for a long stay once its checkout comes into range", () => {
    // Checks in Oct 25, out Nov 20: the review request (Nov 23) is past the window today...
    const long = stay("long", "2026-10-25", "2026-11-20");
    expect(planTasks([long], red, new Set(), now).map((t) => t.description)).toEqual([
      "bnb-long-send-welcome-letter",
    ]);
    // ...and comes due after check-in, when the old start-date rule no longer saw the stay
    const later = new Date("2026-10-27T16:00:00.000Z");
    const existing = new Set(["bnb-long-send-welcome-letter"]);
    expect(planTasks([long], red, existing, later).map((t) => t.description)).toEqual([
      "bnb-long-send-review-request",
    ]);
  });

  it("plans every task for private bookings (owner blocks of two weeks or less)", () => {
    const events = [
      stay("b1", "2026-10-12", "2026-10-15", "Blocked"),
      stay("b2", "2026-10-12", "2026-10-26", "Airbnb (Not available)"),
    ];
    expect(planTasks(events, wavesong, new Set(), now).map((t) => t.description)).toEqual([
      "bnb-b1-send-welcome-letter",
      "bnb-b1-send-review-request",
      "bnb-b1-make-door-code",
      "bnb-b2-send-welcome-letter",
      "bnb-b2-send-review-request",
      "bnb-b2-make-door-code",
    ]);
  });

  it("plans nothing for seasonal closures (owner blocks over two weeks)", () => {
    const events = [
      stay("c1", "2026-10-12", "2026-10-27", "Blocked"),
      stay("c2", "2026-10-12", "2027-04-15", "Airbnb (Not available)"),
    ];
    expect(planTasks(events, wavesong, new Set(), now)).toEqual([]);
  });

  // Due times are local wall-clock times, whatever the clocks do in between
  it.each([
    [
      "clocks fall back on checkout day",
      "2026-10-28",
      "2026-11-01",
      "2026-10-25T11:00:00",
      "2026-11-04T00:00:00",
    ],
    [
      "clocks fall back the day before the welcome letter",
      "2026-11-04",
      "2026-11-06",
      "2026-11-01T11:00:00",
      "2026-11-09T00:00:00",
    ],
  ])("keeps due times on the hour when the %s", (_, checkIn, checkOut, welcome, review) => {
    const later = new Date("2026-10-24T16:00:00.000Z");
    const tasks = planTasks([stay("dst", checkIn, checkOut)], red, new Set(), later);
    expect(tasks.map((t) => t.dueDate)).toEqual([
      new Date(welcome).toISOString(),
      new Date(review).toISOString(),
    ]);
  });

  it("skips tasks due before today or after the window", () => {
    // Check-in tomorrow: the welcome letter and door code were due 2 days ago
    const soon = planTasks([stay("soon", "2026-10-08", "2026-10-10")], wavesong, new Set(), now);
    expect(soon.map((t) => t.description)).toEqual(["bnb-soon-send-review-request"]);

    // Checks out near the end of the window: the review request falls after it
    const late = planTasks([stay("late", "2026-11-01", "2026-11-05")], wavesong, new Set(), now);
    expect(late.map((t) => t.description)).toEqual([
      "bnb-late-send-welcome-letter",
      "bnb-late-make-door-code",
    ]);
  });
});

describe("todoistErrorMessage", () => {
  it("prefers Todoist's response body, then the error message", () => {
    expect(todoistErrorMessage({ responseData: "Rate limited", message: "Request failed" })).toBe(
      "Rate limited",
    );
    expect(todoistErrorMessage(new Error("Network down"))).toBe("Network down");
    expect(todoistErrorMessage(null)).toBe("Unknown error");
    expect(todoistErrorMessage({ responseData: { code: 1 } })).toBe("Unknown error");
  });
});
