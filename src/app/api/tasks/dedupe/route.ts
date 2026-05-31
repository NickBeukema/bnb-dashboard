import { NextResponse } from "next/server";
import { TodoistApi } from "@doist/todoist-api-typescript";

import { paginateAll } from "@/app/api/calendar/pagination";
import { planDedupe } from "@/app/api/calendar/dedupe";

const TODOIST_API_TOKEN = process.env.TODOIST_API_TOKEN;

export async function POST() {
  if (!TODOIST_API_TOKEN) {
    return NextResponse.json(
      { error: "Missing required environment variable: TODOIST_API_TOKEN" },
      { status: 500 },
    );
  }

  const api = new TodoistApi(TODOIST_API_TOKEN);

  try {
    const allOpen = await paginateAll((cursor) =>
      api
        .getTasks({ cursor, limit: 200 })
        .then((r) => ({ items: r.results, nextCursor: r.nextCursor })),
    );

    const plan = planDedupe(
      allOpen.map((t) => ({
        id: t.id,
        description: t.description,
        addedAt: t.addedAt,
      })),
    );

    const deletedIds: string[] = [];
    const errors: { id: string; message: string }[] = [];

    for (const task of plan.toDelete) {
      try {
        const ok = await api.deleteTask(task.id);
        if (ok) {
          deletedIds.push(task.id);
        } else {
          errors.push({ id: task.id, message: "Todoist returned false" });
        }
      } catch (e) {
        const message =
          (e as { responseData?: string })?.responseData ||
          (e as Error)?.message ||
          "Unknown error";
        errors.push({ id: task.id, message });
      }
    }

    return NextResponse.json(
      {
        groups: plan.groups,
        kept: plan.toKeep.length,
        attempted: plan.toDelete.length,
        deleted: deletedIds.length,
        deletedIds,
        errors,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      (error as { responseData?: string })?.responseData ||
      (error as Error)?.message ||
      "Unknown error";
    return NextResponse.json(
      { error: "Error deduping tasks", details: message },
      { status: 500 },
    );
  }
}
