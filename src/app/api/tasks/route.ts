import { TodoistApi } from "@doist/todoist-api-typescript";
import { NextResponse } from "next/server";

export type Task = {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  dueDate: string;
  priority: number;
  project: string;
  labels: string[];
};

export async function GET(request: Request) {
  const api = new TodoistApi(process.env.TODOIST_API_TOKEN || "");
  const tasks = await api.getTasks({
    //   const tasks = await api.getTasksByFilter({
    // query: "completed:false",
  });

  console.log(tasks);

  const formattedTasks: Task[] = tasks.results.map((task) => ({
    id: task.id,
    name: task.content,
    description: task.description,
    completed: task.completedAt !== null,
    dueDate: task.due?.date || "",
    priority: task.priority,
    project: task.projectId,
    labels: task.labels,
  }));

  return NextResponse.json(formattedTasks);
}
