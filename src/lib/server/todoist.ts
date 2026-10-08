import { addDays, format, subDays } from "date-fns";
import type { TodoistApi } from "@doist/todoist-sdk";
import type { Task } from "@/lib/calendar-types";
import { SYNC_DAYS, type NewTask } from "./task-plan";

/** The most useful text from a Todoist SDK error: its response body, else the message */
export function todoistErrorMessage(error: unknown): string {
  const e = error as { responseData?: unknown; message?: unknown } | null;
  if (typeof e?.responseData === "string" && e.responseData) return e.responseData;
  if (typeof e?.message === "string" && e.message) return e.message;
  return "Unknown error";
}

/** Reads every page of a cursor-paginated Todoist endpoint */
async function readAll<T>(
  fetchPage: (cursor: string | null) => Promise<{ items: T[]; nextCursor: string | null }>,
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  do {
    const page = await fetchPage(cursor);
    all.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return all;
}

/**
 * Ids (from task descriptions) of the generated tasks Todoist already has, open or completed.
 * Covers 5 days back to SYNC_DAYS + 3 ahead, since review requests fall after the stay ends.
 * Todoist rejects completed-task ranges over 6 weeks, so keep this window under that.
 */
export async function fetchExistingTaskIds(api: TodoistApi, now: Date): Promise<Set<string>> {
  const since = subDays(now, 5);
  const until = addDays(now, SYNC_DAYS + 3);
  const query = `date after: ${format(since, "M/d/yyyy")} & date before: ${format(until, "M/d/yyyy")}`;

  const open = await readAll(async (cursor) => {
    const page = await api.getTasksByFilter({ query, limit: 200, cursor });
    return { items: page.results, nextCursor: page.nextCursor };
  });
  const completed = await readAll(async (cursor) => {
    const page = await api.getCompletedTasksByDueDate({
      since: since.toISOString(),
      until: until.toISOString(),
      limit: 200,
      cursor,
    });
    return { items: page.items, nextCursor: page.nextCursor };
  });

  return new Set([...open, ...completed].map((task) => task.description));
}

/** Creates the planned tasks one by one. A failure is logged and skipped, not fatal. */
export async function createTasks(api: TodoistApi, tasks: NewTask[]) {
  const created: NewTask[] = [];
  for (const task of tasks) {
    try {
      await api.addTask(task);
      created.push(task);
    } catch (error) {
      console.error("Error adding task:", todoistErrorMessage(error));
    }
  }
  return created;
}

/** Every open task, soonest due first */
export async function fetchOpenTasks(api: TodoistApi): Promise<Task[]> {
  const tasks = await readAll(async (cursor) => {
    const page = await api.getTasks({ limit: 200, cursor });
    return { items: page.results, nextCursor: page.nextCursor };
  });
  return tasks
    .map((task) => ({
      id: task.id,
      name: task.content,
      description: task.description,
      completed: task.completedAt !== null,
      dueDate: task.due?.date || "",
      priority: task.priority,
      labels: task.labels,
    }))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}
