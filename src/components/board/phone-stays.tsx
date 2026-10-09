"use client";

import { useState } from "react";
import { format, startOfMonth } from "date-fns";
import { CalendarDaysIcon, ListIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { Stay } from "./model";
import { StayAgenda } from "./stay-agenda";
import { StayMonth } from "./stay-month";

type View = "list" | "month";
const VIEW_KEY = "bnb-phone-view";

/** Only rendered after mount (the board waits for the clock), so storage is there to read */
const savedView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === "month" ? "month" : "list";
  } catch {
    return "list";
  }
};

/** The phone's stays: the upcoming list or a month calendar, whichever was used last */
export function PhoneStays({
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
  const [view, setView] = useState<View>(savedView);
  const [month, setMonth] = useState(() => startOfMonth(today));

  const choose = (next: string) => {
    if (next !== "list" && next !== "month") return;
    setView(next);
    setMonth(startOfMonth(today));
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Private browsing: the choice just doesn't stick
    }
  };

  return (
    <section aria-labelledby="stays-title" className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id="stays-title" className="text-2xl font-semibold tracking-tight">
          {view === "list" ? "Stays this month" : format(month, "MMMM yyyy")}
        </h2>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={choose}
          aria-label="Show stays as"
          spacing={0}
          className="shrink-0 rounded-full bg-muted p-1"
        >
          {(
            [
              ["list", "List", ListIcon],
              ["month", "Calendar", CalendarDaysIcon],
            ] as const
          ).map(([value, label, Icon]) => (
            <ToggleGroupItem
              key={value}
              value={value}
              aria-label={label}
              title={label}
              className="size-11 rounded-full! px-0 text-muted-foreground transition-[background-color,color,box-shadow] duration-200 hover:bg-transparent data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
            >
              <Icon className="size-5" />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {view === "list" ? (
        <StayAgenda today={today} stays={stays} onSelectStay={onSelectStay} showTitle={false} />
      ) : (
        <StayMonth
          today={today}
          stays={stays}
          onSelectStay={onSelectStay}
          onMonthChange={setMonth}
        />
      )}
    </section>
  );
}
