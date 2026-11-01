// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/lib/calendar-types";
import { PROPERTY_CONFIG } from "@/lib/properties";
import {
  type OpenTask,
  planTasks,
  planTrashReminders,
  syncWindow,
  taskId,
  trashDays,
  trashRecipient,
} from "./task-plan";
import { todoistErrorMessage } from "./todoist";

const [wavesong, red, lakeBreeze] = PROPERTY_CONFIG;
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

describe("trashDays", () => {
  it("lists the property's collection days from tomorrow to the end of the window", () => {
    // Thursdays; today is Wednesday Oct 7
    expect(trashDays(wavesong.trashDay, now)).toEqual([
      new Date(2026, 9, 8),
      new Date(2026, 9, 15),
      new Date(2026, 9, 22),
      new Date(2026, 9, 29),
      new Date(2026, 10, 5),
    ]);
    // Mondays
    expect(trashDays(lakeBreeze.trashDay, now)).toEqual([
      new Date(2026, 9, 12),
      new Date(2026, 9, 19),
      new Date(2026, 9, 26),
      new Date(2026, 10, 2),
    ]);
  });

  it("starts tomorrow when today is trash day", () => {
    const thursday = new Date("2026-10-08T16:00:00.000Z");
    expect(trashDays(wavesong.trashDay, thursday)[0]).toEqual(new Date(2026, 9, 15));
  });
});

describe("trashRecipient", () => {
  // Trash day Thursday Oct 22: the eve is Wednesday Oct 21; the week runs from Oct 15
  const trashDay = new Date(2026, 9, 22);
  const recipient = (...events: CalendarEvent[]) => {
    const found = trashRecipient(events, trashDay);
    return found && [found.event.id, found.day];
  };

  it("picks the guest staying the night before trash day, on that day", () => {
    expect(recipient(stay("over", "2026-10-20", "2026-10-24"))).toEqual([
      "over",
      new Date(2026, 9, 21),
    ]);
    // Arriving on the eve still means a night there
    expect(recipient(stay("arrives", "2026-10-21", "2026-10-24"))).toEqual([
      "arrives",
      new Date(2026, 9, 21),
    ]);
  });

  it("otherwise picks the latest guest that week, on their last night", () => {
    // Leaves on the morning of the eve: last night is Oct 20
    expect(recipient(stay("leaves", "2026-10-18", "2026-10-21"))).toEqual([
      "leaves",
      new Date(2026, 9, 20),
    ]);
    expect(
      recipient(
        stay("early", "2026-10-15", "2026-10-17"),
        stay("later", "2026-10-18", "2026-10-20"),
      ),
    ).toEqual(["later", new Date(2026, 9, 19)]);
  });

  it("follows the Reema example: out on Mon Nov 9, nobody before Thu Nov 12, told on the 8th", () => {
    const found = trashRecipient(
      [stay("reema", "2026-11-05", "2026-11-09")],
      new Date(2026, 10, 12),
    );
    expect(found?.event.id).toBe("reema");
    expect(found?.day).toEqual(new Date(2026, 10, 8));
  });

  it("prefers the guest there the night before over one who left earlier", () => {
    expect(
      recipient(
        stay("left", "2026-10-16", "2026-10-19"),
        stay("there", "2026-10-21", "2026-10-23"),
      ),
    ).toEqual(["there", new Date(2026, 9, 21)]);
  });

  it("counts the night of the previous collection, but nothing before it", () => {
    // Last night Oct 15, the previous trash day
    expect(recipient(stay("edge", "2026-10-12", "2026-10-16"))).toEqual([
      "edge",
      new Date(2026, 9, 15),
    ]);
    // Last night Oct 14
    expect(recipient(stay("gone", "2026-10-10", "2026-10-15"))).toBeNull();
  });

  it("finds nobody when the guest only arrives on trash day", () => {
    expect(recipient(stay("late", "2026-10-22", "2026-10-25"))).toBeNull();
  });

  it("counts private bookings but not seasonal closures", () => {
    expect(recipient(stay("closed", "2026-10-01", "2027-04-01", "Blocked"))).toBeNull();
    expect(recipient(stay("private", "2026-10-20", "2026-10-23", "Blocked"))).toEqual([
      "private",
      new Date(2026, 9, 21),
    ]);
  });
});

