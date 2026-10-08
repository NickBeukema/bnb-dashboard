"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CalendarSource, Task } from "@/app/api/calendar/route";
import { type BoardData, type BoardTask, toStays, toTasks } from "./model";

const POLL_MS = 5 * 60 * 1000;
// Coming back to the tab (or waking a phone) refreshes if the data is older than this
const STALE_MS = 60 * 1000;

type Status = "loading" | "ready" | "refreshing" | "error";

export function useBoard() {
  const [data, setData] = useState<BoardData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  // Tasks ticked off on this screen, hidden right away instead of waiting for the next sync
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const fetchedAt = useRef(0);

  const refresh = useCallback(async () => {
    setStatus((s) => (s === "loading" ? s : "refreshing"));
    try {
      const response = await fetch("/api/calendar", { cache: "no-store" });
      const json: { events: CalendarSource[]; tasks: Task[]; lastUpdated: string } =
        await response.json();
      if (!response.ok) throw new Error();
      fetchedAt.current = Date.now();
      setData({
        stays: toStays(json.events),
        tasks: toTasks(json.tasks),
        lastUpdated: new Date(json.lastUpdated),
      });
      setStatus("ready");
    } catch {
      setStatus("error");
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
    setDone((prev) => {
      const next = new Set(prev);
      if (completed) next.add(task.id);
      else next.delete(task.id);
      return next;
    });
    try {
      const response = await fetch(`/api/task/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setDone((prev) => {
        const next = new Set(prev);
        if (completed) next.delete(task.id);
        else next.add(task.id);
        return next;
      });
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
