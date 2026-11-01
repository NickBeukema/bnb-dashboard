import { addDays, format, subDays } from "date-fns";
import type { TodoistApi } from "@doist/todoist-sdk";
import type { Task } from "@/lib/calendar-types";
import { SYNC_DAYS, type NewTask, type OpenTask } from "./task-plan";

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
 * The generated tasks Todoist already has: the ids (from task descriptions) of every one, open
 * or completed, and the open ones in full. Covers 7 days back, a week of trash reminders, to
 * SYNC_DAYS + 3 ahead, since review requests fall after the stay ends.
 * Todoist rejects completed-task ranges over 6 weeks, so keep this window under that.
 */
export async function fetchExistingTasks(
  api: TodoistApi,
  now: Date,
): Promise<{ ids: Set<string>; open: OpenTask[] }> {
  const since = subDays(now, 7);
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

  return {
    ids: new Set([...open, ...completed].map((task) => task.description)),
    open: open.map((task) => ({
      id: task.id,
      description: task.description,
      dueDate: task.due?.date ?? "",
      labels: task.labels,
    })),
  };
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

/** Deletes tasks by Todoist id one by one. A failure is logged and skipped, not fatal. */
export async function deleteTasks(api: TodoistApi, ids: string[]) {
  let deleted = 0;
  for (const id of ids) {
    try {
      await api.deleteTask(id);
      deleted++;
    } catch (error) {
      console.error("Error deleting task:", todoistErrorMessage(error));
    }
  }
  return deleted;
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
    .toSorted((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}
