// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A fake Todoist client. Every `new TodoistApi(token)` in the route returns this same object,
// so tests can script responses and inspect calls without ever reaching Todoist.
const sdk = vi.hoisted(() => ({
  tokens: [] as string[],
  api: {
    getTasksByFilter: vi.fn(),
    getCompletedTasksByDueDate: vi.fn(),
    getTasks: vi.fn(),
    addTask: vi.fn(),
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

const FEEDS = {
  WAVESONG_ICAL_URL: "https://ical.test/wavesong",
  RED_ICAL_URL: "https://ical.test/red",
  LAKE_BREEZE_ICAL_URL: "https://ical.test/lake-breeze",
  NAUTICAL_NEST_ICAL_URL: "https://ical.test/nautical-nest",
};
const TOKEN = "test-token";

type Vevent = {
  uid: string;
  start: string; // YYYYMMDD
  end?: string; // YYYYMMDD
  summary?: string;
  summaryLine?: string; // a full SUMMARY line, for parameterized summaries
  description?: string;
};

const ics = (events: Vevent[], extra = "") =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    ...events.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTART;VALUE=DATE:${e.start}`,
      ...(e.end ? [`DTEND;VALUE=DATE:${e.end}`] : []),
      e.summaryLine ?? `SUMMARY:${e.summary ?? "Reserved"}`,
      ...(e.description ? [`DESCRIPTION:${e.description}`] : []),
      "END:VEVENT",
    ]),
    extra,
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

/** Feed contents by URL. Feeds left out are empty calendars. */
let feeds: Record<string, string | Response>;
const fetchMock = vi.fn(async (input: unknown) => {
  const url = String(input);
  const feed = feeds[url];
  if (feed instanceof Response) return feed;
  if (!Object.values(FEEDS).includes(url)) throw new Error(`Unexpected fetch: ${url}`);
  return new Response(feed ?? ics([]), { status: 200 });
});

const page = <T>(results: T[], nextCursor: string | null = null) => ({ results, nextCursor });
const completedPage = <T>(items: T[], nextCursor: string | null = null) => ({ items, nextCursor });

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

async function get() {
  const { GET } = await loadRoute();
  const response = await GET();
  return { status: response.status, body: await response.json() };
}

const addedTasks = () => sdk.api.addTask.mock.calls.map(([args]) => args);

beforeEach(() => {
  // Noon on Wed Oct 7, 2026 in New York (EDT)
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T16:00:00.000Z"));

  for (const [name, value] of Object.entries(FEEDS)) vi.stubEnv(name, value);
  vi.stubEnv("TODOIST_API_TOKEN", TOKEN);

  feeds = {};
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();

  sdk.tokens.length = 0;
  sdk.api.getTasksByFilter.mockReset().mockResolvedValue(page([]));
  sdk.api.getCompletedTasksByDueDate.mockReset().mockResolvedValue(completedPage([]));
  sdk.api.getTasks.mockReset().mockResolvedValue(page([]));
  sdk.api.addTask.mockReset().mockResolvedValue({ id: "new" });

  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/calendar: configuration", () => {
  it("returns 500 naming every missing environment variable, without syncing", async () => {
    vi.stubEnv("RED_ICAL_URL", "");
    vi.stubEnv("TODOIST_API_TOKEN", "");

    const { status, body } = await get();

    expect(status).toBe(500);
    expect(body).toEqual({
      error: "Internal Server Error",
      details: "Missing required environment variables: RED_ICAL_URL, TODOIST_API_TOKEN",
      events: [],
      tasks: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sdk.api.getTasksByFilter).not.toHaveBeenCalled();
  });

  it("lists all five variables when none are set", async () => {
    vi.unstubAllEnvs();
    const { status, body } = await get();
    expect(status).toBe(500);
    expect(body.details).toBe(
      "Missing required environment variables: WAVESONG_ICAL_URL, RED_ICAL_URL, LAKE_BREEZE_ICAL_URL, NAUTICAL_NEST_ICAL_URL, TODOIST_API_TOKEN",
    );
  });

  it("does not need the retired Betsie feeds", async () => {
    const { status } = await get();
    expect(status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("uses the Todoist token from the environment", async () => {
    await get();
    expect(sdk.tokens.length).toBeGreaterThan(0);
    expect(new Set(sdk.tokens)).toEqual(new Set([TOKEN]));
  });
});

describe("GET /api/calendar: events", () => {
  it("returns one source per property, in lane order, with the same color as its events", async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.events.map((s: { name: string; color: string }) => [s.name, s.color])).toEqual([
      ["Wavesong", "#1e56b0"],
      ["Red", "#ff0000"],
      ["Lake Breeze", "#21a677"],
      ["Nautical Nest", "#ffd700"],
    ]);
    expect(body.lastUpdated).toBe("2026-10-07T16:00:00.000Z");
  });

  it("fetches each feed with an hour of Next caching", async () => {
    await get();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      FEEDS.WAVESONG_ICAL_URL,
      FEEDS.RED_ICAL_URL,
      FEEDS.LAKE_BREEZE_ICAL_URL,
      FEEDS.NAUTICAL_NEST_ICAL_URL,
    ]);
    for (const [, init] of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      expect(init).toEqual({ next: { revalidate: 3600 } });
    }
  });

  it("returns check-in and checkout as plain local days", async () => {
    feeds[FEEDS.LAKE_BREEZE_ICAL_URL] = ics([
      {
        uid: "ann",
        start: "20261020",
        end: "20261023",
        summary: "Reserved - Ann",
        description: "Notes",
      },
    ]);

    const { body } = await get();
    const lake = body.events.find((s: { name: string }) => s.name === "Lake Breeze");

    expect(lake.events).toEqual([
      {
        id: "ann",
        title: "Reserved - Ann",
        checkIn: "2026-10-20",
        checkOut: "2026-10-23",
        description: "Notes",
      },
    ]);
  });

  it("treats an all-day event without DTEND as one day long", async () => {
    // node-ical fills in DTSTART + 1 day per RFC 5545, so the parser's `end ?? start`
    // fallback never applies to date-only events
    feeds[FEEDS.WAVESONG_ICAL_URL] = ics([{ uid: "solo", start: "20261020" }]);
    const { body } = await get();
    const [event] = body.events[0].events;
    expect(event.checkOut).toBe("2026-10-21");
    expect(event.description).toBeNull();
  });

  it("reads summaries that carry parameters", async () => {
    feeds[FEEDS.RED_ICAL_URL] = ics([
      {
        uid: "p",
        start: "20261020",
        end: "20261022",
        summaryLine: "SUMMARY;LANGUAGE=en:Reserved - Pat",
      },
    ]);
    const { body } = await get();
    expect(body.events[1].events[0].title).toBe("Reserved - Pat");
    expect(addedTasks()[0].content).toBe("Send Welcome Letter (Reserved - Pat)");
  });

  it("ignores components that aren't events", async () => {
    feeds[FEEDS.WAVESONG_ICAL_URL] = ics(
      [{ uid: "e", start: "20261020", end: "20261022" }],
      ["BEGIN:VTODO", "UID:todo-1", "SUMMARY:Not a stay", "END:VTODO"].join("\r\n"),
    );
    const { body } = await get();
    expect(body.events[0].events.map((e: { id: string }) => e.id)).toEqual(["e"]);
  });

  it("keeps the days right when the clocks change during or at the end of a stay", async () => {
    feeds[FEEDS.WAVESONG_ICAL_URL] = ics([
      { uid: "fall", start: "20261030", end: "20261101" },
      { uid: "spring", start: "20270314", end: "20270316" },
    ]);
    const { body } = await get();
    expect(
      body.events[0].events.map((e: { checkIn: string; checkOut: string }) => [
        e.checkIn,
        e.checkOut,
      ]),
    ).toEqual([
      ["2026-10-30", "2026-11-01"],
      ["2027-03-14", "2027-03-16"],
    ]);
  });

  it("still returns and syncs the other feeds when one can't be fetched", async () => {
    feeds[FEEDS.RED_ICAL_URL] = new Response("nope", { status: 404, statusText: "Not Found" });
    feeds[FEEDS.LAKE_BREEZE_ICAL_URL] = ics([{ uid: "ann", start: "20261020", end: "20261023" }]);

    const { status, body } = await get();

    expect(status).toBe(200);
    expect(body.failed).toEqual(["Red"]);
    expect(
      body.events.map((s: { name: string; events: unknown[] }) => [s.name, s.events.length]),
    ).toEqual([
      ["Wavesong", 0],
      ["Red", 0],
      ["Lake Breeze", 1],
      ["Nautical Nest", 0],
    ]);
    expect(addedTasks()).toHaveLength(3);
    expect(console.error).toHaveBeenCalledWith(
      "Error reading the Red feed:",
      new Error("Failed to fetch iCal data: Not Found"),
    );
  });

  it("reports no failed feeds when every feed loads", async () => {
    const { body } = await get();
    expect(body.failed).toEqual([]);
  });
});

describe("GET /api/calendar: task sync", () => {
  it("creates a welcome letter, review request and door code for an upcoming stay", async () => {
    feeds[FEEDS.LAKE_BREEZE_ICAL_URL] = ics([
      { uid: "ann", start: "20261020", end: "20261023", summary: "Reserved - Ann" },
    ]);

    await get();

    expect(addedTasks()).toEqual([
      {
        content: "Send Welcome Letter (Reserved - Ann)",
        description: "bnb-ann-send-welcome-letter",
        // 11:00 local, 3 days before the Oct 20 check-in
        dueDate: "2026-10-17T15:00:00.000Z",
        labels: ["Lake Breeze"],
      },
      {
        content: "Send Review Request (Reserved - Ann)",
        description: "bnb-ann-send-review-request",
        // Local midnight starting the third day after the Oct 23 checkout
        dueDate: "2026-10-26T04:00:00.000Z",
        labels: ["Lake Breeze"],
      },
      {
        content: "Make Door Code (Reserved - Ann)",
        description: "bnb-ann-make-door-code",
        dueDate: "2026-10-17T15:00:00.000Z",
        labels: ["Lake Breeze"],
      },
    ]);
  });

  it.each([
    ["Wavesong", FEEDS.WAVESONG_ICAL_URL, true],
    ["Red", FEEDS.RED_ICAL_URL, false],
    ["Lake Breeze", FEEDS.LAKE_BREEZE_ICAL_URL, true],
    ["Nautical Nest", FEEDS.NAUTICAL_NEST_ICAL_URL, true],
  ])("%s gets a door code task: %s", async (property, url, hasDoorCode) => {
    feeds[url] = ics([{ uid: "s", start: "20261020", end: "20261022" }]);
    await get();
    const descriptions = addedTasks().map((t) => t.description);
    expect(descriptions).toContain("bnb-s-send-welcome-letter");
    expect(descriptions).toContain("bnb-s-send-review-request");
    expect(descriptions.includes("bnb-s-make-door-code")).toBe(hasDoorCode);
    expect(addedTasks().every((t) => t.labels[0] === property)).toBe(true);
  });

  it("skips tasks that already exist, open or completed", async () => {
    sdk.api.getTasksByFilter.mockResolvedValue(
      page([{ description: "bnb-ann-send-welcome-letter" }]),
    );
    sdk.api.getCompletedTasksByDueDate.mockResolvedValue(
      completedPage([{ description: "bnb-ann-make-door-code" }]),
    );
    feeds[FEEDS.LAKE_BREEZE_ICAL_URL] = ics([{ uid: "ann", start: "20261020", end: "20261023" }]);

    await get();

    expect(addedTasks().map((t) => t.description)).toEqual(["bnb-ann-send-review-request"]);
  });

  it("reads every page of open and completed tasks before deciding what exists", async () => {
    sdk.api.getTasksByFilter
      .mockResolvedValueOnce(page([{ description: "bnb-a-send-welcome-letter" }], "open-2"))
      .mockResolvedValueOnce(page([{ description: "bnb-a-send-review-request" }]));
    sdk.api.getCompletedTasksByDueDate
      .mockResolvedValueOnce(
        completedPage([{ description: "bnb-b-send-welcome-letter" }], "done-2"),
      )
      .mockResolvedValueOnce(completedPage([{ description: "bnb-b-send-review-request" }]));
    feeds[FEEDS.RED_ICAL_URL] = ics([
      { uid: "a", start: "20261020", end: "20261022" },
      { uid: "b", start: "20261025", end: "20261027" },
    ]);

    await get();

    expect(addedTasks()).toEqual([]);
    expect(sdk.api.getTasksByFilter.mock.calls.map(([a]) => a.cursor)).toEqual([null, "open-2"]);
    expect(sdk.api.getCompletedTasksByDueDate.mock.calls.map(([a]) => a.cursor)).toEqual([
      null,
      "done-2",
    ]);
  });

  it("asks Todoist for tasks from 5 days back to 33 days ahead", async () => {
    await get();

    expect(sdk.api.getTasksByFilter).toHaveBeenCalledWith({
      query: "date after: 10/2/2026 & date before: 11/9/2026",
      limit: 200,
      cursor: null,
    });
    expect(sdk.api.getCompletedTasksByDueDate).toHaveBeenCalledWith({
      since: "2026-10-02T16:00:00.000Z",
      until: "2026-11-09T17:00:00.000Z",
      limit: 200,
      cursor: null,
    });
  });

  it("plans arrival tasks from check-in and the review request from checkout", async () => {
    feeds[FEEDS.WAVESONG_ICAL_URL] = ics([
      // Already started: check-in was last week, checkout is in the window
      { uid: "past", start: "20260930", end: "20261009" },
      // Starts just past the 30-day window
      { uid: "far", start: "20261107", end: "20261110" },
      // Inside the window
      { uid: "soon", start: "20261101", end: "20261103" },
    ]);

    await get();

    expect(addedTasks().map((t) => t.description)).toEqual([
      "bnb-past-send-review-request",
      "bnb-soon-send-welcome-letter",
      "bnb-soon-send-review-request",
      "bnb-soon-make-door-code",
    ]);
  });

  it("creates no tasks for owner blocks", async () => {
    feeds[FEEDS.WAVESONG_ICAL_URL] = ics([
      { uid: "b1", start: "20261020", end: "20261022", summary: "Blocked" },
      { uid: "b2", start: "20261020", end: "20261022", summary: "Airbnb (Not available)" },
    ]);

    const { body } = await get();

    expect(addedTasks()).toEqual([]);
    // They still show on the calendar
    expect(body.events[0].events).toHaveLength(2);
  });

  it("skips individual tasks whose due date falls outside the window", async () => {
    feeds[FEEDS.NAUTICAL_NEST_ICAL_URL] = ics([
      // Welcome letter / door code would be due Oct 5, before today
      { uid: "tomorrow", start: "20261008", end: "20261010" },
      // Review request would be due Nov 9, past the window
      { uid: "late", start: "20261104", end: "20261106" },
    ]);

    await get();

    expect(addedTasks().map((t) => t.description)).toEqual([
      "bnb-tomorrow-send-review-request",
      "bnb-late-send-welcome-letter",
      "bnb-late-make-door-code",
    ]);
  });

  it("doesn't create the same task twice in one sync", async () => {
    // The same booking shows up on two feeds (e.g. a listing synced into both calendars)
    const stay = ics([{ uid: "dup", start: "20261020", end: "20261022" }]);
    feeds[FEEDS.WAVESONG_ICAL_URL] = stay;
    feeds[FEEDS.LAKE_BREEZE_ICAL_URL] = stay;

    await get();

    const descriptions = addedTasks().map((t) => t.description);
    expect(descriptions).toEqual([...new Set(descriptions)]);
    expect(descriptions).toHaveLength(3);
  });

  it("logs a failed task creation and keeps going", async () => {
    sdk.api.addTask
      .mockRejectedValueOnce(Object.assign(new Error("boom"), { responseData: "rate limited" }))
      .mockResolvedValue({ id: "ok" });
    feeds[FEEDS.RED_ICAL_URL] = ics([{ uid: "r", start: "20261020", end: "20261022" }]);

    const { status } = await get();

    expect(status).toBe(200);
    expect(sdk.api.addTask).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith("Error adding task:", "rate limited");
  });

  it("returns 500 when the existing-task lookup fails", async () => {
    sdk.api.getTasksByFilter.mockRejectedValue(new Error("Todoist is down"));
    feeds[FEEDS.RED_ICAL_URL] = ics([{ uid: "r", start: "20261020", end: "20261022" }]);

    const { status, body } = await get();

    expect(status).toBe(500);
    expect(body.details).toBe("Todoist is down");
    // Without knowing what exists, it must not create anything
    expect(sdk.api.addTask).not.toHaveBeenCalled();
  });
});

describe("GET /api/calendar: tasks for display", () => {
  it("maps Todoist tasks and sorts them by due date", async () => {
    sdk.api.getTasks.mockResolvedValue(
      page([
        {
          id: "2",
          content: "Send Review Request (Reserved - Bo)",
          description: "bnb-bo-send-review-request",
          completedAt: null,
          due: { date: "2026-10-12" },
          priority: 1,
          labels: ["Red"],
        },
        {
          id: "1",
          content: "Make Door Code (Reserved - Al)",
          description: "bnb-al-make-door-code",
          completedAt: "2026-10-06T10:00:00Z",
          due: { date: "2026-10-09T15:00:00Z" },
          priority: 4,
          labels: ["Wavesong"],
        },
      ]),
    );

    const { body } = await get();

    expect(sdk.api.getTasks).toHaveBeenCalledWith({ limit: 200, cursor: null });
    expect(body.tasks).toEqual([
      {
        id: "1",
        name: "Make Door Code (Reserved - Al)",
        description: "bnb-al-make-door-code",
        completed: true,
        dueDate: "2026-10-09T15:00:00Z",
        priority: 4,
        labels: ["Wavesong"],
      },
      {
        id: "2",
        name: "Send Review Request (Reserved - Bo)",
        description: "bnb-bo-send-review-request",
        completed: false,
        dueDate: "2026-10-12",
        priority: 1,
        labels: ["Red"],
      },
    ]);
  });

  it("reads every page of open tasks, not just the first 200", async () => {
    const task = (id: string, date: string) => ({
      id,
      content: `Task ${id}`,
      description: "",
      completedAt: null,
      due: { date },
      priority: 1,
      labels: [],
    });
    sdk.api.getTasks
      .mockResolvedValueOnce(page([task("a", "2026-10-09")], "next"))
      .mockResolvedValueOnce(page([task("b", "2026-10-08")]));

    const { body } = await get();

    expect(sdk.api.getTasks).toHaveBeenNthCalledWith(2, { limit: 200, cursor: "next" });
    expect(body.tasks.map((t: { id: string }) => t.id)).toEqual(["b", "a"]);
  });

  it("uses an empty due date for tasks without one", async () => {
    sdk.api.getTasks.mockResolvedValue(
      page([
        {
          id: "x",
          content: "Buy towels",
          description: "",
          completedAt: null,
          due: null,
          priority: 1,
          labels: [],
        },
      ]),
    );
    const { body } = await get();
    expect(body.tasks[0].dueDate).toBe("");
  });

  it("still returns the calendar when the task list can't be loaded", async () => {
    sdk.api.getTasks.mockRejectedValue(
      Object.assign(new Error("x"), { responseData: "Unauthorized" }),
    );
    feeds[FEEDS.RED_ICAL_URL] = ics([{ uid: "r", start: "20261020", end: "20261022" }]);

    const { status, body } = await get();

    expect(status).toBe(200);
    expect(body.tasks).toEqual([]);
    expect(body.events[1].events).toHaveLength(1);
    expect(console.error).toHaveBeenCalledWith("Error fetching all tasks:", "Unauthorized");
  });
});

describe("GET /api/calendar: concurrency", () => {
  it("shares one sync between requests that arrive while it's running", async () => {
    feeds[FEEDS.RED_ICAL_URL] = ics([{ uid: "r", start: "20261020", end: "20261022" }]);
    const { GET } = await loadRoute();

    const [a, b, c] = await Promise.all([GET(), GET(), GET()]);

    expect([a.status, b.status, c.status]).toEqual([200, 200, 200]);
    expect(sdk.api.getTasksByFilter).toHaveBeenCalledTimes(1);
    expect(sdk.api.addTask).toHaveBeenCalledTimes(2);
    expect(await b.json()).toEqual(await a.json());
  });

  it("runs a fresh sync once the previous one has finished", async () => {
    const { GET } = await loadRoute();
    await GET();
    await GET();
    expect(sdk.api.getTasksByFilter).toHaveBeenCalledTimes(2);
  });

  it("runs a fresh sync after a failed one", async () => {
    sdk.api.getTasksByFilter.mockRejectedValueOnce(new Error("blip"));
    const { GET } = await loadRoute();

    expect((await GET()).status).toBe(500);
    expect((await GET()).status).toBe(200);
  });
});
