export type Task = {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  dueDate: string;
  priority: number;
  labels: string[];
};

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
