import { format } from "date-fns";
import * as ical from "node-ical";
import type { CalendarEvent } from "@/lib/calendar-types";

// node-ical returns `{ val, params }` instead of a string when a property has parameters
const paramText = (value: ical.ParameterValue): string =>
  typeof value === "string" ? value : value.val;

// Feeds use date-only DTSTART/DTEND, which node-ical reads as local midnight
const day = (date: Date) => format(date, "yyyy-MM-dd");

/** Parses an iCal feed into calendar events, keeping only VEVENTs */
export async function parseFeed(ics: string): Promise<CalendarEvent[]> {
  const components = await ical.async.parseICS(ics);
  return Object.values(components)
    .filter((component): component is ical.VEvent => component?.type === "VEVENT")
    .map((vevent) => ({
      id: vevent.uid,
      title: paramText(vevent.summary),
      checkIn: day(vevent.start),
      // DTEND is the checkout day. node-ical fills in a missing one as DTSTART + 1 day.
      checkOut: day(vevent.end ?? vevent.start),
      description: vevent.description ? paramText(vevent.description) : null,
    }));
}

/** Downloads and parses one property's booking feed. Next caches the download for an hour. */
export async function fetchFeed(url: string): Promise<CalendarEvent[]> {
  const response = await fetch(url, { next: { revalidate: 3600 } } as RequestInit);
  if (!response.ok) {
    throw new Error(`Failed to fetch iCal data: ${response.statusText}`);
  }
  return parseFeed(await response.text());
}
