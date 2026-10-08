import { TodoistApi } from "@doist/todoist-sdk";
import { NextResponse } from "next/server";
import type { CalendarSource } from "@/lib/calendar-types";
import { PROPERTY_CONFIG } from "@/lib/properties";
import { fetchFeed } from "@/lib/server/ical";
import { planTasks } from "@/lib/server/task-plan";
import {
  createTasks,
  fetchExistingTaskIds,
  fetchOpenTasks,
  todoistErrorMessage,
} from "@/lib/server/todoist";

/** Reads the feed URLs and Todoist token, naming every missing one */
function readConfig() {
  const feeds = PROPERTY_CONFIG.map((property) => ({
    property,
    url: process.env[property.icalEnv],
  }));
  const token = process.env.TODOIST_API_TOKEN;

  const missing = [
    ...feeds.filter((f) => !f.url).map((f) => f.property.icalEnv),
    ...(token ? [] : ["TODOIST_API_TOKEN"]),
  ];
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  return { feeds: feeds as { property: (typeof feeds)[number]["property"]; url: string }[], token: token! };
}

/**
 * Syncs the booking feeds into Todoist tasks, then returns the bookings and open tasks.
 * Every feed is downloaded before any task is created, so one broken feed can't leave
 * the sync half done.
 */
async function loadCalendar(): Promise<{ body: object; status: number }> {
  try {
    const { feeds, token } = readConfig();
    const api = new TodoistApi(token);
    const now = new Date();

    const existing = await fetchExistingTaskIds(api, now);
    const sources: CalendarSource[] = await Promise.all(
      feeds.map(async ({ property, url }) => ({
        name: property.name,
        events: await fetchFeed(url, property),
        color: property.color,
      })),
    );

    let created = 0;
    for (const [i, source] of sources.entries()) {
      const added = await createTasks(api, planTasks(source.events, feeds[i].property, existing, now));
      for (const task of added) existing.add(task.description);
      created += added.length;
    }
    if (created > 0) console.log(`Todoist sync: created ${created} task(s)`);

    let tasks: Awaited<ReturnType<typeof fetchOpenTasks>> = [];
    try {
      tasks = await fetchOpenTasks(api);
    } catch (error) {
      // Still show the calendar if only the task list fails
      console.error("Error fetching all tasks:", todoistErrorMessage(error));
    }

    return {
      body: { events: sources, tasks, lastUpdated: now.toISOString() },
      status: 200,
    };
  } catch (error) {
    console.error("Error in calendar API:", error);
    return {
      body: {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "An unknown error occurred",
        events: [],
        tasks: [],
      },
      status: 500,
    };
  }
}

// The kitchen TV and phones all poll this route. Requests that arrive while a sync is
// already running share its result, so two syncs can't race and create the same task twice.
let inFlight: Promise<{ body: object; status: number }> | null = null;

export async function GET() {
  inFlight ??= loadCalendar().finally(() => {
    inFlight = null;
  });
  const { body, status } = await inFlight;
  return NextResponse.json(body, { status });
}
