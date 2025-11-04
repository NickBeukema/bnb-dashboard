import { NextResponse } from "next/server";
import { TodoistApi } from "@doist/todoist-api-typescript";

const TODOIST_API_TOKEN = process.env.TODOIST_API_TOKEN;

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
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