describe("planTrashReminders", () => {
  const reminder = (id: string, trashDay: string) =>
    `${taskId(id, "Send Trash Reminder")}-${trashDay}`;
  const openTask = (
    id: string,
    description: string,
    dueDate: string,
    labels: string[] = ["Wavesong"],
  ): OpenTask => ({ id, description, dueDate, labels });
  const plan = (events: CalendarEvent[], open: OpenTask[] = [], existing = new Set<string>()) =>
    planTrashReminders(
      events,
      wavesong,
      new Set([...existing, ...open.map((t) => t.description)]),
      open,
      now,
    );

  it("plans a reminder at 11:00, labelled with the property, keyed by the trash day", () => {
    expect(plan([stay("s1", "2026-10-19", "2026-10-22")])).toEqual({
      create: [
        {
          content: "Send Trash Reminder (Reserved - Jen)",
          description: "bnb-s1-send-trash-reminder-2026-10-22",
          dueDate: new Date("2026-10-21T11:00:00").toISOString(),
          labels: ["Wavesong"],
        },
      ],
      remove: [],
    });
  });

  it("uses each property's own trash day", () => {
    // Lake Breeze collects on Monday Oct 12, so the guest hears on Sunday
    const { create } = planTrashReminders(
      [stay("s1", "2026-10-10", "2026-10-12")],
      lakeBreeze,
      new Set(),
      [],
      now,
    );
    expect(create.map((t) => [t.description, t.dueDate])).toEqual([
      ["bnb-s1-send-trash-reminder-2026-10-12", new Date("2026-10-11T11:00:00").toISOString()],
    ]);
  });

  it("reminds a guest who stays past trash day again on their last night", () => {
    // There the night before Oct 22, then the latest guest of the week before Oct 29
    const { create } = plan([stay("s1", "2026-10-20", "2026-10-24")]);
    expect(create.map((t) => [t.description, t.dueDate])).toEqual([
      ["bnb-s1-send-trash-reminder-2026-10-22", new Date("2026-10-21T11:00:00").toISOString()],
      ["bnb-s1-send-trash-reminder-2026-10-29", new Date("2026-10-23T11:00:00").toISOString()],
    ]);
  });

  it("keeps an open reminder that's still right", () => {
    const open = [openTask("t1", reminder("s1", "2026-10-22"), "2026-10-21T15:00:00Z")];
    expect(plan([stay("s1", "2026-10-19", "2026-10-22")], open)).toEqual({
      create: [],
      remove: [],
    });
  });

  it("moves the reminder when someone books nearer to trash day", () => {
    const open = [openTask("t1", reminder("early", "2026-10-22"), "2026-10-17T15:00:00Z")];
    const events = [
      stay("early", "2026-10-15", "2026-10-18"),
      stay("late", "2026-10-20", "2026-10-22"),
    ];
    const { create, remove } = plan(events, open);
    expect(remove).toEqual(["t1"]);
    expect(create.map((t) => [t.description, t.dueDate])).toEqual([
      ["bnb-late-send-trash-reminder-2026-10-22", new Date("2026-10-21T11:00:00").toISOString()],
    ]);
  });

  it("moves the reminder's day when the same guest's stay changes", () => {
    // Was out on Oct 18, now extended over trash day
    const open = [openTask("t1", reminder("s1", "2026-10-22"), "2026-10-17T15:00:00Z")];
    const { create, remove } = plan([stay("s1", "2026-10-15", "2026-10-24")], open);
    expect(remove).toEqual(["t1"]);
    expect(create.map((t) => [t.description, t.dueDate])).toContainEqual([
      "bnb-s1-send-trash-reminder-2026-10-22",
      new Date("2026-10-21T11:00:00").toISOString(),
    ]);
  });

  it("removes the reminder when nobody is staying that week any more", () => {
    const open = [openTask("t1", reminder("gone", "2026-10-22"), "2026-10-21T15:00:00Z")];
    expect(plan([], open)).toEqual({ create: [], remove: ["t1"] });
  });

  it("removes duplicates of an open reminder", () => {
    const open = [
      openTask("t1", reminder("s1", "2026-10-22"), "2026-10-21T15:00:00Z"),
      openTask("t2", reminder("s1", "2026-10-22"), "2026-10-21T15:00:00Z"),
    ];
    expect(plan([stay("s1", "2026-10-19", "2026-10-22")], open)).toEqual({
      create: [],
      remove: ["t2"],
    });
  });

  it("removes a reminder whose due date was taken off", () => {
    const open = [openTask("t1", reminder("s1", "2026-10-22"), "")];
    const { create, remove } = plan([stay("s1", "2026-10-19", "2026-10-22")], open);
    expect(remove).toEqual(["t1"]);
    expect(create).toHaveLength(1);
  });

  it("never redoes a completed reminder", () => {
    const done = new Set([reminder("s1", "2026-10-22")]);
    expect(plan([stay("s1", "2026-10-19", "2026-10-22")], [], done)).toEqual({
      create: [],
      remove: [],
    });
  });

  it("still reminds a nearer guest when the old recipient's reminder was completed", () => {
    const done = new Set([reminder("early", "2026-10-22")]);
    const events = [
      stay("early", "2026-10-15", "2026-10-18"),
      stay("late", "2026-10-20", "2026-10-23"),
    ];
    const { create } = plan(events, [], done);
    expect(create.map((t) => t.description)).toContain("bnb-late-send-trash-reminder-2026-10-22");
  });

  it("leaves a collection alone once its reminder day has passed", () => {
    // Trash day is tomorrow (Oct 8), but the guest left Oct 6, so their reminder was due Oct 5
    const open = [openTask("t1", reminder("old", "2026-10-08"), "2026-10-04T15:00:00Z")];
    expect(plan([stay("left", "2026-10-03", "2026-10-06")], open)).toEqual({
      create: [],
      remove: [],
    });
  });

  it("only touches this property's trash reminders", () => {
    const open = [
      openTask("red", reminder("r", "2026-10-22"), "2026-10-21T15:00:00Z", ["Red"]),
      openTask("letter", "bnb-s1-send-welcome-letter", "2026-10-21T15:00:00Z"),
    ];
    expect(plan([], open)).toEqual({ create: [], remove: [] });
  });

  it("plans nothing for seasonal closures", () => {
    expect(plan([stay("c1", "2026-10-01", "2027-04-01", "Blocked")])).toEqual({
      create: [],
      remove: [],
    });
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
