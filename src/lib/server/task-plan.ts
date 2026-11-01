import {
  addDays,
  type Day,
  endOfDay,
  format,
  isBefore,
  isValid,
  isWithinInterval,
  min,
  nextDay,
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

export const TRASH_REMINDER = "Send Trash Reminder";

/** A generated task that's still open in Todoist */
export type OpenTask = {
  id: string;
  description: string;
  /** Todoist's due date: a day (`yyyy-MM-dd`) or a date-time */
  dueDate: string;
  labels: string[];
};

/** The bin collections the sync manages: the property's trash day, from tomorrow to SYNC_DAYS out */
export function trashDays(trashDay: Day, now: Date): Date[] {
  const { end } = syncWindow(now);
  const days: Date[] = [];
  for (let day = nextDay(startOfDay(now), trashDay); day <= end; day = addDays(day, 7)) {
    days.push(day);
  }
  return days;
}

/**
 * Who gets told to take the trash out for one collection, and on which day. The guest staying
 * the night before trash day hears that day. Failing that, the latest guest in the week since
 * the previous collection hears on their last night. With nobody there that week, nobody does.
 */
export function trashRecipient(events: CalendarEvent[], trashDay: Date) {
  const eve = subDays(trashDay, 1);
  const weekStart = subDays(trashDay, 7);
  let best: { event: CalendarEvent; day: Date } | null = null;

  for (const event of events) {
    if (isClosure(event)) continue;
    const day = min([subDays(checkOut(event), 1), eve]);
    if (isBefore(day, checkIn(event)) || isBefore(day, weekStart)) continue;
    if (!best || day > best.day) best = { event, day };
  }
  return best;
}

// The description of a trash reminder ends with its trash day, e.g. `-send-trash-reminder-2026-11-12`
const trashReminderDay = (description: string) =>
  description.match(/^bnb-.+-send-trash-reminder-(\d{4}-\d{2}-\d{2})$/)?.[1];

// The local day of a due date, whether it's a bare day or a UTC date-time. "" for none.
const dayOf = (dueDate: string) => {
  const date = parseISO(dueDate);
  return isValid(date) ? format(date, "yyyy-MM-dd") : "";
};

/**
 * Brings one property's trash reminders in line with its bookings. Unlike the other tasks, a
 * reminder moves: when a booking changes who should hear about a collection, or when, the
 * open reminder is removed and the right one created. A completed reminder is never redone.
 * `existing` holds the ids of every generated task (open or completed); `open` the open ones.
 */
export function planTrashReminders(
  events: CalendarEvent[],
  property: PropertyConfig,
  existing: ReadonlySet<string>,
  open: OpenTask[],
  now: Date,
): { create: NewTask[]; remove: string[] } {
  const today = startOfDay(now);
  const create: NewTask[] = [];
  const remove: string[] = [];

  for (const trashDay of trashDays(property.trashDay, now)) {
    const key = format(trashDay, "yyyy-MM-dd");
    const recipient = trashRecipient(events, trashDay);
    // Its day has passed, so there's nothing left to move
    if (recipient && isBefore(recipient.day, today)) continue;

    const wanted = recipient && {
      content: `${TRASH_REMINDER} (${recipient.event.title})`,
      description: `${taskId(recipient.event.id, TRASH_REMINDER)}-${key}`,
      dueDate: setHours(recipient.day, 11).toISOString(),
      labels: [property.name],
    };
    const current = open.filter(
      (task) => trashReminderDay(task.description) === key && task.labels.includes(property.name),
    );

    // Keep one open reminder if it's already right; remove every other
    let kept = false;
    for (const task of current) {
      const right =
        !kept &&
        task.description === wanted?.description &&
        dayOf(task.dueDate) === dayOf(wanted.dueDate);
      if (right) kept = true;
      else remove.push(task.id);
    }

    if (!wanted || kept) continue;
    const completed =
      existing.has(wanted.description) &&
      !current.some((task) => task.description === wanted.description);
    if (!completed) create.push(wanted);
  }
  return { create, remove };
}
