"use client";

import { type TouchEvent, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PropertyName, PropertySwatch } from "./bits";
import { type PropertyDay, PROPERTIES, type Stay, daysAtProperties, propertyStyle } from "./model";

// A horizontal drag this long, and clearly more sideways than down, turns the month
const SWIPE_PX = 50;

/**
 * The phone's month calendar. Each day shows four thin lanes, one per property in the usual
 * order, and a stay runs from midday on check-in to midday on checkout, as on the TV. Tapping a
 * day lists what every property has on that day underneath.
 */
export function StayMonth({
  today,
  stays,
  onSelectStay,
  onMonthChange,
}: {
  today: Date;
  stays: Stay[];
  onSelectStay: (stay: Stay) => void;
  /** Called with the month on show, so the section heading can name it */
  onMonthChange?: (month: Date) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(today));
  const [selected, setSelected] = useState(today);
  // Which way the last month change went, so the new month slides in from that side
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const offset = differenceInCalendarMonths(month, startOfMonth(today));

  const goTo = (target: Date, select?: Date) => {
    const next = startOfMonth(target);
    const step = Math.sign(differenceInCalendarMonths(next, month)) as -1 | 0 | 1;
    if (step !== 0) {
      setDirection(step);
      setMonth(next);
      onMonthChange?.(next);
    }
    // Keep the selection on show: today in the current month, otherwise the 1st
    setSelected(select ?? (isSameMonth(next, today) ? today : next));
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    swipe.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = swipe.current;
    const t = e.changedTouches[0];
    swipe.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      goTo(addMonths(month, dx < 0 ? 1 : -1));
    }
  };

  const first = startOfWeek(startOfMonth(month));
  const weeks = Math.ceil((differenceInCalendarDays(endOfWeek(endOfMonth(month)), first) + 1) / 7);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="lg"
          className="h-11 gap-1 pr-4 pl-2.5 text-base"
          aria-label={`Previous month, ${format(addMonths(month, -1), "MMMM")}`}
          onClick={() => goTo(addMonths(month, -1))}
        >
          <ChevronLeftIcon className="size-5" />
          {format(addMonths(month, -1), "MMM")}
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-11 px-4 text-base"
          disabled={offset === 0 && isSameDay(selected, today)}
          onClick={() => goTo(today)}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-11 gap-1 pr-2.5 pl-4 text-base"
          aria-label={`Next month, ${format(addMonths(month, 1), "MMMM")}`}
          onClick={() => goTo(addMonths(month, 1))}
        >
          {format(addMonths(month, 1), "MMM")}
          <ChevronRightIcon className="size-5" />
        </Button>
      </div>

      <div
        className="touch-pan-y overflow-hidden rounded-3xl bg-card px-1.5 pb-1.5 ring-1 ring-border"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          aria-hidden
          className="grid grid-cols-7 py-2 text-center text-xs text-muted-foreground"
        >
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i}>{format(addDays(first, i), "EEEEE")}</span>
          ))}
        </div>
        <div
          key={month.getTime()}
          className={cn(
            "flex flex-col gap-0.5",
            direction !== 0 &&
              "motion-safe:animate-in motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]",
            direction === 1 && "motion-safe:fade-in-0 motion-safe:slide-in-from-right-6",
            direction === -1 && "motion-safe:fade-in-0 motion-safe:slide-in-from-left-6",
          )}
        >
          {Array.from({ length: weeks }, (_, w) => (
            <MonthWeek
              key={w}
              start={addDays(first, w * 7)}
              month={month}
              today={today}
              selected={selected}
              stays={stays}
              onSelectDay={(d) => (isSameMonth(d, month) ? setSelected(d) : goTo(d, d))}
            />
          ))}
        </div>
      </div>

      <ul aria-label="Lane key" className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-sm">
        {PROPERTIES.map((p) => (
          <li key={p.name}>
            <PropertyName property={p} />
          </li>
        ))}
      </ul>

      <DayDetail day={selected} today={today} stays={stays} onSelectStay={onSelectStay} />
    </div>
  );
}

