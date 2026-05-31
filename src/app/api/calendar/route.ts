import { BLUE, RED, GREEN, BROWN, GOLD } from "@/app/lib/data";
import { TodoistApi } from "@doist/todoist-api-typescript";
import { NextResponse } from "next/server";
import * as ical from "node-ical";
import {
  format,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
} from "date-fns";

import { paginateAll } from "./pagination";
import { createRunOnce } from "./syncLock";
import { syncTodoistTasksForLocation } from "./syncTasks";
import type { CalendarEvent, CalendarSource, Task } from "./types";

export type { CalendarEvent, CalendarSource, Task } from "./types";

// Environment variable validation
const TODOIST_API_TOKEN = process.env.TODOIST_API_TOKEN;

const WAVESONG_ICAL_URL = process.env.WAVESONG_ICAL_URL;
const RED_ICAL_URL = process.env.RED_ICAL_URL;
const LAKE_BREEZE_ICAL_URL = process.env.LAKE_BREEZE_ICAL_URL;
const BETSIE_ICAL_URL = process.env.BETSIE_ICAL_URL;
const BETSIE_AIRBNB_ICAL_URL = process.env.BETSIE_AIRBNB_ICAL_URL;
const NAUTICAL_NEST_ICAL_URL = process.env.NAUTICAL_NEST_ICAL_URL;

const validateEnvironmentVariables = () => {
  const requiredVars = [
    { name: "WAVESONG_ICAL_URL", value: WAVESONG_ICAL_URL },
    { name: "RED_ICAL_URL", value: RED_ICAL_URL },
    { name: "LAKE_BREEZE_ICAL_URL", value: LAKE_BREEZE_ICAL_URL },
    { name: "BETSIE_ICAL_URL", value: BETSIE_ICAL_URL },
    { name: "BETSIE_AIRBNB_ICAL_URL", value: BETSIE_AIRBNB_ICAL_URL },
    { name: "NAUTICAL_NEST_ICAL_URL", value: NAUTICAL_NEST_ICAL_URL },
    { name: "TODOIST_API_TOKEN", value: TODOIST_API_TOKEN },
  ];

  const missingVars = requiredVars.filter(({ value }) => !value);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars
        .map((v) => v.name)
        .join(", ")}`,
    );
  }
};

// How many months ahead to look for events / create tasks.
const DATE_RANGE_MONTHS = 1;

// Module-scoped single-flight gate for the Todoist creation pass. Prevents
// concurrent /api/calendar requests (e.g. two tabs) from both running the
// dedup-then-create loop against the same stale snapshot of existing tasks.
const runTaskSync = createRunOnce();

interface PropertyConfig {
  name: string;
  url: string;
  color: string;
  // Override FullCalendar's default event text color when the background is too
  // light for white text (e.g. Nautical Nest's gold).
  textColor?: string;
}

const PROPERTIES: PropertyConfig[] = [
  { name: "Wavesong", url: WAVESONG_ICAL_URL!, color: BLUE },
  { name: "Red", url: RED_ICAL_URL!, color: RED },
  { name: "Lake Breeze", url: LAKE_BREEZE_ICAL_URL!, color: GREEN },
  { name: "Betsie", url: BETSIE_ICAL_URL!, color: BROWN },
  { name: "Betsie Airbnb", url: BETSIE_AIRBNB_ICAL_URL!, color: BROWN },
  {
    name: "Nautical Nest",
    url: NAUTICAL_NEST_ICAL_URL!,
    color: GOLD,
    textColor: "black",
  },
];

/**
 * Parse an iCal feed into our calendar event shape. No side effects, no
 * Todoist calls — that lives in {@link syncTodoistTasksForLocation}.
 *
 * Preserves the `+11h` start / `+24h` end adjustments that FullCalendar needs
 * to display Airbnb's midnight-UTC dates on a US-Eastern calendar.
 */
const parseIcalEvents = async (
  url: string,
  color: string,
  location: string,
  textColor?: string,
): Promise<CalendarEvent[]> => {
  const response = await fetch(url, {
    // Next.js fetch cache: hold each feed for an hour to match the dashboard's
    // refresh cadence.
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch iCal data: ${response.statusText}`);
  }

  const icalData = await response.text();
  const events = await ical.async.parseICS(icalData);

  return Object.values(events)
    .filter((event) => event.type === "VEVENT")
    .map((event) => {
      const vevent = event as ical.VEvent;
      return {
        id: vevent.uid,
        title: vevent.summary,
        start: new Date(
          vevent.start.getTime() + 11 * 60 * 60 * 1000,
        ).toISOString(),
        end: new Date(vevent.end.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        location,
        description: vevent.description || null,
        backgroundColor: color,
        textColor,
        allDay: true,
      };
    });
};

