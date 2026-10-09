// @vitest-environment node
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/version", () => {
  it("answers with this build's id, uncached", async () => {
    const response = GET();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ version: "dev" });
  });
});
