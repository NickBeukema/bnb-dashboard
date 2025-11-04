import { BLUE, RED, GREEN, BROWN } from "@/app/lib/data";
import {
  GetCompletedTasksResponse,
  GetTasksResponse,
  TodoistApi,
} from "@doist/todoist-api-typescript";
import { NextResponse } from "next/server";
import * as ical from "node-ical";
import {
  format,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
  isWithinInterval,
} from "date-fns";

// Environment variable validation
const WAVESONG_ICAL_URL = process.env.WAVESONG_ICAL_URL;
const RED_ICAL_URL = process.env.RED_ICAL_URL;
const LAKE_BREEZE_ICAL_URL = process.env.LAKE_BREEZE_ICAL_URL;
const BETSIE_ICAL_URL = process.env.BETSIE_ICAL_URL;
const BETSIE_AIRBNB_ICAL_URL = process.env.BETSIE_AIRBNB_ICAL_URL;
const TODOIST_API_TOKEN = process.env.TODOIST_API_TOKEN;

// Validate required environment variables
const validateEnvironmentVariables = () => {
  const requiredVars = [
    { name: "WAVESONG_ICAL_URL", value: WAVESONG_ICAL_URL },
    { name: "RED_ICAL_URL", value: RED_ICAL_URL },
    { name: "LAKE_BREEZE_ICAL_URL", value: LAKE_BREEZE_ICAL_URL },
    { name: "BETSIE_ICAL_URL", value: BETSIE_ICAL_URL },
    { name: "BETSIE_AIRBNB_ICAL_URL", value: BETSIE_AIRBNB_ICAL_URL },
    { name: "TODOIST_API_TOKEN", value: TODOIST_API_TOKEN },
  ];

  const missingVars = requiredVars.filter(({ value }) => !value);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars
        .map((v) => v.name)
        .join(", ")}`
    );
  }
};

// Configuration constants
const TIMEZONE = "America/New_York"; // Adjust based on your location
const DATE_RANGE_MONTHS = 1; // How many months ahead to look for events

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
  existingTaskIds: string[]
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

      // PRESERVE the exact date adjustments that work for calendar display
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

  // Get all events that start on or after today, and before configured months out
  const startDate = startOfDay(new Date());
  const endDate = endOfDay(addDays(new Date(), DATE_RANGE_MONTHS * 30));

  // Create a more reliable task identification system
  const createTaskId = (eventId: string, taskType: string) =>
    `bnb-${eventId}-${taskType.toLowerCase().replace(/\s+/g, "-")}`;

  const api = new TodoistApi(TODOIST_API_TOKEN!);

  for (const event of formattedEvents) {
    const eventDate = new Date(event.start);
    if (!isWithinInterval(eventDate, { start: startDate, end: endDate })) {
      continue;
    }

    // Determine what tasks to create for the calendar
    console.log(`Processing event: ${event.title} (${event.id})`);

    for (const taskType of [
      "Send Welcome Letter",
      "Send Review Request",
      "Make Door Code",
    ]) {
      // Skip Make Door Code task for non-Lake Breeze locations
      if (taskType === "Make Door Code" && location !== "Lake Breeze") {
        continue;
      }

      const eventTaskId = createTaskId(event.id, taskType);

      if (existingTaskIds.includes(eventTaskId)) {
        console.log(`Task already exists: ${eventTaskId}`);
        continue;
      }

      const getDueDate = (e: CalendarEvent, t: string): Date => {
        const start = new Date(e.start);
        const end = new Date(e.end);

        switch (t) {
          case "Send Welcome Letter":
            return subDays(start, 3);
          case "Send Review Request":
            return addDays(end, 2);
          case "Make Door Code":
            return subDays(start, 3);
          default:
            throw new Error(`Invalid task type: ${t}`);
        }
      };

      console.log("Adding Task: ", `${taskType} (${event.title})`, eventTaskId);

      const dueDate = getDueDate(event, taskType);
      if (!isWithinInterval(dueDate, { start: startDate, end: endDate })) {
        console.log("Due date is beyond the date range, skipping", dueDate);
        continue;
      }

      try {
        await api.addTask({
          content: `${taskType} (${event.title})`,
          description: eventTaskId,
          dueDate: getDueDate(event, taskType).toISOString(),
          labels: [location],
        });
      } catch (error) {
        console.error("Error adding task:", error.responseData);
      }

      console.log("--------------------------------");
      console.log(`Event: ${event.title} (${event.id})`);
      console.log(`Task Type: ${taskType}`);
      console.log(`Event Start: ${event.start}, End: ${event.end}`);
      console.log(`Due Date: ${getDueDate(event, taskType).toISOString()}`);
      console.log(`Task ID: ${eventTaskId}`);
      console.log("--------------------------------");
    }
  }

  return formattedEvents;
};

const getExistingTaskIds = async (): Promise<string[]> => {
  const api = new TodoistApi(TODOIST_API_TOKEN!);

  // Set up date range for task filtering (5 days back, 1 month ahead)
  const taskStartDate = subDays(new Date(), 5);

  // Fetch tasks for the next 3 days after the end of the date range
  // due to tasks being created 2 days after the event ends
  const taskEndDate = addDays(new Date(), DATE_RANGE_MONTHS * 30 + 3);

  // Create more readable filter query
  const filterQuery = `date after: ${format(
    taskStartDate,
    "M/d/yyyy"
  )} & date before: ${format(taskEndDate, "M/d/yyyy")}`;
  console.log(`Todoist filter query: ${filterQuery}`);

  // Fetch tasks from Todoist with error handling
  const incompleteTasks: GetTasksResponse = await api.getTasksByFilter({
    query: filterQuery,
  });
  const completedTasks: GetCompletedTasksResponse =
    await api.getCompletedTasksByDueDate({
      since: taskStartDate.toISOString(),
      until: taskEndDate.toISOString(),
    });

  const incompleteTaskIds = incompleteTasks.results.map(
    (task) => task.description
  );
  const completedTaskIds = completedTasks.items.map((task) => task.description);
  const existingTaskIds = [...incompleteTaskIds, ...completedTaskIds];
  return existingTaskIds;
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
  try {
    // Validate environment variables first
    validateEnvironmentVariables();

    const existingTaskIds = await getExistingTaskIds();

    // Fetch events from all iCal sources with error handling
    const wavesongEvents = await fetchIcal(
      WAVESONG_ICAL_URL!,
      BLUE,
      "Wavesong",
      existingTaskIds
    );
    const redEvents = await fetchIcal(
      RED_ICAL_URL!,
      RED,
      "Red",
      existingTaskIds
    );
    const lakeBreezeEvents = await fetchIcal(
      LAKE_BREEZE_ICAL_URL!,
      GREEN,
      "Lake Breeze",
      existingTaskIds
    );
    const betsieEvents = await fetchIcal(
      BETSIE_ICAL_URL!,
      BROWN,
      "Betsie",
      existingTaskIds
    );
    const betsieAirbnbEvents = await fetchIcal(
      BETSIE_AIRBNB_ICAL_URL!,
      BROWN,
      "Betsie Airbnb",
      existingTaskIds
    );

    const formattedEvents: CalendarSource[] = [
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

    const api = new TodoistApi(TODOIST_API_TOKEN!);
    // Fetch all tasks for display
    let formattedTasks: Task[] = [];
    try {
      const tasks = await api.getTasks({
        limit: 200,
      });
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
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        );
    } catch (error) {
      // @ts-ignore
      console.error("Error fetching all tasks:", error.responseData);
      // Continue with empty tasks array if this fails
    }

    // Return the formatted events and tasks as a JSON response
    return NextResponse.json(
      {
        events: formattedEvents,
        tasks: formattedTasks,
        lastUpdated: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    // Handle any unexpected errors during the process
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
      { status: 500 }
    );
  }
}
