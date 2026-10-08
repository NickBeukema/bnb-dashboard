import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarSource, Task } from "@/lib/calendar-types";
import type { BoardTask } from "./model";
import { describe as describeTask, useBoard } from "./use-board";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const EVENTS: CalendarSource[] = [
  {
    name: "Wavesong",
    color: "#1e56b0",
    events: [
      {
        id: "stay-1",
        title: "Reserved - Jen",
        start: "2026-10-09T15:00:00.000Z",
        end: "2026-10-13T04:00:00.000Z",
        location: "Wavesong",
        backgroundColor: "#1e56b0",
        allDay: true,
      },
    ],
  },
];

const TASKS: Task[] = [
  {
    id: "t1",
    name: "Send Welcome Letter (Reserved - Jen)",
    description: "bnb-stay-1-send-welcome-letter",
    completed: false,
    dueDate: "2026-10-06",
    priority: 1,
    labels: ["Wavesong"],
  },
  {
    id: "t2",
    name: "Make Door Code (Reserved - Jen)",
    description: "bnb-stay-1-make-door-code",
    completed: false,
    dueDate: "2026-10-06",
    priority: 1,
    labels: ["Wavesong"],
  },
];

const LAST_UPDATED = "2026-10-07T20:00:00.000Z";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const calendarBody = () => ({ events: EVENTS, tasks: TASKS, lastUpdated: LAST_UPDATED });

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

