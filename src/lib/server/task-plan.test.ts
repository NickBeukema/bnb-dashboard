// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/lib/calendar-types";
import { PROPERTY_CONFIG } from "@/lib/properties";
import { planTasks, syncWindow, taskId } from "./task-plan";
import { todoistErrorMessage } from "./todoist";

const [wavesong, red] = PROPERTY_CONFIG;
// Noon on Wed Oct 7, 2026 in New York
const now = new Date("2026-10-07T16:00:00.000Z");

/** An event shaped like the API's: check-in at 11:00, end at the midnight after checkout */
const stay = (id: string, checkIn: string, checkOut: string, title = "Reserved - Jen"): CalendarEvent => ({
  id,
  title,
  start: new Date(`${checkIn}T11:00:00`).toISOString(),
  end: new Date(new Date(`${checkOut}T00:00:00`).getTime() + 24 * 3600e3).toISOString(),
  location: wavesong.name,
  backgroundColor: wavesong.color,
  allDay: true,
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

  it("ignores stays that started before today or start after the window", () => {
    const events = [stay("past", "2026-10-06", "2026-10-09"), stay("far", "2026-11-07", "2026-11-09")];
    expect(planTasks(events, wavesong, new Set(), now)).toEqual([]);
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
    expect(todoistErrorMessage({ responseData: "Rate limited", message: "Request failed" })).toBe("Rate limited");
    expect(todoistErrorMessage(new Error("Network down"))).toBe("Network down");
    expect(todoistErrorMessage(null)).toBe("Unknown error");
    expect(todoistErrorMessage({ responseData: { code: 1 } })).toBe("Unknown error");
  });
});
