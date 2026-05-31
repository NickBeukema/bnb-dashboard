---
title: Fix duplicate Todoist tasks for Wavesong and Nautical Nest
type: fix
status: completed
date: 2026-05-31
---

# Fix duplicate Todoist tasks for Wavesong and Nautical Nest

## Overview

The hourly calendar sync at `GET /api/calendar` is re-creating Todoist tasks that already exist, producing visible duplicates in the dashboard's task strip. The duplicates are concentrated on Wavesong and Nautical Nest. The root cause is that the dedup query against the Todoist API silently truncates at a single page of results, so once the total task volume in the dedup window crosses the API's page size, any task on page 2+ is invisible to the check and gets re-created on every refresh.

Wavesong and Nautical Nest surface this bug first because (a) they were just upgraded to receive **three** task types per booking instead of two — the May 7 2026 commit added them to `doorCodeLocations` — pushing total task volume over the page limit, and (b) whatever the Todoist API orders results by (likely creation time desc), those properties' tasks land past the cutoff.

## Problem Statement

`src/components/TaskList.tsx` already detects the symptom client-side: it groups visible tasks by their `description` field (which the API uses as the dedup key `bnb-<eventUid>-<task-type>`) and tints any card whose description count exceeds one. Users see a growing number of red-tinted cards for Wavesong and Nautical Nest bookings, with the duplicate count increasing roughly once per hour — matching the auto-refresh cadence of `FullPage.tsx` (line 48: `setInterval(fetchEvents, 3600000)`).

The hourly job is supposed to be idempotent. It isn't.

## Root Cause

There are three distinct dedup gaps. The first one is almost certainly what users are hitting; the other two are latent and should be closed at the same time.

### 1. Unpaginated existing-task fetch (primary)

`getExistingTaskIds()` in `src/app/api/calendar/route.ts:205-238` calls the Todoist SDK twice and uses only the first page of each:

```ts
// route.ts:223-230
const incompleteTasks: GetTasksResponse = await api.getTasksByFilter({
  query: filterQuery,
});
const completedTasks: GetCompletedTasksResponse =
  await api.getCompletedTasksByDueDate({
    since: taskStartDate.toISOString(),
    until: taskEndDate.toISOString(),
  });
```

Both response types are paginated — `node_modules/@doist/todoist-api-typescript/dist/types/requests.d.ts` shows:

```ts
export type GetTasksByFilterArgs = { query, lang?, cursor?, limit? };
export type GetTasksResponse = { results: Task[]; nextCursor: string | null };

export type GetCompletedTasksByDueDateArgs = { since, until, ..., cursor?, limit? };
export type GetCompletedTasksResponse = { items: Task[]; nextCursor: string | null };
```

The code never reads `nextCursor` and never sets `limit`, so it gets whatever the API's default page size is (the Todoist v1 default is small — sub-200 — which is why `getTasks` at line 345 explicitly opts into `{ limit: 200 }`, a precedent the dedup calls did not follow). Anything beyond the first page is missing from `existingTaskIds`. The very next loop iteration tries to "create" it and Todoist happily accepts a duplicate, because Todoist does **not** enforce uniqueness on description.

### 2. In-loop tracking not updated (latent)

Inside `fetchIcal()`, after the dedup check succeeds and `api.addTask(...)` is called, the newly created task's ID is never pushed back into the local `existingTaskIds` array (`route.ts:182-187`). If the same `eventTaskId` shows up twice within a single request — e.g. two iCal feeds export the same booking with the same UID, or a recurring event materializes into two VEVENTs — both will dedup-miss and both will be created. This isn't the main bug today, but it makes the system fragile.

### 3. No protection against concurrent calls (latent)

`/api/calendar` performs writes as a side effect of a GET, and `FullPage.tsx` triggers it on mount and every hour. Two tabs open simultaneously, or a fast page reload, will execute two overlapping syncs. Both fetch `existingTaskIds` before either calls `addTask`, both dedup-miss, both create. Same outcome as cause #1.

### Why Wavesong + Nautical Nest specifically

- Both are in `doorCodeLocations` (`route.ts:142`), so they generate **3 tasks per booking** vs. **2 tasks** for Red / Betsie / Betsie Airbnb.
- `ff359c3 Add Nautical Nest` (May 7 2026) is what put them in that list — Wavesong did not receive Make Door Code tasks before then. After that deploy, every Wavesong booking in the 30-day window generated a fresh task that hadn't existed in earlier hours.
- This jump in task volume is what pushed the dedup window over the API's first-page limit. Lake Breeze also gets door-code tasks but has had them since the start of the project, so its tasks dominate the earlier (visible) part of the result page.

