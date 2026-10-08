import { NextResponse } from "next/server";
import { TodoistApi } from "@doist/todoist-sdk";

const TODOIST_API_TOKEN = process.env.TODOIST_API_TOKEN;

// Marks a task done (or not done, for undo). Prefer this over DELETE: a completed task
// still shows up in Todoist's completed list, so the calendar sync won't re-create it.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.completed !== "boolean") {
    return NextResponse.json(
      { error: "Body must be { completed: boolean }" },
      { status: 400 }
    );
  }

  if (!TODOIST_API_TOKEN) {
    return NextResponse.json(
      { error: "Missing required environment variable: TODOIST_API_TOKEN" },
      { status: 500 }
    );
  }

  try {
    const api = new TodoistApi(TODOIST_API_TOKEN);
    const isSuccess = body.completed
      ? await api.closeTask(taskId)
      : await api.reopenTask(taskId);

    if (!isSuccess) {
      return NextResponse.json({ error: "Failed to update task" }, { status: 502 });
    }

    return NextResponse.json({ success: true, id: taskId, completed: body.completed });
  } catch (error: any) {
    const message =
      (error?.responseData as string) || error?.message || "Unknown error";
    return NextResponse.json(
      { error: "Error updating task", details: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  if (!taskId) {
    return NextResponse.json(
      { error: "Task id is required in the route parameter" },
      { status: 400 }
    );
  }

  try {
    if (!TODOIST_API_TOKEN) {
      return NextResponse.json(
        { error: "Missing required environment variable: TODOIST_API_TOKEN" },
        { status: 500 }
      );
    }

    const api = new TodoistApi(TODOIST_API_TOKEN);

    const isSuccess = await api.deleteTask(taskId);

    if (!isSuccess) {
      return NextResponse.json(
        { error: "Failed to delete task" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, id: taskId }, { status: 200 });
  } catch (error: any) {
    const message =
      (error?.responseData as string) || error?.message || "Unknown error";
    return NextResponse.json(
      { error: "Error deleting task", details: message },
      { status: 500 }
    );
  }
}
