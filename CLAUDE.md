# BNB Dashboard — Project Guide

A personal Next.js 15 dashboard that displays Airbnb bookings across six short-term-rental properties on one calendar, and auto-creates per-booking Todoist tasks (welcome letter, review request, optional door code) so nothing slips. The whole app is one page, runs locally (or on Vercel), and uses no database — Todoist is the persistence layer.

## What it does, in one paragraph

On load, the page calls `GET /api/calendar`. That route fetches an iCal feed for each property, parses out the bookings, and for every booking in the next ~30 days it figures out which Todoist tasks should exist (Send Welcome Letter, Send Review Request, and — for Wavesong / Lake Breeze / Nautical Nest — Make Door Code). It checks Todoist for tasks that already exist (using a deterministic `bnb-<eventUid>-<task-type>` string stored in each task's **description** field), and creates any that are missing. The response returns the parsed calendar events plus all current Todoist tasks for display. The browser refreshes every hour.

## Stack

- **Next.js 15** (App Router, Turbopack) + React 19 + TypeScript
- **MUI v7** for layout, `@fullcalendar/react` for the multi-month grid
- **`node-ical`** to parse Airbnb iCal feeds
- **`@doist/todoist-api-typescript`** v5 for Todoist reads/writes
- **`date-fns`** + `date-fns-tz` for date math
- **Vitest** for unit tests of the calendar sync helpers (no auth, no database)

## Layout

```
src/
├── app/
│   ├── page.tsx                # renders <FullPage />
│   ├── layout.tsx              # global shell
│   ├── lib/data.ts             # property color constants
│   └── api/
│       ├── calendar/
│       │   ├── route.ts        # the brain: iCal fetch + task sync + read-back
│       │   ├── types.ts        # shared CalendarEvent / Task / CalendarSource types
│       │   ├── pagination.ts   # generic paginateAll<T> cursor helper
│       │   ├── syncLock.ts     # createRunOnce single-flight mutex
│       │   └── syncTasks.ts    # per-location task creation + dedup
│       └── task/[id]/route.ts  # DELETE handler used by the trash icon
└── components/
    ├── FullPage.tsx            # top-level client component, hourly refresh
    ├── Calendar.tsx            # FullCalendar wrapper
    ├── EventModal.tsx          # event detail popover
    └── TaskList.tsx            # bottom strip; highlights dupes, has delete
```

## The six properties

| Property        | iCal env var               | Color           | Gets Make Door Code? |
| --------------- | -------------------------- | --------------- | -------------------- |
| Wavesong        | `WAVESONG_ICAL_URL`        | Blue            | yes                  |
| Red             | `RED_ICAL_URL`             | Red             | no                   |
| Lake Breeze     | `LAKE_BREEZE_ICAL_URL`     | Green           | yes                  |
| Betsie          | `BETSIE_ICAL_URL`          | Brown           | no                   |
| Betsie Airbnb   | `BETSIE_AIRBNB_ICAL_URL`   | Brown           | no                   |
| Nautical Nest   | `NAUTICAL_NEST_ICAL_URL`   | Gold            | yes                  |

`TODOIST_API_TOKEN` is also required. Missing env vars fail loudly on the first request.

## How task dedup is supposed to work

`src/app/api/calendar/route.ts` builds a stable string for every (event, task type) pair:

```
bnb-<vevent.uid>-<task-type-kebab>
```

That string is written into the Todoist task's `description` field on create. Before creating, the route fetches every existing Todoist task whose due date falls in roughly today − 5 days … today + 33 days (both incomplete and recently completed) and compares descriptions. If a match is found, the task is skipped.

The `TaskList` component re-checks this client-side and tints any card red when two visible tasks share a description.

## Date windows worth remembering

- **Events processed:** start date in `[startOfDay(today), endOfDay(today + 30d)]`
- **Existing tasks fetched for dedup:** due date in `[today − 5d, today + 33d]` (the +3 covers Review Request, which is created 2 days *after* the booking ends)
- **Browser auto-refresh:** every 1 hour (`setInterval` in `FullPage.tsx`)
- **iCal HTTP cache (Next):** 1 hour via `next: { revalidate: 3600 }`
- **Calendar display offset:** event start gets `+11h`, event end gets `+24h` before serialization — this is a deliberate "make Airbnb's midnight-UTC dates look right on a US-Eastern calendar" hack, *not* a bug. Leave it alone unless you fully understand why it was added.

## Commands

```bash
npm run dev         # next dev --turbopack, port 3000
npm run build       # next build --turbopack
npm run start       # next start
npm test            # vitest run (calendar sync unit tests)
npm run test:watch  # vitest in watch mode
```

No linter is wired up and there is no CI. Tests live next to the code as `src/**/*.test.ts`.

## Conventions / things to know

- The `/api/calendar` route has a **side effect**: every GET can create Todoist tasks. Treat it as a job, not a pure read.
- Dedup keys live in Todoist task `description`. Don't edit those manually — you'll silently break dedup for that task.
- Door code tasks are gated by a hardcoded allowlist (`doorCodeLocations`) inside `fetchIcal`. Adding a new property that needs a door code requires editing that list.
- All env vars are read at module scope and asserted via `validateEnvironmentVariables()`. Adding a new property = new env var + a new entry in both the requiredVars list and the per-property `fetchIcal()` call at the bottom of `GET`.
- No DB, no auth: anyone who can hit the route can create / delete Todoist tasks. Fine for local / personal; do not deploy publicly without putting it behind something.

## Common things that go wrong

- **Duplicate Todoist tasks.** The classic cause used to be that `getExistingTaskIds()` ignored `nextCursor` — once total tasks in the window exceeded the API's page size, anything past page 1 was invisible to dedup and got re-created hourly. That is now fixed via `paginateAll` in `pagination.ts`, in-loop tracking of newly-created ids in `syncTasks.ts`, and a module-scoped `createRunOnce` mutex in `syncLock.ts` so overlapping requests can't both race to create the same task. If duplicates show up again, check those three first. The `TaskList` highlights duplicates in red as a visual canary.
- **"Failed to fetch iCal data".** An Airbnb iCal URL has expired or rotated; regenerate it in the Airbnb host dashboard and update the `.env`.
- **Tasks shifted by a day.** The +11h / +24h adjustments above are intentional. If something looks off by exactly a day, look at timezones before changing iCal parsing.
