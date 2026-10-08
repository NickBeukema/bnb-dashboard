"use client";

import { useState } from "react";
import {
  addDays,
  addWeeks,
  differenceInCalendarDays,
  format,
  isSameMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { PropertySwatch } from "./bits";
import { PROPERTIES, type Property, type Stay, propertyStyle } from "./model";

const WEEKS = 4;

/**
 * Four weeks of stays, one lane per property. A stay runs from midday on check-in to
 * midday on checkout, so a same-day turnover shows as two bars meeting inside one day.
 */
export function StayCalendar({
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
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState<string[]>(PROPERTIES.map((p) => p.name));

  const first = addWeeks(startOfWeek(today), page * WEEKS);
  const last = addDays(first, WEEKS * 7 - 1);
  const lanes = PROPERTIES.filter((p) => visible.includes(p.name));
  const title = isSameMonth(first, last)
    ? format(first, "MMMM yyyy")
    : `${format(first, "MMMM")} – ${format(last, "MMMM yyyy")}`;

  return (
    <section aria-labelledby="calendar-title" className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 id="calendar-title" className="text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-lg"
            className="size-11"
            aria-label="Previous four weeks"
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeftIcon className="size-5" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-11 px-4 text-base"
            disabled={page === 0}
            onClick={() => setPage(0)}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            className="size-11"
            aria-label="Next four weeks"
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRightIcon className="size-5" />
          </Button>
        </div>
      </div>

      {/* The legend is also the lane key, and tapping a property shows or hides its lane */}
      <ToggleGroup
        type="multiple"
        variant="outline"
        value={visible}
        onValueChange={(value) => value.length > 0 && setVisible(value)}
        aria-label="Properties shown"
        className="flex-wrap"
      >
        {PROPERTIES.map((p) => (
          <ToggleGroupItem
            key={p.name}
            value={p.name}
            className="h-11 rounded-full px-4 text-base data-[state=off]:text-muted-foreground data-[state=on]:bg-card data-[state=off]:[&>span:first-child]:opacity-30"
          >
            <PropertySwatch property={p} className="size-3.5" />
            {p.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="overflow-hidden rounded-3xl bg-card ring-1 ring-border">
        <div
          aria-hidden
          className="grid grid-cols-[var(--gutter)_repeat(7,1fr)] border-b text-sm text-muted-foreground [--gutter:1.75rem]"
        >
          <span />
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="px-2 py-2">
              {format(addDays(first, i), "EEE")}
            </span>
          ))}
        </div>
        {Array.from({ length: WEEKS }, (_, w) => (
          <Week
            key={w}
            isFirst={w === 0}
            start={addDays(first, w * 7)}
            today={today}
            lanes={lanes}
            stays={stays}
            onSelectStay={onSelectStay}
          />
        ))}
      </div>
    </section>
  );
}

function Week({
  isFirst,
  start,
  today,
  lanes,
  stays,
  onSelectStay,
}: {
  isFirst: boolean;
  start: Date;
  today: Date;
  lanes: Property[];
  stays: Stay[];
  onSelectStay: (stay: Stay) => void;
}) {
  const end = addDays(start, 7);
  const todayIndex = differenceInCalendarDays(today, start);
  const pastDays = Math.max(0, Math.min(7, todayIndex));

  return (
    <div className="relative grid grid-cols-[var(--gutter)_1fr] border-b last:border-b-0 [--gutter:1.75rem] [--lane:2rem]">
      {/* Day columns: today tinted, the past washed out on top of the bars */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 left-(--gutter) grid grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className={cn(i > 0 && "border-l border-border/60", i === todayIndex && "bg-foreground/[0.045]")}
          />
        ))}
      </div>

      <div aria-hidden className="col-start-2 grid grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => {
          const day = addDays(start, i);
          const isToday = i === todayIndex;
          return (
            <span key={i} className="flex h-8 items-center px-1.5 text-sm tabular-nums">
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-medium",
                  isToday && "bg-today text-background",
                  i < pastDays && "text-muted-foreground",
                )}
              >
                {day.getDate() === 1 || (isFirst && i === 0)
                  ? format(day, "MMM d")
                  : day.getDate()}
              </span>
            </span>
          );
        })}
      </div>

      <div className="col-span-2 flex flex-col gap-0.5 pb-1.5">
        {lanes.map((property) => (
          <div key={property.name} className="grid grid-cols-[var(--gutter)_1fr] items-center">
            <span
              title={property.name}
              className="text-center text-xs font-semibold text-muted-foreground"
            >
              {property.initial}
            </span>
            <div className="relative h-(--lane)">
              {stays
                .filter((s) => s.property.name === property.name && s.checkIn < end && s.checkOut >= start)
                .map((stay) => (
                  <Bar key={stay.id} stay={stay} weekStart={start} onSelect={onSelectStay} />
                ))}
            </div>
          </div>
        ))}
      </div>

      {pastDays > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-(--gutter) bg-card/55"
          style={{ width: `calc((100% - var(--gutter)) * ${pastDays / 7})` }}
        />
      )}
    </div>
  );
}

function Bar({
  stay,
  weekStart,
  onSelect,
}: {
  stay: Stay;
  weekStart: Date;
  onSelect: (stay: Stay) => void;
}) {
  const inIndex = differenceInCalendarDays(stay.checkIn, weekStart);
  const outIndex = differenceInCalendarDays(stay.checkOut, weekStart);
  const startsHere = inIndex >= 0;
  const endsHere = outIndex <= 6;
  const from = startsHere ? inIndex + 0.5 : 0;
  const to = endsHere ? outIndex + 0.5 : 7;
  if (to <= from) return null;

  const label = `${stay.blocked ? "Blocked" : stay.guest}, ${stay.property.name}, ${format(stay.checkIn, "MMM d")} to ${format(stay.checkOut, "MMM d")}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(stay)}
      aria-label={label}
      style={{
        ...propertyStyle(stay.property),
        left: `calc(${(from / 7) * 100}% + ${startsHere ? 3 : 0}px)`,
        right: `calc(${((7 - to) / 7) * 100}% + ${endsHere ? 3 : 0}px)`,
      }}
      className={cn(
        "absolute inset-y-0.5 flex items-center overflow-hidden px-3 text-left text-sm font-semibold outline-none transition-[filter] duration-200 hover:brightness-110 focus-visible:ring-3 focus-visible:ring-ring active:brightness-95",
        stay.blocked
          ? "stripes bg-card text-(--prop) ring-1 ring-(--prop)/50 ring-inset"
          : "bg-(--prop) text-(--prop-ink)",
        startsHere ? "rounded-l-full pl-3.5" : "rounded-l-none",
        endsHere ? "rounded-r-full" : "rounded-r-none",
      )}
    >
      <span className={cn("truncate", stay.blocked && "text-muted-foreground", to - from < 1 && "sr-only")}>
        {stay.blocked ? "Blocked" : stay.guest}
      </span>
    </button>
  );
}

export function StayCalendarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Skeleton className="h-11 w-72" />
      <Skeleton className="h-11 w-full max-w-xl" />
      <Skeleton className="h-[36rem] w-full rounded-3xl" />
    </div>
  );
}