## Proposed Solution

Three changes, in order of importance. Item 1 alone almost certainly fixes the visible bug; items 2 and 3 prevent regressions.

### 1. Paginate `getExistingTaskIds` (must do)

Rewrite the two API calls to follow `nextCursor` until null, with an explicit `limit: 200` to keep round-trips low. Pseudocode:

```ts
// src/app/api/calendar/route.ts (replace lines ~223-237)
const fetchAllIncomplete = async (): Promise<Task[]> => {
  const all: Task[] = [];
  let cursor: string | null = null;
  do {
    const page = await api.getTasksByFilter({
      query: filterQuery,
      cursor,
      limit: 200,
    });
    all.push(...page.results);
    cursor = page.nextCursor;
  } while (cursor);
  return all;
};

const fetchAllCompleted = async (): Promise<Task[]> => {
  const all: Task[] = [];
  let cursor: string | null = null;
  do {
    const page = await api.getCompletedTasksByDueDate({
      since: taskStartDate.toISOString(),
      until: taskEndDate.toISOString(),
      cursor,
      limit: 200,
    });
    all.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return all;
};

const [incomplete, completed] = await Promise.all([
  fetchAllIncomplete(),
  fetchAllCompleted(),
]);

return [
  ...incomplete.map((t) => t.description),
  ...completed.map((t) => t.description),
];
```

Add a hard safety cap on iterations (e.g. break after 20 pages = 4 000 tasks) and log a warning if it trips — a runaway loop here would be expensive.

### 2. Track newly-created task IDs in-loop (must do)

After a successful `api.addTask(...)` inside `fetchIcal()` (route.ts:182-187), push `eventTaskId` into the local `existingTaskIds` array. Because the array is shared across all six `fetchIcal()` calls (passed by reference from `GET`), this also dedup-protects across properties within a single request:

```ts
try {
  await api.addTask({ ... });
  existingTaskIds.push(eventTaskId); // <-- add
} catch (error) {
  console.error("Error adding task:", error.responseData);
}
```

### 3. Make `/api/calendar` re-entrancy-safe (should do)

The simplest fix that doesn't require infra: wrap the task-creation half of the route in a module-scoped `Promise` mutex. While one sync is in flight, concurrent callers await the same promise and skip the creation phase, returning only the read view:

```ts
// module scope
let inFlightSync: Promise<void> | null = null;

// inside GET, before fetchIcal calls
if (inFlightSync) {
  await inFlightSync;            // wait, then return reads only
} else {
  inFlightSync = (async () => {
    /* existingTaskIds + fetchIcal for each property */
  })();
  try { await inFlightSync; } finally { inFlightSync = null; }
}
```

This is good enough on a single-instance Vercel deployment. If the app ever runs multiple instances, this won't span them — but at that point, moving sync to a real cron (Vercel Cron) and removing the side effect from GET is the right answer (see Future Considerations).

## Cleaning up existing duplicates

The above only stops *new* duplicates. To clear the current backlog, the dashboard already has a per-task delete button (`src/components/TaskList.tsx:84-87` → `DELETE /api/task/[id]`) and the `TaskList` highlights duplicate rows in red. For a one-shot bulk cleanup, add a small server route or script that:

1. Calls `getExistingTaskIds()`-equivalent (paginated, all incomplete tasks in a wide window).
2. Groups by `description`, keeps the one with the earliest `createdAt`, deletes the rest.
3. Logs every deletion.

Recommended path: add a button or `?cleanup=1` query param on `/api/calendar` rather than a separate route, since the auth surface is the same (none). Document it in `CLAUDE.md`.

## Acceptance Criteria

