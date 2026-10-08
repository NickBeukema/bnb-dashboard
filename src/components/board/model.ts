import type { CalendarSource, Task } from "@/app/api/calendar/route";
import type { CSSProperties } from "react";
import {
  differenceInCalendarDays,
  isBefore,
  parseISO,
  startOfDay,
  subHours,
} from "date-fns";

export type Property = {
  /** Matches the iCal source name and the Todoist label */
  name: string;
  /** CSS custom property holding the property's fill color (see board.css) */
  token: string;
  initial: string;
};

// Lane order on the calendar, and the order properties are listed everywhere else
export const PROPERTIES: Property[] = [
  { name: "Wavesong", token: "wavesong", initial: "W" },
  { name: "Red", token: "red-house", initial: "R" },
  { name: "Lake Breeze", token: "lake-breeze", initial: "L" },
  { name: "Nautical Nest", token: "nautical-nest", initial: "N" },
];

const FALLBACK: Property = { name: "Other", token: "muted-foreground", initial: "?" };

export const propertyByName = (name: string | undefined): Property =>
  PROPERTIES.find((p) => p.name === name) ?? { ...FALLBACK, name: name ?? "Other" };

/** Inline style that points `bg-(--prop)` / `text-(--prop-ink)` at a property's colors */
export const propertyStyle = (property: Property) =>
  ({
    "--prop": `var(--${property.token})`,
    "--prop-ink": `var(--${property.token}-ink, var(--background))`,
  }) as CSSProperties;

export type Stay = {
  id: string;
  property: Property;
  /** Guest name, or "Blocked" for owner blocks */
  guest: string;
  blocked: boolean;
  checkIn: Date;
  checkOut: Date;
  nights: number;
};

export type TaskKind = "welcome" | "door-code" | "review" | "other";

export type BoardTask = {
  id: string;
  kind: TaskKind;
  title: string;
  guest: string | null;
  property: Property | null;
  stayId: string | null;
  due: Date;
};

export type BoardData = {
  stays: Stay[];
  tasks: BoardTask[];
  lastUpdated: Date;
};

const guestFromTitle = (title: string) => title.replace(/^reserved\s*-\s*/i, "").trim();

export function toStays(sources: CalendarSource[]): Stay[] {
  return sources
    .flatMap((source) =>
      source.events.map((event): Stay => {
        // The API shifts all-day events for the old calendar: `start` is check-in day at
        // 11:00 and `end` is the midnight after checkout. Undo that into plain local days.
        const checkIn = startOfDay(parseISO(event.start));
        const checkOut = startOfDay(subHours(parseISO(event.end), 12));
        const guest = guestFromTitle(event.title);
        return {
          id: event.id,
          property: propertyByName(source.name),
          guest: guest || "Reserved",
          blocked: /^blocked\b|not available/i.test(event.title),
          checkIn,
          checkOut,
          nights: differenceInCalendarDays(checkOut, checkIn),
        };
      }),
    )
    .sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());
}

const TASK_ID = /^bnb-(.+)-(send-welcome-letter|send-review-request|make-door-code)$/;

const KIND_BY_SLUG: Record<string, TaskKind> = {
  "send-welcome-letter": "welcome",
  "send-review-request": "review",
  "make-door-code": "door-code",
};

export const TASK_LABEL: Record<TaskKind, string> = {
  welcome: "Welcome letter",
  "door-code": "Door code",
  review: "Review request",
  other: "To-do",
};

export function toTasks(tasks: Task[]): BoardTask[] {
  return tasks
    .filter((task) => !task.completed && task.dueDate)
    .map((task): BoardTask => {
      const match = TASK_ID.exec(task.description ?? "");
      // Generated names look like "Send Welcome Letter (Reserved - Jen)"
      const guest = /\(([^)]+)\)\s*$/.exec(task.name)?.[1];
      const kind = match ? KIND_BY_SLUG[match[2]] : "other";
      const label = task.labels.find((l) => PROPERTIES.some((p) => p.name === l));
      return {
        id: task.id,
        kind,
        title: kind === "other" ? task.name : TASK_LABEL[kind],
        guest: kind === "other" || !guest ? null : guestFromTitle(guest),
        property: label ? propertyByName(label) : null,
        stayId: match?.[1] ?? null,
        // Date-only values ("2026-10-07") must parse as local days, which parseISO does
        due: startOfDay(parseISO(task.dueDate)),
      };
    })
    .sort((a, b) => a.due.getTime() - b.due.getTime());
}

export const isOverdue = (task: BoardTask, today: Date) => isBefore(task.due, today);

/** Who is leaving and arriving at one property on one day */
export type Turnover = {
  property: Property;
  out: Stay | null;
  in: Stay | null;
};

export function movementsOn(day: Date, stays: Stay[]): Turnover[] {
  return PROPERTIES.flatMap((property) => {
    const own = stays.filter((s) => s.property.name === property.name && !s.blocked);
    const out = own.find((s) => differenceInCalendarDays(s.checkOut, day) === 0) ?? null;
    const arriving = own.find((s) => differenceInCalendarDays(s.checkIn, day) === 0) ?? null;
    return out || arriving ? [{ property, out, in: arriving }] : [];
  });
}

/** The stay a property is hosting on a given night, if any */
export const stayOnNight = (property: Property, day: Date, stays: Stay[]) =>
  stays.find(
    (s) =>
      s.property.name === property.name &&
      !s.blocked &&
      differenceInCalendarDays(day, s.checkIn) >= 0 &&
      differenceInCalendarDays(s.checkOut, day) > 0,
  ) ?? null;
