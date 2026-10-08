import {
  addDays,
  endOfDay,
  isWithinInterval,
  parseISO,
  setHours,
  startOfDay,
  subDays,
} from "date-fns";
import { type CalendarEvent, isClosure } from "@/lib/calendar-types";
import type { PropertyConfig } from "@/lib/properties";

/** How far ahead stays (and their tasks) are synced into Todoist */
export const SYNC_DAYS = 30;

type TaskType = {
  name: string;
  /** Only properties with smart locks need a door code */
  needsDoorCode?: boolean;
  /** The stay day the task hangs off. It must fall in the sync window for the task to be planned. */
  anchor: (event: CalendarEvent) => Date;
  due: (event: CalendarEvent) => Date;
};

// Both are local midnight, parsed from `yyyy-MM-dd`
const checkIn = (e: CalendarEvent) => parseISO(e.checkIn);
const checkOut = (e: CalendarEvent) => parseISO(e.checkOut);
// 11:00, three days before check-in
const beforeArrival = (e: CalendarEvent) => setHours(subDays(checkIn(e), 3), 11);

export const TASK_TYPES: TaskType[] = [
  { name: "Send Welcome Letter", anchor: checkIn, due: beforeArrival },
  // Anchored on checkout, so stays that began before today (or long stays) still get one.
  // Due at the start of the third day after checkout.
  { name: "Send Review Request", anchor: checkOut, due: (e) => addDays(checkOut(e), 3) },
  { name: "Make Door Code", needsDoorCode: true, anchor: checkIn, due: beforeArrival },
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

/** Today through SYNC_DAYS out: a task's anchor day and its due date must both fall in it */
export const syncWindow = (now: Date) => ({
  start: startOfDay(now),
  end: endOfDay(addDays(now, SYNC_DAYS)),
});

/**
 * Which tasks one property's events still need. Pure: `existing` holds the ids of every task
 * already in Todoist (open or completed), and nothing is created twice within one plan.
 * Private bookings (short owner blocks) get tasks like any stay; seasonal closures get none.
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
    if (isClosure(event)) continue;

    for (const type of TASK_TYPES) {
      if (type.needsDoorCode && !property.doorCode) continue;
      if (!isWithinInterval(type.anchor(event), window)) continue;

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
