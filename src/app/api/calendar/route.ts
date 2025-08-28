import { NextResponse } from "next/server";
import * as ical from "node-ical";

const WAVESONG_ICAL_URL = process.env.WAVESONG_ICAL_URL || "";
const RED_ICAL_URL = process.env.RED_ICAL_URL || "";
const LAKE_BREEZE_ICAL_URL = process.env.LAKE_BREEZE_ICAL_URL || "";
const BESTIE_ICAL_URL = process.env.BESTIE_ICAL_URL || "";

const fetchIcal = async (
  url: string,
  color: string
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
      console.log(event);
      // We perform a type assertion here because we've already filtered for 'VEVENT'
      const vevent = event as ical.VEvent;
      return {
        uid: vevent.uid,
        title: vevent.summary,
        start: new Date(
          vevent.start.getTime() + 11 * 60 * 60 * 1000
        ).toISOString(),
        end: new Date(vevent.end.getTime() + 11 * 60 * 60 * 1000).toISOString(),
        location: vevent.location || null,
        description: vevent.description || null,
        backgroundColor: color,
        allDay: true,
      };
    });

  return formattedEvents;
};

export type CalendarEvent = {
  uid: string;
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

const BLUE = "#1e56b0";
const RED = "#ff0000";
const GREEN = "#21a677";
const BROWN = "#4a120c";

/**
 * Handles GET requests to /api/calendar.
 * Fetches and parses iCal data from a specified URL, then returns it as JSON.
 *
 * @param {Request} request - The incoming request object.
 * @returns {Promise<NextResponse>} A promise that resolves to the response.
 */
export async function GET(request: Request) {
  // It's a good practice to handle potential CORS issues if you're calling this from a different domain,
  // but for same-origin requests, this is straightforward.

  try {
    const wavesongEvents = await fetchIcal(WAVESONG_ICAL_URL, BLUE);
    const redEvents = await fetchIcal(RED_ICAL_URL, RED);
    const lakeBreezeEvents = await fetchIcal(LAKE_BREEZE_ICAL_URL, GREEN);
    const bestieEvents = await fetchIcal(BESTIE_ICAL_URL, BROWN);

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
        name: "Bestie",
        events: bestieEvents,
        color: "#4a120c",
      },
    ];

    // Return the formatted events as a JSON response.
    return NextResponse.json({ events: formattedEvents }, { status: 200 });
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
