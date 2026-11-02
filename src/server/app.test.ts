// @vitest-environment node
import { describe, expect, it } from "vitest";
import app from "./app";

describe("GET /api/version", () => {
  it("answers with this build's id, uncached", async () => {
    const response = await app.request("/api/version");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ version: "dev" });
  });
});

describe("GET /v3", () => {
  it("redirects old bookmarks to the board", async () => {
    const response = await app.request("/v3");
    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe("/");
  });
});
