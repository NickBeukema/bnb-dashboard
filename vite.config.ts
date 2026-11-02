/// <reference types="vitest/config" />
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getRequestListener } from "@hono/node-server";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig, loadEnv } from "vite";

// The commit being built. Every deploy pulls a new one, so open boards can tell they're behind.
function commit() {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

/** In dev, hands the API's paths to the Hono app (src/server/app.ts), reloaded as it changes */
function api(): Plugin {
  return {
    name: "bnb-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api/") && req.url !== "/v3") return next();
        server
          .ssrLoadModule("/src/server/app.ts")
          .then(({ default: app }) => getRequestListener(app.fetch)(req, res))
          .catch(next);
      });
    },
  };
}

export default defineConfig(({ command, mode, isSsrBuild }) => {
  // The API reads its feed URLs and token from process.env, as the production server does
  if (command === "serve" && mode !== "test") {
    for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ""))) {
      process.env[key] ??= value;
    }
  }

  return {
    plugins: [react(), tailwindcss(), api()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    // Stamped into both builds (see src/lib/version.ts); tests and dev see "dev"
    define: command === "build" ? { "import.meta.env.BUILD_ID": JSON.stringify(commit()) } : {},
    // `vite build` makes the board; `vite build --ssr src/server/index.ts` the server
    build: { outDir: isSsrBuild ? "dist/server" : "dist/client" },
    server: { port: 3000 },
    test: {
      // Components default to a browser-like DOM; server tests opt into node with
      // `// @vitest-environment node` at the top of the file.
      environment: "jsdom",
      setupFiles: ["./test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      restoreMocks: true,
      unstubGlobals: true,
      unstubEnvs: true,
    },
  };
});
