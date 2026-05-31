import type { TodoistApi } from "@doist/todoist-api-typescript";
import { addDays, subDays, isWithinInterval } from "date-fns";

import type { CalendarEvent } from "./types";

export const DOOR_CODE_LOCATIONS: readonly string[] = [
  "Nautical Nest",
  "Lake Breeze",
  "Wavesong",
];

export const TASK_TYPES = [
  "Send Welcome Letter",
  "Send Review Request",
  "Make Door Code",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

/**
 * Stable key written to each Todoist task's `description` field. This is what
 * `getExistingTaskIds` returns and what the dedup loop compares against.
 *
 * Do not change the format without a migration plan — old tasks already in
 * Todoist were written with this exact shape.
 */
export const createTaskId = (eventId: string, taskType: string): string =>
  `bnb-${eventId}-${taskType.toLowerCase().replace(/\s+/g, "-")}`;

const getDueDate = (event: CalendarEvent, taskType: TaskType): Date => {
  const start = new Date(event.start);
  const end = new Date(event.end);

  switch (taskType) {
    case "Send Welcome Letter":
      return subDays(start, 3);
    case "Send Review Request":
      return addDays(end, 2);
    case "Make Door Code":
      return subDays(start, 3);
  }
};

export interface SyncOptions {
  /** Window the calendar loop processes events in. */
  windowStart: Date;
  windowEnd: Date;
}

/**
 * Minimal slice of `TodoistApi` we depend on. Lets tests pass a mock without
 * pulling in the whole SDK.
 */
export interface TaskWriter {
  addTask: TodoistApi["addTask"];
}

/**
 * For each event in `events`, ensure the per-event Todoist tasks
 * (welcome / review / door-code-if-applicable) exist. Skips creation when the
 * generated task id is already present in `existingTaskIds`, and pushes every
 * newly created id back into that same array so a same-request duplicate
 * (e.g. two iCal feeds exporting the same booking UID) can't slip through.
 *
 * Mutates `existingTaskIds`.
 */
export async function syncTodoistTasksForLocation(
  events: CalendarEvent[],
  location: string,
  existingTaskIds: string[],
  api: TaskWriter,
  options: SyncOptions,
): Promise<void> {
  const { windowStart, windowEnd } = options;

  for (const event of events) {
    const eventDate = new Date(event.start);
    if (!isWithinInterval(eventDate, { start: windowStart, end: windowEnd })) {
      continue;
    }

    for (const taskType of TASK_TYPES) {
      if (
        taskType === "Make Door Code" &&
        !DOOR_CODE_LOCATIONS.includes(location)
      ) {
        continue;
      }

      const eventTaskId = createTaskId(event.id, taskType);

      if (existingTaskIds.includes(eventTaskId)) {
        continue;
      }

      const dueDate = getDueDate(event, taskType);
      if (
        !isWithinInterval(dueDate, { start: windowStart, end: windowEnd })
      ) {
        continue;
      }

      try {
        await api.addTask({
          content: `${taskType} (${event.title})`,
          description: eventTaskId,
          dueDate: dueDate.toISOString(),
          labels: [location],
        });
        // Track in the shared list so the same eventTaskId can't be created
        // twice within a single request (e.g. two feeds exporting one booking).
        existingTaskIds.push(eventTaskId);
      } catch (error) {
        const responseData = (error as { responseData?: unknown })?.responseData;
        console.error("Error adding task:", responseData ?? error);
      }
    }
  }
}
