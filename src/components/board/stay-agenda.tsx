"use client";

import { addDays, format, isSameMonth } from "date-fns";
import { ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PropertySwatch } from "./bits";
import type { Stay } from "./model";

const DAYS_AHEAD = 30;

export const stayDates = (stay: Stay) =>
  isSameMonth(stay.checkIn, stay.checkOut)
    ? `${format(stay.checkIn, "MMM d")} – ${format(stay.checkOut, "d")}`
    : `${format(stay.checkIn, "MMM d")} – ${format(stay.checkOut, "MMM d")}`;

/** The phone's stand-in for the calendar grid: the next month of stays as a list */
export function StayAgenda({
  today,
  stays,
  onSelectStay,
  className,
}: {
  today: Date;
  stays: Stay[];
  onSelectStay: (stay: Stay) => void;
  className?: string;
}) {
  const horizon = addDays(today, DAYS_AHEAD);
  const upcoming = stays.filter((s) => !s.closed && s.checkOut >= today && s.checkIn <= horizon);

  return (
    <section aria-labelledby="agenda-title" className={cn("flex flex-col gap-3", className)}>
      <h2 id="agenda-title" className="px-1 text-2xl font-semibold tracking-tight">
        Stays this month
      </h2>
      {upcoming.length === 0 ? (
        <p className="px-1 text-muted-foreground">No bookings in the next 30 days.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-3xl bg-card ring-1 ring-border">
          {upcoming.map((stay) => {
            const here = stay.checkIn <= today;
            return (
              <li key={stay.id}>
                <button
                  type="button"
                  onClick={() => onSelectStay(stay)}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors duration-200 hover:bg-muted/60 focus-visible:bg-muted active:bg-muted"
                >
                  <PropertySwatch property={stay.property} className="size-3.5" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-lg font-semibold">{stay.guest}</span>
                      {here && (
                        <Badge variant="secondary" className="h-6 px-2.5">
                          Here now
                        </Badge>
                      )}
                    </span>
                    <span className="flex gap-2 text-sm text-muted-foreground">
                      <span className="truncate">{stay.property.name}</span>
                      <span aria-hidden>·</span>
                      <span className="shrink-0 tabular-nums">
                        {stayDates(stay)}, {stay.nights} {stay.nights === 1 ? "night" : "nights"}
                      </span>
                    </span>
                  </span>
                  <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