- [x] `getExistingTaskIds()` follows `nextCursor` on both `getTasksByFilter` and `getCompletedTasksByDueDate` until null, with `limit: 200` per page, and a 20-page safety cap that logs a warning if hit. (Extracted into `pagination.ts`'s generic `paginateAll<T>` helper.)
- [x] After a successful `api.addTask()` in `fetchIcal()`, the new `eventTaskId` is pushed into `existingTaskIds`. (Now lives in `syncTasks.ts`; covered by the "does not create duplicate tasks when the same event UID appears twice" Vitest case.)
- [x] Two concurrent requests to `/api/calendar` do not both run the task-creation pass. (Implemented as a module-scoped `createRunOnce()` in `syncLock.ts`; covered by `syncLock.test.ts`'s concurrent-callers test.)
- [x] On a fresh hourly refresh against a Todoist account with > 200 tasks in the dedup window, **no** new tasks are created when all tasks for the window already exist. (Pagination test in `pagination.test.ts` proves multi-page traversal; in-loop tracking + mutex close the remaining gaps.)
- [ ] Existing duplicates are cleaned up via the existing per-task delete UI **or** a documented one-shot cleanup pass. (Intentionally deferred — user has the per-task delete UI already and prefers to clean up manually rather than build a one-shot script.)
- [x] `CLAUDE.md` is updated to describe the dedup contract and the pagination requirement (so the next contributor doesn't re-introduce the same bug).

## Manual Test Plan

1. **Reproduce baseline.** With current `main`, count visible duplicates in the dashboard task strip for Wavesong and Nautical Nest. Note the count.
2. **Apply changes 1 + 2.** Restart dev server.
3. **Force a clean state.** In Todoist, delete all duplicate `bnb-*` tasks (use the trash icons in the UI — they'll re-appear immediately if the bug persists).
4. **Hit `/api/calendar` manually** with `curl http://localhost:3000/api/calendar`. Confirm via server logs that some "Adding Task" lines appear (one per missing task) on the first call and **zero** on the second call. Before the fix, the second call still logs "Adding Task" for the tasks that fell off the dedup window.
5. **Concurrent test (change 3).** Run two `curl` calls in parallel: `curl /api/calendar & curl /api/calendar & wait`. Confirm Todoist task count only grows by the expected number of *new* tasks, not 2×.
6. **Long-window test.** In Todoist, manually create ~50 sentinel tasks with a due date in the dedup window so the page count exceeds 1. Re-run step 4. Confirm dedup still works (no duplicates of the existing `bnb-*` tasks).

## Risk Analysis

- **Increased Todoist API call volume.** Pagination adds round-trips. Mitigation: `limit: 200` per page; for a typical user with < 200 tasks in window, behavior is unchanged.
- **Rate limiting.** Todoist's published limit is generous (~450 requests / 15 min per user). With at most ~3–5 pages for incomplete + completed, plus per-task creates, we stay well under. Add the 20-page cap to prevent a runaway.
- **Module-scoped mutex on serverless.** On Vercel, each cold-start instance has its own module scope. Two cold starts can still race — but they would have to be triggered within ~1 s of each other. The mutex closes the common case (warm instance, two tabs); a true global lock requires moving sync to a cron and is out of scope here.
- **The `+11h` / `+24h` calendar offset in `fetchIcal()` (route.ts:101-104).** Do not touch. It's load-bearing for FullCalendar's display and is unrelated to dedup.

## Files to Change

- `src/app/api/calendar/route.ts`
  - `getExistingTaskIds()` — paginate both queries.
  - `fetchIcal()` task-creation block — push `eventTaskId` after `addTask` resolves.
  - `GET()` — wrap task-creation half in module-scoped in-flight guard.
- `CLAUDE.md` — add a short note under "Common things that go wrong" that the pagination fix is now in place, and call out the dedup-key contract.

## Out of Scope

- Adding a test suite (the repo has none today; doing it for this fix only would be premature).
- Replacing the GET-with-side-effect with a proper background job / Vercel Cron — worth doing eventually, but a bigger refactor than this fix calls for.
- Server-side cleanup-on-load of historical duplicates (mention in plan, leave to the user-driven delete UI unless they ask).

## Sources & References

- Todoist SDK pagination contract: `node_modules/@doist/todoist-api-typescript/dist/types/requests.d.ts:45-50, 72-83, 87-98`.
- Duplicate detection in the UI (proof the bug surfaces here): `src/components/TaskList.tsx:46-58, 106`.
- Hourly refresh trigger: `src/components/FullPage.tsx:43-52`.
- Prior related commits:
  - `4b583e2 fix task duplicate on edge of fetch window` — earlier round of dedup work; introduced `createTaskId` and the date-windowed task fetch but did not paginate it.
  - `ce521a9 fix potential date out of range bugs` — refactored task fetch into `getExistingTaskIds`; carried forward the no-pagination behavior.
  - `ff359c3 Add Nautical Nest` — added Wavesong + Nautical Nest to `doorCodeLocations`, which is what tipped task volume over the page limit.
