import { Hono } from "hono";
import { BUILD_ID } from "@/lib/version";
import { getCalendar } from "./calendar";
import { updateTask } from "./task";

/** The API. The Vite dev server and the production server (index.ts) both route to it. */
const app = new Hono();

app.get("/api/calendar", () => getCalendar());

app.patch("/api/task/:id", (c) => updateTask(c.req.raw, c.req.param("id")));

// Which build the server is running. Open boards compare it with their own to offer a refresh.
app.get("/api/version", (c) => c.json({ version: BUILD_ID }, 200, { "Cache-Control": "no-store" }));

// The board used to live at /v3; keep old bookmarks working
app.get("/v3", (c) => c.redirect("/", 307));

export default app;
