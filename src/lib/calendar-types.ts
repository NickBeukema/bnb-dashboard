// The GET /api/calendar response, shared by the API route and the board

import { differenceInCalendarDays, parseISO } from "date-fns";

/** One booking or owner block */
export type CalendarEvent = {
  id: string;
  title: string;
  /** Local day, `yyyy-MM-dd` */
  checkIn: string;
  /** Local day, `yyyy-MM-dd`. The day the guest leaves, not the last night. */
  checkOut: string;
  description: string | null;
};

/** Owner blocks ("Blocked", "Not available") hold dates without a platform booking */
export const isOwnerBlock = (title: string) => /^blocked\b|not available/i.test(title);

/**
 * The longest owner block that is still a private booking. Private bookings get tasks like any
 * other stay; longer blocks close the property for the season and get none.
 */
export const PRIVATE_BOOKING_MAX_NIGHTS = 14;

export const nightsOf = (event: Pick<CalendarEvent, "checkIn" | "checkOut">) =>
  differenceInCalendarDays(parseISO(event.checkOut), parseISO(event.checkIn));

/** An owner block of more than two weeks: a seasonal closure, not a stay */
export const isClosure = (event: Pick<CalendarEvent, "title" | "checkIn" | "checkOut">) =>
  isOwnerBlock(event.title) && nightsOf(event) > PRIVATE_BOOKING_MAX_NIGHTS;

export type CalendarSource = {
  name: string;
  events: CalendarEvent[];
  color: string;
};

/** An open Todoist task, as the dashboards show it */
export type Task = {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  dueDate: string;
  priority: number;
  labels: string[];
};

export type CalendarResponse = {
  events: CalendarSource[];
  tasks: Task[];
  /** Properties whose feed couldn't be read this time. Their `events` are empty. */
  failed: string[];
  lastUpdated: string;
};
