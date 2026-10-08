// The GET /api/calendar response, shared by the API route and the board

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

/** Owner blocks ("Blocked", "Not available") hold dates but have no guest */
export const isBlocked = (title: string) => /^blocked\b|not available/i.test(title);

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