const getExistingTaskIds = async (api: TodoistApi): Promise<string[]> => {
  // 5 days back covers Send Review Request (due 2 days after booking end);
  // +3 days at the far edge covers events that start at the end of the window.
  const taskStartDate = subDays(new Date(), 5);
  const taskEndDate = addDays(new Date(), DATE_RANGE_MONTHS * 30 + 3);

  const filterQuery = `date after: ${format(
    taskStartDate,
    "M/d/yyyy",
  )} & date before: ${format(taskEndDate, "M/d/yyyy")}`;

  const incompleteTasks = await paginateAll((cursor) =>
    api
      .getTasksByFilter({ query: filterQuery, cursor, limit: 200 })
      .then((r) => ({ items: r.results, nextCursor: r.nextCursor })),
  );
  const completedTasks = await paginateAll((cursor) =>
    api
      .getCompletedTasksByDueDate({
        since: taskStartDate.toISOString(),
        until: taskEndDate.toISOString(),
        cursor,
        limit: 200,
      })
      .then((r) => ({ items: r.items, nextCursor: r.nextCursor })),
  );

  return [
    ...incompleteTasks.map((t) => t.description),
    ...completedTasks.map((t) => t.description),
  ];
};

export async function GET() {
  try {
    validateEnvironmentVariables();
    const api = new TodoistApi(TODOIST_API_TOKEN!);

    // Always fetch event sources — this drives the calendar display and is
    // independent of any Todoist writes. Run in parallel since Next caches each.
    const eventResults = await Promise.allSettled(
      PROPERTIES.map((p) => parseIcalEvents(p.url, p.color, p.name, p.textColor)),
    );
    const eventsByProperty = eventResults.map((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `Error fetching events for ${PROPERTIES[index].name}:`,
          result.reason,
        );
        return [] as CalendarEvent[];
      }
      return result.value;
    });

    // Side effect: ensure every booking has its Todoist tasks. Single-flight
    // so two concurrent requests can't both fire the create loop against the
    // same stale snapshot of existing tasks.
    await runTaskSync(async () => {
      const existingTaskIds = await getExistingTaskIds(api);
      const windowStart = startOfDay(new Date());
      const windowEnd = endOfDay(addDays(new Date(), DATE_RANGE_MONTHS * 30));

      for (let i = 0; i < PROPERTIES.length; i++) {
        await syncTodoistTasksForLocation(
          eventsByProperty[i],
          PROPERTIES[i].name,
          existingTaskIds,
          api,
          { windowStart, windowEnd },
        );
      }
    });

    const formattedEvents: CalendarSource[] = [
      {
        name: "Wavesong",
        events: eventsByProperty[0],
        color: "#1e56b0",
      },
      {
        name: "Red",
        events: eventsByProperty[1],
        color: "#91231d",
      },
      {
        name: "Lake Breeze",
        events: eventsByProperty[2],
        color: "#21a677",
      },
      {
        name: "Betsie",
        events: eventsByProperty[3],
        color: "#4a120c",
      },
      {
        name: "Betsie Airbnb",
        events: eventsByProperty[4],
        color: "#4a120c",
      },
      {
        name: "Nautical Nest",
        events: eventsByProperty[5],
        color: "#ffd700",
      },
    ];

    let formattedTasks: Task[] = [];
    try {
      const tasks = await api.getTasks({ limit: 200 });
      formattedTasks = tasks.results
        .map((task) => ({
          id: task.id,
          name: task.content,
          description: task.description,
          completed: task.completedAt !== null,
          dueDate: task.due?.date || "",
          priority: task.priority,
          labels: task.labels,
        }))
        .sort(
          (a, b) =>
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
        );
    } catch (error) {
      const responseData = (error as { responseData?: unknown })?.responseData;
      console.error("Error fetching all tasks:", responseData ?? error);
    }

    return NextResponse.json(
      {
        events: formattedEvents,
        tasks: formattedTasks,
        lastUpdated: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in calendar API:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";

    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: errorMessage,
        events: [],
        tasks: [],
      },
      { status: 500 },
    );
  }
}
