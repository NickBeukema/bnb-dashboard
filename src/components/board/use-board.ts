"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CalendarSource, Task } from "@/lib/calendar-types";
import { type BoardData, type BoardTask, toStays, toTasks } from "./model";

const POLL_MS = 5 * 60 * 1000;
// Coming back to the tab (or waking a phone) refreshes if the data is older than this
const STALE_MS = 60 * 1000;
// How long a task ticked off here stays hidden while syncs still list it (server-side caching
// and Todoist itself can lag). After that, a listed task is trusted, e.g. reopened in Todoist.
const HIDE_GRACE_MS = 2 * 60 * 1000;

type Status = "loading" | "ready" | "refreshing" | "error";

export function useBoard() {
  const [data, setData] = useState<BoardData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  // Tasks ticked off on this screen, hidden right away instead of waiting for the next sync.
  // The value is when Todoist confirmed the change (null while the request is in flight).
  const [done, setDone] = useState<Map<string, number | null>>(() => new Map());
  const fetchedAt = useRef(0);
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latest.current;
    const startedAt = Date.now();
    setStatus((s) => (s === "loading" ? s : "refreshing"));
    try {
      const response = await fetch("/api/calendar", { cache: "no-store" });
      const json: { events: CalendarSource[]; tasks: Task[]; lastUpdated: string } =
        await response.json();
      if (!response.ok) throw new Error();
      // A newer refresh started while this one was in flight; its answer wins
      if (request !== latest.current) return;
      fetchedAt.current = Date.now();
      setData({
        stays: toStays(json.events),
        tasks: toTasks(json.tasks),
        lastUpdated: new Date(json.lastUpdated),
      });
      // Stop hiding a task once the sync agrees it's gone, or once the grace period is over
      const listed = new Set(json.tasks.map((t) => t.id));
      setDone((prev) => {
        const next = new Map(
          [...prev].filter(
            ([id, confirmedAt]) =>
              confirmedAt === null ||
              (listed.has(id) && startedAt - confirmedAt < HIDE_GRACE_MS),
          ),
        );
        return next.size === prev.size ? prev : next;
      });
      setStatus("ready");
    } catch {
      if (request === latest.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - fetchedAt.current > STALE_MS) {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const setCompleted = useCallback(async (task: BoardTask, completed: boolean) => {
    const mark = (hidden: boolean, confirmedAt: number | null = null) =>
      setDone((prev) => {
        const next = new Map(prev);
        if (hidden) next.set(task.id, confirmedAt);
        else next.delete(task.id);
        return next;
      });

    mark(completed);
    try {
      const response = await fetch(`/api/task/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (!response.ok) throw new Error();
      if (completed) mark(true, Date.now());
    } catch {
      mark(!completed);
      toast.error(`Couldn't update “${describe(task)}”. Check the connection and try again.`);
    }
  }, []);

  const complete = useCallback(
    (task: BoardTask) => {
      setCompleted(task, true);
      toast.success(`Done: ${describe(task)}`, {
        action: { label: "Undo", onClick: () => setCompleted(task, false) },
      });
    },
    [setCompleted],
  );

  const tasks = data?.tasks.filter((t) => !done.has(t.id)) ?? [];

  return { data, tasks, status, refresh, complete };
}

export const describe = (task: BoardTask) =>
  task.guest ? `${task.title} for ${task.guest}` : task.title;
