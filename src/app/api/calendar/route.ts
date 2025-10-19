import { BLUE, RED, GREEN, BROWN } from "@/app/lib/data";
import {
  GetCompletedTasksResponse,
  GetTasksResponse,
  TodoistApi,
} from "@doist/todoist-api-typescript";
import { NextResponse } from "next/server";
import * as ical from "node-ical";

const WAVESONG_ICAL_URL = process.env.WAVESONG_ICAL_URL || "";
const RED_ICAL_URL = process.env.RED_ICAL_URL || "";
const LAKE_BREEZE_ICAL_URL = process.env.LAKE_BREEZE_ICAL_URL || "";
const BETSIE_ICAL_URL = process.env.BETSIE_ICAL_URL || "";
const BETSIE_AIRBNB_ICAL_URL = process.env.BETSIE_AIRBNB_ICAL_URL || "";

export type Task = {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  dueDate: string;
  priority: number;
  labels: string[];
};

const fetchIcal = async (
  url: string,
  color: string,
  location: string,
  incompleteTasks: GetTasksResponse,
  completedTasks: GetCompletedTasksResponse
): Promise<CalendarEvent[]> => {
  // Fetch the iCal data from the URL.
  const response = await fetch(url, {
    // Use Next.js's revalidation feature to cache the response for a specific time.
    // This prevents refetching on every request, which is more efficient.
    // Here, we cache for 1 hour (3600 seconds).
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    // If the fetch failed, return an error response.
    throw new Error(`Failed to fetch iCal data: ${response.statusText}`);
  }

  // Read the response body as text.
  const icalData = await response.text();

  // Parse the iCal data asynchronously.
  const events = await ical.async.parseICS(icalData);

  // Filter out non-event components and format the data for a clean API response.
  const formattedEvents: CalendarEvent[] = Object.values(events)
    .filter((event) => event.type === "VEVENT")
    .map((event) => {
      // We perform a type assertion here because we've already filtered for 'VEVENT'
      const vevent = event as ical.VEvent;
      return {
        id: vevent.uid,
        title: vevent.summary,
        start: new Date(
          vevent.start.getTime() + 11 * 60 * 60 * 1000
        ).toISOString(),
        end: new Date(vevent.end.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        location: location,
        description: vevent.description || null,
        backgroundColor: color,
        allDay: true,
      };
    });

  // Tasks to create
  // 1. Welcome Letter - 3 days before the event
  // 2. Send Review Request - 2 days after the event
  // 3. (Lake Breeze Only) Make Door Code - 3 days before the event

  // Get all events that start on or after today, and before two months out
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);

  const incompleteTaskIds = incompleteTasks.results.map(
    (task) => task.description
  );
  const completedTaskIds = completedTasks.items.map((task) => task.description);
  const fullTaskIds = [...incompleteTaskIds, ...completedTaskIds];

  const api = new TodoistApi(process.env.TODOIST_API_TOKEN || "");

  for (const event of formattedEvents) {
    const eventDate = new Date(event.start);
    if (eventDate < startDate || eventDate > endDate) {
      continue;
    }

    // Determine what tasks to create for the calendar
    console.log(event.title, event.id);

    for (const taskType of [
      "Send Welcome Letter",
      "Send Review Request",
      "Make Door Code",
    ]) {
      const eventTaskId = `${event.id}-${taskType}`;

      if (fullTaskIds.includes(eventTaskId)) {
        continue;
      }

      if (taskType === "Make Door Code" && location !== "Lake Breeze") {
        continue;
      }

      const getDueDate = (e: CalendarEvent, t: string) => {
        const start = new Date(e.start);
        const end = new Date(e.end);

        switch (t) {
          case "Send Welcome Letter":
            start.setDate(start.getDate() - 3);
            return start;
          case "Send Review Request":
            end.setDate(end.getDate() + 2);
            return end;
          case "Make Door Code":
            start.setDate(start.getDate() - 3);
            return start;
        }

        throw new Error(`Invalid task type: ${t}`);
      };

      // await api.addTask({
      //   content: `${taskType} (${event.title})`,
      //   description: eventTaskId,
      //   dueDate: getDueDate(event, taskType).toISOString(),
      //   labels: [location],
      // });

      console.log("--------------------------------");
      console.log(event.title, event.id, taskType);
      console.log("Start:", event.start, "End:", event.end);
      console.log("Due Date:", getDueDate(event, taskType));
      console.log("--------------------------------");

      continue;
    }
    continue;
  }

  return formattedEvents;
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
  backgroundColor: string;
  allDay: boolean;
};

export type CalendarSource = {
  name: string;
  events: CalendarEvent[];
  color: string;
};

/**
 * Handles GET requests to /api/calendar.
 * Fetches and parses iCal data from a specified URL, then returns it as JSON.
 *
 * @param {Request} request - The incoming request object.
 * @returns {Promise<NextResponse>} A promise that resolves to the response.
 */
export async function GET(request: Request) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 5);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 5);
  endDate.setMonth(endDate.getMonth() + 1);

  const api = new TodoistApi(process.env.TODOIST_API_TOKEN || "");
  // date after: May 5 or date after: 5/5
  const filterQuery = `date after: ${startDate.toLocaleDateString()} & date before: ${endDate.toLocaleDateString()}`;
  console.log(filterQuery);

  const incompleteTasks = await api.getTasksByFilter({
    query: filterQuery,
  });

  const completedTasks = await api.getCompletedTasksByDueDate({
    since: startDate.toISOString(),
    until: endDate.toISOString(),
  });

  try {
    const wavesongEvents = await fetchIcal(
      WAVESONG_ICAL_URL,
      BLUE,
      "Wavesong",
      incompleteTasks,
      completedTasks
    );
    const redEvents = await fetchIcal(
      RED_ICAL_URL,
      RED,
      "Red",
      incompleteTasks,
      completedTasks
    );
    const lakeBreezeEvents = await fetchIcal(
      LAKE_BREEZE_ICAL_URL,
      GREEN,
      "Lake Breeze",
      incompleteTasks,
      completedTasks
    );
    const betsieEvents = await fetchIcal(
      BETSIE_ICAL_URL,
      BROWN,
      "Betsie",
      incompleteTasks,
      completedTasks
    );
    const betsieAirbnbEvents = await fetchIcal(
      BETSIE_AIRBNB_ICAL_URL,
      BROWN,
      "Betsie Airbnb",
      incompleteTasks,
      completedTasks
    );

    const formattedEvents = [
      {
        name: "Wavesong",
        events: wavesongEvents,
        color: "#1e56b0",
      },
      {
        name: "Red",
        events: redEvents,
        color: "#91231d",
      },
      {
        name: "Lake Breeze",
        events: lakeBreezeEvents,
        color: "#21a677",
      },
      {
        name: "Betsie",
        events: betsieEvents,
        color: "#4a120c",
      },
      {
        name: "Betsie Airbnb",
        events: betsieAirbnbEvents,
        color: "#4a120c",
      },
    ];

    const tasks = await api.getTasks();
    const formattedTasks: Task[] = tasks.results
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
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );

    // Return the formatted events as a JSON response.
    return NextResponse.json(
      { events: formattedEvents, tasks: formattedTasks },
      { status: 200 }
    );
  } catch (error) {
    // Handle any unexpected errors during the process.
    console.error("Error fetching or parsing iCal data:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}
