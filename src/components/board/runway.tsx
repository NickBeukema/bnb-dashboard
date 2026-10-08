"use client";

import { addDays, format, isSameDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PropertyName } from "./bits";
import { type BoardTask, type Stay, type Turnover, movementsOn } from "./model";
import { TaskRow } from "./task-row";

const DAYS = 3;

/**
 * The next three days, side by side: who arrives, who leaves, and what has to get done.
 * Today carries the overdue work too, so nothing late hides further down the list.
 */
export function Runway({
  today,
  stays,
  tasks,
  onSelectStay,
  onCompleteTask,
  className,
}: {
  today: Date;
  stays: Stay[];
  tasks: BoardTask[];
  onSelectStay: (stay: Stay) => void;
  onCompleteTask: (task: BoardTask) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 md:grid-cols-[1.15fr_1fr_1fr] md:gap-0", className)}>
      {Array.from({ length: DAYS }, (_, i) => {
        const day = addDays(today, i);
        return (
          <Day
            key={day.toISOString()}
            index={i}
            day={day}
            today={today}
            turnovers={movementsOn(day, stays)}
            tasks={tasks.filter((t) => (i === 0 ? t.due <= day : isSameDay(t.due, day)))}
            onSelectStay={onSelectStay}
            onCompleteTask={onCompleteTask}
          />
        );
      })}
    </div>
  );
}

const dayName = (index: number, day: Date) =>
  index === 0 ? "Today" : index === 1 ? "Tomorrow" : format(day, "EEEE");

function Day({
  index,
  day,
  today,
  turnovers,
  tasks,
  onSelectStay,
  onCompleteTask,
}: {
  index: number;
  day: Date;
  today: Date;
  turnovers: Turnover[];
  tasks: BoardTask[];
  onSelectStay: (stay: Stay) => void;
  onCompleteTask: (task: BoardTask) => void;
}) {
  const isToday = index === 0;
  const quiet = turnovers.length === 0 && tasks.length === 0;

  return (
    <section
      aria-labelledby={`day-${index}`}
      className={cn(
        "flex min-h-0 flex-col",
        isToday
          ? "rounded-3xl bg-card p-4 shadow-[0_1px_2px_oklch(0_0_0/0.06),0_8px_24px_-12px_oklch(0_0_0/0.12)] ring-1 ring-border md:p-5 dark:shadow-none"
          : "rounded-3xl p-4 ring-1 ring-border md:rounded-none md:px-5 md:py-5 md:ring-0",
        index === 2 && "md:border-l",
      )}
    >
      <header className="mb-3 flex items-baseline justify-between gap-3 px-2">
        <h2 id={`day-${index}`} className="text-2xl font-semibold tracking-tight">
          {dayName(index, day)}
        </h2>
        <p className="text-muted-foreground tabular-nums">{format(day, "MMM d")}</p>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        {quiet ? (
          <p className="px-2 py-3 text-muted-foreground">Nothing on. Enjoy the quiet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {turnovers.length > 0 && (
              <ul aria-label="Arrivals and departures" className="flex flex-col gap-1">
                {turnovers.map((t) => (
                  <TurnoverItem key={t.property.name} turnover={t} onSelectStay={onSelectStay} />
                ))}
              </ul>
            )}
            {tasks.length > 0 && (
              <div>
                {turnovers.length > 0 && <div aria-hidden className="mx-2 mb-2 border-t" />}
                <ul aria-label={`To-dos ${dayName(index, day).toLowerCase()}`} className="flex flex-col">
                  {tasks.map((task) => (
                    <TaskRow key={task.id} task={task} today={today} onComplete={onCompleteTask} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </section>
  );
}

function TurnoverItem({
  turnover,
  onSelectStay,
}: {
  turnover: Turnover;
  onSelectStay: (stay: Stay) => void;
}) {
  const sameDay = turnover.out && turnover.in;
  return (
    <li className="rounded-xl px-2 py-1.5">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <PropertyName property={turnover.property} />
        {sameDay && (
          <Badge variant="secondary" className="h-6 px-2.5 text-xs">
            Same-day turnover
          </Badge>
        )}
      </div>
      <div className="mt-0.5 flex flex-col">
        {turnover.out && <Guest stay={turnover.out} verb="leaves" onSelect={onSelectStay} />}
        {turnover.in && <Guest stay={turnover.in} verb="arrives" onSelect={onSelectStay} />}
      </div>
    </li>
  );
}

function Guest({
  stay,
  verb,
  onSelect,
}: {
  stay: Stay;
  verb: string;
  onSelect: (stay: Stay) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(stay)}
      className="-mx-2 flex min-h-11 items-baseline gap-2 rounded-lg px-2 text-left outline-none transition-colors duration-200 hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
    >
      <span className="self-center text-lg font-semibold">{stay.guest}</span>
      <span className="self-center text-muted-foreground">{verb}</span>
    </button>
  );
}

export function RunwaySkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-3 md:grid-cols-[1.15fr_1fr_1fr]", className)}>
      {Array.from({ length: DAYS }, (_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-3xl p-5 ring-1 ring-border">
          <Skeleton className="h-8 w-32" />
          {Array.from({ length: 4 - i }, (_, j) => (
            <div key={j} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-40" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