/** Routes fetch calls: GET /api/calendar to `calendar`, PATCH /api/task/:id to `patch` */
function mockFetch({ calendar, patch }: { calendar?: Handler; patch?: Handler } = {}) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/calendar") return (calendar ?? (() => json(calendarBody())))(url, init);
    if (url.startsWith("/api/task/")) return (patch ?? (() => json({ success: true })))(url, init);
    throw new Error(`Unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const calendarCalls = (fn: ReturnType<typeof mockFetch>) =>
  fn.mock.calls.filter(([url]) => String(url) === "/api/calendar").length;

const patchCalls = (fn: ReturnType<typeof mockFetch>) =>
  fn.mock.calls
    .filter(([url]) => String(url).startsWith("/api/task/"))
    .map(([url, init]) => ({ url: String(url), method: init?.method, body: JSON.parse(String(init?.body)) }));

/** Resolvable promise, to hold a request open */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

async function renderReady() {
  const hook = renderHook(() => useBoard());
  await waitFor(() => expect(hook.result.current.status).toBe("ready"));
  return hook;
}

beforeEach(() => {
  toast.mockClear();
  toast.success.mockClear();
  toast.error.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useBoard loading", () => {
  it("starts loading, then maps the API response into stays and tasks", async () => {
    const fetchMock = mockFetch();
    const { result } = renderHook(() => useBoard());

    expect(result.current.status).toBe("loading");
    expect(result.current.data).toBeNull();
    expect(result.current.tasks).toEqual([]);

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledWith("/api/calendar", { cache: "no-store" });

    const { data, tasks } = result.current;
    expect(data?.stays).toHaveLength(1);
    expect(data?.stays[0]).toMatchObject({ id: "stay-1", guest: "Jen", nights: 3 });
    expect(data?.stays[0].checkIn).toEqual(new Date(2026, 9, 9));
    expect(data?.lastUpdated).toEqual(new Date(LAST_UPDATED));
    expect(tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(tasks[0]).toMatchObject({ kind: "welcome", guest: "Jen", stayId: "stay-1" });
  });

  it("reports an error when the API answers with a failure", async () => {
    mockFetch({ calendar: () => json({ error: "Internal Server Error", events: [], tasks: [] }, 500) });
    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.data).toBeNull();
  });

  it("reports an error when the network fails", async () => {
    mockFetch({
      calendar: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  it("keeps the last good data when a later refresh fails", async () => {
    let fail = false;
    mockFetch({ calendar: () => (fail ? json({}, 500) : json(calendarBody())) });
    const { result } = await renderReady();
    const before = result.current.data;

    fail = true;
    await act(() => result.current.refresh());
    expect(result.current.status).toBe("error");
    expect(result.current.data).toBe(before);
  });

  it("shows refreshing (not loading) while a refresh is in flight", async () => {
    let pending: ReturnType<typeof deferred<Response>> | null = null;
    mockFetch({ calendar: () => (pending ? pending.promise : json(calendarBody())) });
    const { result } = await renderReady();

    pending = deferred<Response>();
    let refreshing!: Promise<void>;
    act(() => {
      refreshing = result.current.refresh();
    });
    expect(result.current.status).toBe("refreshing");

    pending.resolve(json(calendarBody()));
    await act(() => refreshing);
    expect(result.current.status).toBe("ready");
  });

  it("ignores a slow response that a newer refresh has overtaken", async () => {
    const responses: ReturnType<typeof deferred<Response>>[] = [];
    let hold = false;
    mockFetch({
      calendar: () => {
        if (!hold) return json(calendarBody());
        const d = deferred<Response>();
        responses.push(d);
        return d.promise;
      },
    });
    const { result } = await renderReady();

    hold = true;
    let older!: Promise<void>;
    let newer!: Promise<void>;
    act(() => {
      older = result.current.refresh();
    });
    act(() => {
      newer = result.current.refresh();
    });

    responses[1].resolve(json({ ...calendarBody(), tasks: [TASKS[1]] }));
    await act(() => newer);
    responses[0].resolve(json(calendarBody()));
    await act(() => older);

    expect(result.current.tasks.map((t) => t.id)).toEqual(["t2"]);
    expect(result.current.status).toBe("ready");
  });

  it("doesn't flag an error for a failed refresh that a newer one overtook", async () => {
    const responses: ReturnType<typeof deferred<Response>>[] = [];
    let hold = false;
    mockFetch({
      calendar: () => {
        if (!hold) return json(calendarBody());
        const d = deferred<Response>();
        responses.push(d);
        return d.promise;
      },
    });
    const { result } = await renderReady();

    hold = true;
    let older!: Promise<void>;
    let newer!: Promise<void>;
    act(() => {
      older = result.current.refresh();
    });
    act(() => {
      newer = result.current.refresh();
    });

    responses[1].resolve(json(calendarBody()));
    await act(() => newer);
    responses[0].resolve(json({}, 502));
    await act(() => older);

    expect(result.current.status).toBe("ready");
  });

  it("recovers from an error on the next refresh", async () => {
    let fail = true;
    mockFetch({ calendar: () => (fail ? json({}, 502) : json(calendarBody())) });
    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.status).toBe("error"));

    fail = false;
    await act(() => result.current.refresh());
    expect(result.current.status).toBe("ready");
    expect(result.current.tasks).toHaveLength(2);
  });
});

describe("useBoard polling", () => {
  it("refreshes every five minutes and stops after unmount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = mockFetch();
    const { result, unmount } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(calendarCalls(fetchMock)).toBe(1);

    await act(() => vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 1000));
    expect(calendarCalls(fetchMock)).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(calendarCalls(fetchMock)).toBe(2);
    await act(() => vi.advanceTimersByTimeAsync(5 * 60 * 1000));
    expect(calendarCalls(fetchMock)).toBe(3);

    unmount();
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(calendarCalls(fetchMock)).toBe(3);
  });
});

describe("useBoard visibility refresh", () => {
  let visibility: DocumentVisibilityState = "visible";

  beforeEach(() => {
    visibility = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  });

  const becomeVisible = () =>
    act(async () => {
      visibility = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });

  it("refreshes on return only when the data is over a minute old", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date", "setInterval", "clearInterval"] });
    const fetchMock = mockFetch();
    await renderReady();
    expect(calendarCalls(fetchMock)).toBe(1);

    // Fresh data: coming back does nothing
    vi.setSystemTime(Date.now() + 30 * 1000);
    await becomeVisible();
    expect(calendarCalls(fetchMock)).toBe(1);

    // Stale data: coming back refreshes
    vi.setSystemTime(Date.now() + 31 * 1000);
    await becomeVisible();
    await waitFor(() => expect(calendarCalls(fetchMock)).toBe(2));
  });

  it("ignores the tab being hidden", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date", "setInterval", "clearInterval"] });
    const fetchMock = mockFetch();
    await renderReady();

    vi.setSystemTime(Date.now() + 10 * 60 * 1000);
    await act(async () => {
      visibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(calendarCalls(fetchMock)).toBe(1);
  });

  it("refreshes on return after a failed first load", async () => {
    let fail = true;
    const fetchMock = mockFetch({ calendar: () => (fail ? json({}, 500) : json(calendarBody())) });
    const { result } = renderHook(() => useBoard());
    await waitFor(() => expect(result.current.status).toBe("error"));

    fail = false;
    await becomeVisible();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(calendarCalls(fetchMock)).toBe(2);
  });
});

describe("useBoard completing tasks", () => {
  const taskById = (tasks: BoardTask[], id: string) => tasks.find((t) => t.id === id)!;

  it("hides the task at once, PATCHes it complete and offers Undo", async () => {
    const fetchMock = mockFetch();
    const { result } = await renderReady();
    const t1 = taskById(result.current.tasks, "t1");

    act(() => result.current.complete(t1));
    expect(result.current.tasks.map((t) => t.id)).toEqual(["t2"]);
    // The underlying data is untouched; only the view hides it
    expect(result.current.data?.tasks).toHaveLength(2);

    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));
    expect(patchCalls(fetchMock)[0]).toEqual({ url: "/api/task/t1", method: "PATCH", body: { completed: true } });
    const [, init] = fetchMock.mock.calls.find(([url]) => String(url) === "/api/task/t1")!;
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });

    expect(toast.success).toHaveBeenCalledWith("Done: Welcome letter for Jen", {
      action: { label: "Undo", onClick: expect.any(Function) },
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("Undo reopens the task and shows it again", async () => {
    const fetchMock = mockFetch();
    const { result } = await renderReady();
    act(() => result.current.complete(taskById(result.current.tasks, "t1")));
    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));

    const [, options] = toast.success.mock.calls[0];
    await act(async () => options.action.onClick());

    expect(result.current.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(patchCalls(fetchMock)[1]).toEqual({ url: "/api/task/t1", method: "PATCH", body: { completed: false } });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("brings the task back and explains when completing fails", async () => {
    mockFetch({ patch: () => json({ error: "Failed to update task" }, 502) });
    const { result } = await renderReady();

    act(() => result.current.complete(taskById(result.current.tasks, "t2")));
    expect(result.current.tasks.map((t) => t.id)).toEqual(["t1"]);

    await waitFor(() => expect(result.current.tasks.map((t) => t.id)).toEqual(["t1", "t2"]));
    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't update “Door code for Jen”. Check the connection and try again.",
    );
  });

  it("hides the task again when Undo fails", async () => {
    let failPatch = false;
    mockFetch({ patch: () => (failPatch ? json({}, 500) : json({ success: true })) });
    const { result } = await renderReady();
    act(() => result.current.complete(taskById(result.current.tasks, "t1")));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    failPatch = true;
    const [, options] = toast.success.mock.calls[0];
    await act(async () => options.action.onClick());

    expect(result.current.tasks.map((t) => t.id)).toEqual(["t2"]);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("brings the task back when the network drops", async () => {
    mockFetch({
      patch: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const { result } = await renderReady();
    act(() => result.current.complete(taskById(result.current.tasks, "t1")));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(result.current.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("keeps a completed task hidden across a refresh that still lists it", async () => {
    mockFetch();
    const { result } = await renderReady();
    act(() => result.current.complete(taskById(result.current.tasks, "t1")));
    await act(() => result.current.refresh());
    expect(result.current.tasks.map((t) => t.id)).toEqual(["t2"]);
  });

  it("shows a task again when a later sync lists it after a sync dropped it (reopened in Todoist)", async () => {
    let tasks = TASKS;
    const fetchMock = mockFetch({ calendar: () => json({ ...calendarBody(), tasks }) });
    const { result } = await renderReady();
    act(() => result.current.complete(taskById(result.current.tasks, "t1")));
    await waitFor(() => expect(patchCalls(fetchMock)).toHaveLength(1));

    tasks = [TASKS[1]];
    await act(() => result.current.refresh());
    expect(result.current.tasks.map((t) => t.id)).toEqual(["t2"]);

    tasks = TASKS;
    await act(() => result.current.refresh());
    expect(result.current.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("trusts a sync that still lists a completed task once the grace period is over", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] });
    mockFetch();
    const { result } = await renderReady();
    act(() => result.current.complete(taskById(result.current.tasks, "t1")));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await act(async () => {});

    vi.setSystemTime(Date.now() + 60 * 1000);
    await act(() => result.current.refresh());
    expect(result.current.tasks.map((t) => t.id)).toEqual(["t2"]);

    vi.setSystemTime(Date.now() + 2 * 60 * 1000);
    await act(() => result.current.refresh());
    expect(result.current.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("keeps hiding a task whose update is still in flight, whatever the sync says", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] });
    const patch = deferred<Response>();
    mockFetch({ patch: () => patch.promise });
    const { result } = await renderReady();
    act(() => result.current.complete(taskById(result.current.tasks, "t1")));

    vi.setSystemTime(Date.now() + 10 * 60 * 1000);
    await act(() => result.current.refresh());
    expect(result.current.tasks.map((t) => t.id)).toEqual(["t2"]);

    patch.resolve(json({ success: true }));
  });
});

describe("describe", () => {
  const base: BoardTask = {
    id: "x",
    kind: "review",
    title: "Review request",
    guest: "Deb",
    property: null,
    stayId: null,
    due: new Date(2026, 9, 7),
  };

  it("names the guest when there is one", () => {
    expect(describeTask(base)).toBe("Review request for Deb");
  });

  it("falls back to the title", () => {
    expect(describeTask({ ...base, kind: "other", title: "Buy coffee", guest: null })).toBe("Buy coffee");
  });
});
