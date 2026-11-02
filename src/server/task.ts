import { TodoistApi } from "@doist/todoist-sdk";
import { todoistErrorMessage } from "@/lib/server/todoist";

// Marks a task done (or not done, for undo). A completed task still shows up in Todoist's
// completed list, so the calendar sync won't re-create it.
export async function updateTask(request: Request, id: string) {
  const body = await request.json().catch(() => null);
  if (typeof body?.completed !== "boolean") {
    return Response.json({ error: "Body must be { completed: boolean }" }, { status: 400 });
  }
  const completed: boolean = body.completed;

  const token = process.env.TODOIST_API_TOKEN;
  if (!token) {
    return Response.json(
      { error: "Missing required environment variable: TODOIST_API_TOKEN" },
      { status: 500 },
    );
  }

  try {
    const api = new TodoistApi(token);
    // Todoist answering `false` means it refused (502); a thrown error carries its own message
    if (!(await (completed ? api.closeTask(id) : api.reopenTask(id)))) {
      return Response.json({ error: "Failed to update task" }, { status: 502 });
    }
    return Response.json({ success: true, id, completed });
  } catch (error) {
    return Response.json(
      { error: "Error updating task", details: todoistErrorMessage(error) },
      { status: 500 },
    );
  }
}
