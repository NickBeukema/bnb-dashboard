// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  tokens: [] as string[],
  api: {
    closeTask: vi.fn(),
    reopenTask: vi.fn(),
  },
}));

vi.mock("@doist/todoist-sdk", () => ({
  TodoistApi: class {
    constructor(token: string) {
      sdk.tokens.push(token);
      return sdk.api;
    }
  },
}));

// The route reads the token at import time, so each test imports a fresh copy
async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

const patch = async (body: string | object | undefined, id = "task-1") => {
  const { PATCH } = await loadRoute();
  const request = new Request(`http://localhost/api/task/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" || body === undefined ? body : JSON.stringify(body),
  });
  const response = await PATCH(request, params(id));
  return { status: response.status, body: await response.json() };
};

beforeEach(() => {
  vi.stubEnv("TODOIST_API_TOKEN", "test-token");
  sdk.tokens.length = 0;
  sdk.api.closeTask.mockReset().mockResolvedValue(true);
  sdk.api.reopenTask.mockReset().mockResolvedValue(true);
});

describe("PATCH /api/task/[id]", () => {
  it("completes a task", async () => {
    const { status, body } = await patch({ completed: true }, "abc");
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, id: "abc", completed: true });
    expect(sdk.api.closeTask).toHaveBeenCalledWith("abc");
    expect(sdk.api.reopenTask).not.toHaveBeenCalled();
    expect(sdk.tokens).toEqual(["test-token"]);
  });

  it("reopens a task, for undo", async () => {
    const { status, body } = await patch({ completed: false }, "abc");
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, id: "abc", completed: false });
    expect(sdk.api.reopenTask).toHaveBeenCalledWith("abc");
    expect(sdk.api.closeTask).not.toHaveBeenCalled();
  });

  it.each([
    ["no body", undefined],
    ["invalid JSON", "{completed: true"],
    ["an empty object", {}],
    ["a string flag", { completed: "true" }],
    ["a numeric flag", { completed: 1 }],
    ["null", "null"],
  ])("rejects %s with 400", async (_, body) => {
    const { status, body: json } = await patch(body);
    expect(status).toBe(400);
    expect(json).toEqual({ error: "Body must be { completed: boolean }" });
    expect(sdk.api.closeTask).not.toHaveBeenCalled();
    expect(sdk.api.reopenTask).not.toHaveBeenCalled();
  });

  it("returns 500 without a Todoist token", async () => {
    vi.stubEnv("TODOIST_API_TOKEN", "");
    const { status, body } = await patch({ completed: true });
    expect(status).toBe(500);
    expect(body.error).toMatch(/TODOIST_API_TOKEN/);
    expect(sdk.api.closeTask).not.toHaveBeenCalled();
  });

  it("returns 502 when Todoist reports failure", async () => {
    sdk.api.closeTask.mockResolvedValue(false);
    const { status, body } = await patch({ completed: true });
    expect(status).toBe(502);
    expect(body).toEqual({ error: "Failed to update task" });
  });

  it("returns 500 with Todoist's response when the call throws", async () => {
    sdk.api.reopenTask.mockRejectedValue(
      Object.assign(new Error("Request failed"), { responseData: "Task not found" }),
    );
    const { status, body } = await patch({ completed: false });
    expect(status).toBe(500);
    expect(body).toEqual({ error: "Error updating task", details: "Task not found" });
  });

  it("falls back to the error message, then a generic one", async () => {
    sdk.api.closeTask.mockRejectedValueOnce(new Error("socket hang up"));
    expect((await patch({ completed: true })).body.details).toBe("socket hang up");

    sdk.api.closeTask.mockRejectedValueOnce({});
    expect((await patch({ completed: true })).body.details).toBe("Unknown error");
  });
});
