import * as ical from "node-ical";
import type { CalendarEvent } from "@/lib/calendar-types";
import type { PropertyConfig } from "@/lib/properties";

const HOUR = 60 * 60 * 1000;

// node-ical returns `{ val, params }` instead of a string when a property has parameters
const paramText = (value: ical.ParameterValue): string =>
  typeof value === "string" ? value : value.val;

/** Parses an iCal feed into calendar events, keeping only VEVENTs */
export async function parseFeed(ics: string, property: PropertyConfig): Promise<CalendarEvent[]> {
  const components = await ical.async.parseICS(ics);
  return Object.values(components)
    .filter((component): component is ical.VEvent => component?.type === "VEVENT")
    .map((vevent) => {
      const end = vevent.end ?? vevent.start;
      return {
        id: vevent.uid,
        title: paramText(vevent.summary),
        // The classic FullCalendar view relies on these shifts (see CalendarEvent)
        start: new Date(vevent.start.getTime() + 11 * HOUR).toISOString(),
        end: new Date(end.getTime() + 24 * HOUR).toISOString(),
        location: property.name,
        description: vevent.description ? paramText(vevent.description) : null,
        backgroundColor: property.color,
        allDay: true,
      };
    });
}

/** Downloads and parses one property's booking feed. Next caches the download for an hour. */
export async function fetchFeed(url: string, property: PropertyConfig): Promise<CalendarEvent[]> {
  const response = await fetch(url, { next: { revalidate: 3600 } } as RequestInit);
  if (!response.ok) {
    throw new Error(`Failed to fetch iCal data: ${response.statusText}`);
  }
  return parseFeed(await response.text(), property);
}
