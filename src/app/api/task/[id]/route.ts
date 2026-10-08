import { NextResponse } from "next/server";
import { TodoistApi } from "@doist/todoist-sdk";
import { todoistErrorMessage } from "@/lib/server/todoist";

type Params = { params: Promise<{ id: string }> };

// Marks a task done (or not done, for undo). A completed task still shows up in Todoist's
// completed list, so the calendar sync won't re-create it.
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.completed !== "boolean") {
    return NextResponse.json({ error: "Body must be { completed: boolean }" }, { status: 400 });
  }
  const completed: boolean = body.completed;

  const token = process.env.TODOIST_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Missing required environment variable: TODOIST_API_TOKEN" },
      { status: 500 },
    );
  }

  try {
    const api = new TodoistApi(token);
    // Todoist answering `false` means it refused (502); a thrown error carries its own message
    if (!(await (completed ? api.closeTask(id) : api.reopenTask(id)))) {
      return NextResponse.json({ error: "Failed to update task" }, { status: 502 });
    }
    return NextResponse.json({ success: true, id, completed });
  } catch (error) {
    return NextResponse.json(
      { error: "Error updating task", details: todoistErrorMessage(error) },
      { status: 500 },
    );
  }
}
