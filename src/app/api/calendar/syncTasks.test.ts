import { describe, it, expect, vi } from "vitest";
import { addDays, startOfDay, endOfDay } from "date-fns";

import {
  createTaskId,
  syncTodoistTasksForLocation,
  type TaskWriter,
} from "./syncTasks";
import type { CalendarEvent } from "./types";

const makeWindow = () => ({
  windowStart: startOfDay(new Date()),
  windowEnd: endOfDay(addDays(new Date(), 30)),
});

const makeEvent = (id: string, startsInDays = 10): CalendarEvent => {
  const start = addDays(new Date(), startsInDays);
  const end = addDays(start, 4);
  return {
    id,
    title: `Booking ${id}`,
    start: start.toISOString(),
    end: end.toISOString(),
    location: null,
    backgroundColor: "#000",
    allDay: true,
  };
};

const makeWriter = (): TaskWriter & {
  addTask: ReturnType<typeof vi.fn>;
} => ({
  addTask: vi.fn().mockResolvedValue({ id: "fake-task" }),
});

describe("createTaskId", () => {
  it("kebab-cases the task type so the dedup key is stable", () => {
    expect(createTaskId("evt-1", "Send Welcome Letter")).toBe(
      "bnb-evt-1-send-welcome-letter",
    );
    expect(createTaskId("evt-2", "Make Door Code")).toBe(
      "bnb-evt-2-make-door-code",
    );
  });
});

describe("syncTodoistTasksForLocation", () => {
  it("skips creating tasks whose id is already in existingTaskIds", async () => {
    const api = makeWriter();
    const event = makeEvent("evtA");
    const existing = [
      createTaskId("evtA", "Send Welcome Letter"),
      createTaskId("evtA", "Send Review Request"),
    ];

    await syncTodoistTasksForLocation(
      [event],
      "Red",
      existing,
      api,
      makeWindow(),
    );

    expect(api.addTask).not.toHaveBeenCalled();
  });

  it("creates welcome + review tasks for a non-door-code location", async () => {
    const api = makeWriter();
    const event = makeEvent("evtB");
    const existing: string[] = [];

    await syncTodoistTasksForLocation(
      [event],
      "Red",
      existing,
      api,
      makeWindow(),
    );

    expect(api.addTask).toHaveBeenCalledTimes(2);
    const descriptions = api.addTask.mock.calls.map(
      ([args]) => (args as { description: string }).description,
    );
    expect(descriptions).toContain(createTaskId("evtB", "Send Welcome Letter"));
    expect(descriptions).toContain(createTaskId("evtB", "Send Review Request"));
    expect(descriptions).not.toContain(createTaskId("evtB", "Make Door Code"));
  });

  it("also creates a door-code task for Wavesong, Lake Breeze, Nautical Nest", async () => {
    for (const location of ["Wavesong", "Lake Breeze", "Nautical Nest"]) {
      const api = makeWriter();
      await syncTodoistTasksForLocation(
        [makeEvent(`evt-${location}`)],
        location,
        [],
        api,
        makeWindow(),
      );
      const descriptions = api.addTask.mock.calls.map(
        ([args]) => (args as { description: string }).description,
      );
      expect(descriptions).toContain(
        createTaskId(`evt-${location}`, "Make Door Code"),
      );
    }
  });

  // The bug this test pins down: before the fix, two events with the same UID
  // in the same request would dedup-miss because the in-memory existingTaskIds
  // was not updated after addTask. The fix pushes each created id back in.
  it("does not create duplicate tasks when the same event UID appears twice", async () => {
    const api = makeWriter();
    const sharedUid = "shared-uid";
    const events = [makeEvent(sharedUid), makeEvent(sharedUid)];
    const existing: string[] = [];

    await syncTodoistTasksForLocation(
      events,
      "Red",
      existing,
      api,
      makeWindow(),
    );

    // Only one welcome + one review for the duplicated UID — not four total.
    expect(api.addTask).toHaveBeenCalledTimes(2);
    expect(existing).toContain(createTaskId(sharedUid, "Send Welcome Letter"));
    expect(existing).toContain(createTaskId(sharedUid, "Send Review Request"));
  });

  it("skips events whose start date is outside the window", async () => {
    const api = makeWriter();
    const farFuture = makeEvent("evt-future", 200);
    const existing: string[] = [];

    await syncTodoistTasksForLocation(
      [farFuture],
      "Red",
      existing,
      api,
      makeWindow(),
    );

    expect(api.addTask).not.toHaveBeenCalled();
  });

  it("swallows addTask errors but does not push the failed id into existingTaskIds", async () => {
    const api = makeWriter();
    api.addTask.mockRejectedValueOnce(new Error("nope"));
    const existing: string[] = [];

    await syncTodoistTasksForLocation(
      [makeEvent("evtErr")],
      "Red",
      existing,
      api,
      makeWindow(),
    );

    // First call (welcome) rejected; second (review) succeeded → only review is tracked.
    expect(existing).not.toContain(createTaskId("evtErr", "Send Welcome Letter"));
    expect(existing).toContain(createTaskId("evtErr", "Send Review Request"));
  });
});
