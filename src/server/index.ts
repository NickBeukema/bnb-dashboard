// The production server: the API plus the built board from dist/client. Run from the repo root
// (`npm start`), which is where the paths below and .env are read from.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { compress } from "hono/compress";
import app from "./app";

const ROOT = "./dist/client";
const PORT = Number(process.env.PORT ?? 3000);

const server = new Hono();

server.use(compress());

server.use("*", async (c, next) => {
  await next();
  const path = c.req.path;
  if (path.startsWith("/assets/")) {
    // Vite's build files have content hashes in their names, so they never change
    c.header("Cache-Control", "public, max-age=31536000, immutable");
  } else if (path === "/sw.js") {
    // Browsers must always check for a new worker, or a deploy could be hidden behind it
    c.header("Content-Type", "application/javascript; charset=utf-8");
    c.header("Cache-Control", "no-cache, no-store, must-revalidate");
    c.header("Content-Security-Policy", "default-src 'self'; script-src 'self'");
  } else if (!path.startsWith("/api/")) {
    // The page, manifest and icons: always check, so a deploy shows up on the next load
    c.header("Cache-Control", "no-cache");
  }
});

server.route("/", app);
server.use("*", serveStatic({ root: ROOT }));

serve({ fetch: server.fetch, port: PORT, hostname: "0.0.0.0" }, ({ port }) => {
  console.log(`Board listening on http://0.0.0.0:${port}`);
});