function MonthWeek({
  start,
  month,
  today,
  selected,
  stays,
  onSelectDay,
}: {
  start: Date;
  month: Date;
  today: Date;
  selected: Date;
  stays: Stay[];
  onSelectDay: (day: Date) => void;
}) {
  const end = addDays(start, 7);
  const pastDays = Math.max(0, Math.min(7, differenceInCalendarDays(today, start)));

  return (
    <div className="relative grid grid-cols-7">
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(start, i);
        const isToday = isSameDay(day, today);
        const inMonth = isSameMonth(day, month);
        return (
          <button
            key={i}
            type="button"
            aria-pressed={isSameDay(day, selected)}
            aria-label={dayLabel(day, today, stays)}
            onClick={() => onSelectDay(day)}
            className="flex h-[4.25rem] flex-col items-center rounded-2xl pt-1 outline-none transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring active:bg-muted aria-pressed:bg-muted"
          >
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-sm font-medium tabular-nums",
                isToday && "bg-today font-semibold text-background",
                !isToday && i < pastDays && "text-muted-foreground",
                !isToday && !inMonth && "text-muted-foreground/60",
              )}
            >
              {day.getDate()}
            </span>
          </button>
        );
      })}

      {/* Lanes sit over the lower half of the days; taps go through to the day underneath */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col gap-0.5"
      >
        {PROPERTIES.map((property) => (
          <div key={property.name} className="relative h-[5px]">
            {stays
              .filter(
                (s) => s.property.name === property.name && s.checkIn < end && s.checkOut >= start,
              )
              .map((stay) => (
                <LaneBar key={stay.id} stay={stay} weekStart={start} />
              ))}
          </div>
        ))}
        {pastDays > 0 && (
          <div
            className="absolute inset-y-0 left-0 bg-card/55"
            style={{ width: `${(pastDays / 7) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

function LaneBar({ stay, weekStart }: { stay: Stay; weekStart: Date }) {
  const inIndex = differenceInCalendarDays(stay.checkIn, weekStart);
  const outIndex = differenceInCalendarDays(stay.checkOut, weekStart);
  const startsHere = inIndex >= 0;
  const endsHere = outIndex <= 6;
  const from = startsHere ? inIndex + 0.5 : 0;
  const to = endsHere ? outIndex + 0.5 : 7;
  if (to <= from) return null;

  return (
    <span
      style={{
        ...propertyStyle(stay.property),
        left: `calc(${(from / 7) * 100}% + ${startsHere ? 1.5 : 0}px)`,
        right: `calc(${((7 - to) / 7) * 100}% + ${endsHere ? 1.5 : 0}px)`,
      }}
      className={cn(
        "absolute inset-y-0",
        // A closure is a hollow bar, so it doesn't read as a past (washed-out) stay
        stay.closed ? "bg-(--prop)/10 ring-1 ring-(--prop) ring-inset" : "bg-(--prop)",
        startsHere && "rounded-l-full",
        endsHere && "rounded-r-full",
      )}
    />
  );
}

/** What a screen reader hears for a day: the date, then each property with something on */
function dayLabel(day: Date, today: Date, stays: Stay[]) {
  const parts = daysAtProperties(day, stays).flatMap(
    ({ property, out, in: arriving, staying, closed }) => {
      const said = [
        out && `${out.guest} leaves`,
        arriving && `${arriving.guest} arrives`,
        staying && staying.guest,
        !out && !arriving && !staying && closed && "closed",
      ].filter(Boolean);
      return said.length > 0 ? [`${property.name}: ${said.join(", ")}`] : [];
    },
  );
  const date = `${format(day, "EEEE, MMMM d")}${isSameDay(day, today) ? ", today" : ""}`;
  return [date, ...(parts.length > 0 ? parts : ["nothing booked"])].join(". ");
}

function DayDetail({
  day,
  today,
  stays,
  onSelectStay,
}: {
  day: Date;
  today: Date;
  stays: Stay[];
  onSelectStay: (stay: Stay) => void;
}) {
  const offset = differenceInCalendarDays(day, today);
  const relative =
    offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : offset === -1 ? "Yesterday" : null;

  return (
    <section aria-labelledby="day-title" className="flex flex-col gap-2 pt-1">
      <h3 id="day-title" className="flex items-baseline gap-2 px-1 text-xl font-semibold">
        {format(day, "EEEE, MMMM d")}{" "}
        {relative && (
          <span className="text-base font-normal text-muted-foreground">{relative}</span>
        )}
      </h3>
      <ul className="divide-y overflow-hidden rounded-3xl bg-card ring-1 ring-border">
        {daysAtProperties(day, stays).map((entry) => (
          <PropertyDayRow
            key={entry.property.name}
            entry={entry}
            day={day}
            onSelectStay={onSelectStay}
          />
        ))}
      </ul>
    </section>
  );
}

function PropertyDayRow({
  entry,
  day,
  onSelectStay,
}: {
  entry: PropertyDay;
  day: Date;
  onSelectStay: (stay: Stay) => void;
}) {
  const { property, out, in: arriving, staying, closed } = entry;
  const nights = (s: Stay) => `${s.nights} ${s.nights === 1 ? "night" : "nights"}`;
  const lines: { stay: Stay; detail: string }[] = [
    ...(out ? [{ stay: out, detail: "Checks out" }] : []),
    ...(arriving ? [{ stay: arriving, detail: `Checks in, ${nights(arriving)}` }] : []),
    ...(staying
      ? [
          {
            stay: staying,
            detail: `Night ${differenceInCalendarDays(day, staying.checkIn) + 1} of ${staying.nights}, leaves ${format(staying.checkOut, "MMM d")}`,
          },
        ]
      : []),
  ];
  const isClosed = lines.length === 0 && closed;

  return (
    <li className={cn(lines.length > 0 || closed ? "py-1.5" : "py-2.5")}>
      <div className="flex items-center gap-2 px-4 pt-1.5 pb-0.5 text-sm font-medium text-muted-foreground">
        <PropertySwatch property={property} />
        <span className="flex-1">{property.name}</span>
        {lines.length === 0 && !closed && <span className="text-base font-normal">Empty</span>}
      </div>
      {lines.map(({ stay, detail }) => (
        <button
          key={`${stay.id}-${detail}`}
          type="button"
          onClick={() => onSelectStay(stay)}
          className="flex min-h-12 w-full items-center gap-3 px-4 py-1.5 text-left outline-none transition-colors duration-200 focus-visible:bg-muted active:bg-muted"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-semibold">{stay.guest}</span>
            <span className="block text-sm text-muted-foreground tabular-nums">{detail}</span>
          </span>
          <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        </button>
      ))}
      {isClosed && (
        <button
          type="button"
          onClick={() => onSelectStay(closed)}
          style={propertyStyle(property)}
          className="flex min-h-12 w-full items-center gap-3 px-4 py-1.5 text-left outline-none transition-colors duration-200 focus-visible:bg-muted active:bg-muted"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold text-muted-foreground">
              Closed for the season
            </span>
            <span className="block text-sm text-muted-foreground tabular-nums">
              Until {format(closed.checkOut, "MMM d")}
            </span>
          </span>
          <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        </button>
      )}
    </li>
  );
}
