"use client";

import { useState } from "react";
import { format, startOfDay } from "date-fns";
import { ListTodoIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useNow } from "./bits";
import { Runway, RunwaySkeleton } from "./runway";
import { AllTasksSheet, StaySheet } from "./sheets";
import { StayAgenda } from "./stay-agenda";
import { StayCalendar, StayCalendarSkeleton } from "./stay-calendar";
import { ThemeModeToggle } from "./theme";
import { useBoard } from "./use-board";

export function Board() {
  const now = useNow();
  const { data, tasks, status, refresh, complete } = useBoard();
  const [stayId, setStayId] = useState<string | null>(null);
  const [allTasksOpen, setAllTasksOpen] = useState(false);

  const today = now ? startOfDay(now) : null;
  const stay = data?.stays.find((s) => s.id === stayId) ?? null;
  const ready = data && today;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[75rem] flex-col gap-5 px-4 pt-5 pb-6 md:gap-6 md:px-8 md:pt-8 tv:h-dvh tv:gap-6 tv:overflow-hidden tv:px-10 tv:pt-9 tv:pb-7">
      <header className="flex items-end justify-between gap-4 px-1">
        {now ? (
          <>
            <div>
              <p className="text-lg text-muted-foreground md:text-xl">{format(now, "EEEE")}</p>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{format(now, "MMMM d")}</h1>
            </div>
            <p className="text-4xl font-light tracking-tight tabular-nums md:text-5xl" aria-label={`Time ${format(now, "h:mm a")}`}>
              {format(now, "h:mm")}
              <span className="ml-1 text-xl text-muted-foreground md:text-2xl">{format(now, "a")}</span>
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-11 w-56" />
            </div>
            <Skeleton className="h-11 w-32" />
          </>
        )}
      </header>

      {ready ? (
        <>
          <StayCalendar
            today={today}
            stays={data.stays}
            onSelectStay={(s) => setStayId(s.id)}
            className="hidden shrink-0 md:flex"
          />
          <StayAgenda
            today={today}
            stays={data.stays}
            onSelectStay={(s) => setStayId(s.id)}
            className="md:hidden"
          />
          <Runway
            today={today}
            stays={data.stays}
            tasks={tasks}
            onSelectStay={(s) => setStayId(s.id)}
            onCompleteTask={complete}
            className="tv:min-h-0 tv:flex-1"
          />
        </>
      ) : status === "error" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <TriangleAlertIcon aria-hidden className="size-8 text-destructive" />
          <div>
            <p className="text-xl font-semibold">Couldn't load the calendars</p>
            <p className="text-muted-foreground">Check the internet connection, then try again.</p>
          </div>
          <Button size="lg" className="h-12 px-5 text-base" onClick={refresh}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <StayCalendarSkeleton className="hidden shrink-0 md:flex" />
          <RunwaySkeleton className="tv:min-h-0 tv:flex-1" />
        </>
      )}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 px-1">
        <Button
          variant="outline"
          size="lg"
          className="h-11 gap-2 px-4 text-base"
          disabled={!data}
          onClick={() => setAllTasksOpen(true)}
        >
          <ListTodoIcon className="size-5" />
          All to-dos
          {data && <span className="text-muted-foreground tabular-nums">{tasks.length}</span>}
        </Button>
        <div className="flex items-center gap-2">
          <SyncStatus status={status} lastUpdated={data?.lastUpdated ?? null} onRefresh={refresh} />
          <ThemeModeToggle />
        </div>
      </footer>

      {today && (
        <>
          <StaySheet
            stay={stay}
            today={today}
            tasks={tasks}
            onClose={() => setStayId(null)}
            onCompleteTask={complete}
          />
          <AllTasksSheet
            open={allTasksOpen}
            onOpenChange={setAllTasksOpen}
            today={today}
            tasks={tasks}
            onCompleteTask={complete}
          />
        </>
      )}
    </div>
  );
}

function SyncStatus({
  status,
  lastUpdated,
  onRefresh,
}: {
  status: string;
  lastUpdated: Date | null;
  onRefresh: () => void;
}) {
  const busy = status === "loading" || status === "refreshing";
  return (
    <div className="flex items-center gap-1">
      <p
        aria-live="polite"
        className={cn("text-sm tabular-nums", status === "error" ? "text-destructive" : "text-muted-foreground")}
      >
        {status === "error" && lastUpdated
          ? `Couldn't refresh. Showing ${format(lastUpdated, "h:mm a")}`
          : lastUpdated
            ? `Updated ${format(lastUpdated, "h:mm a")}`
            : "Loading…"}
      </p>
      <Button
        variant="ghost"
        size="icon-lg"
        className="size-11"
        aria-label="Refresh now"
        disabled={busy}
        onClick={onRefresh}
      >
        <RotateCwIcon className={cn("size-5", busy && "animate-spin motion-reduce:animate-none")} />
      </Button>
    </div>
  );
}
