// The GET /api/calendar response, shared by the API route and both dashboards

/**
 * One booking or owner block. All-day events are shifted for the classic FullCalendar view:
 * `start` is check-in day at 11:00 and `end` is the midnight after checkout.
 */
export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
  description?: string | null;
  backgroundColor: string;
  allDay: boolean;
};

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
  lastUpdated: string;
};
