import { addDays, endOfDay, isWithinInterval, startOfDay, subDays } from "date-fns";
import type { CalendarEvent } from "@/lib/calendar-types";
import type { PropertyConfig } from "@/lib/properties";

/** How far ahead stays (and their tasks) are synced into Todoist */
export const SYNC_DAYS = 30;

type TaskType = {
  name: string;
  /** Only properties with smart locks need a door code */
  needsDoorCode?: boolean;
  due: (event: CalendarEvent) => Date;
};

export const TASK_TYPES: TaskType[] = [
  { name: "Send Welcome Letter", due: (e) => subDays(new Date(e.start), 3) },
  { name: "Send Review Request", due: (e) => addDays(new Date(e.end), 2) },
  { name: "Make Door Code", needsDoorCode: true, due: (e) => subDays(new Date(e.start), 3) },
];

/**
 * The id stored in a generated task's description, e.g. `bnb-<uid>-send-welcome-letter`.
 * It's how the sync recognises a task it already created, so the format can't change.
 */
export const taskId = (eventId: string, taskType: string) =>
  `bnb-${eventId}-${taskType.toLowerCase().replace(/\s+/g, "-")}`;

export type NewTask = {
  content: string;
  description: string;
  dueDate: string;
  labels: string[];
};

/** Today through SYNC_DAYS out: stays starting in it get tasks, and tasks must fall in it */
export const syncWindow = (now: Date) => ({
  start: startOfDay(now),
  end: endOfDay(addDays(now, SYNC_DAYS)),
});

/**
 * Which tasks one property's events still need. Pure: `existing` holds the ids of every task
 * already in Todoist (open or completed), and nothing is created twice within one plan.
 */
export function planTasks(
  events: CalendarEvent[],
  property: PropertyConfig,
  existing: ReadonlySet<string>,
  now: Date,
): NewTask[] {
  const window = syncWindow(now);
  const planned = new Set<string>();
  const tasks: NewTask[] = [];

  for (const event of events) {
    if (!isWithinInterval(new Date(event.start), window)) continue;

    for (const type of TASK_TYPES) {
      if (type.needsDoorCode && !property.doorCode) continue;

      const id = taskId(event.id, type.name);
      if (existing.has(id) || planned.has(id)) continue;

      const due = type.due(event);
      if (!isWithinInterval(due, window)) continue;

      planned.add(id);
      tasks.push({
        content: `${type.name} (${event.title})`,
        description: id,
        dueDate: due.toISOString(),
        labels: [property.name],
      });
    }
  }
  return tasks;
}
