# bnb-dashboard

A kitchen-wall dashboard for four vacation rentals: Wavesong, Red, Lake Breeze and Nautical Nest.
It merges each property's booking calendar (iCal) into one view and keeps a Todoist to-do list in
step with the bookings.

## Routes

| Route | What it is |
| --- | --- |
| `/v3` | The board. The wall TV (portrait, 1080×1920) shows it, and it also works on phones. |
| `/` | Redirects to `/v3`. |
| `GET /api/calendar` | Bookings and open to-dos. This is also where the sync runs (see below). |
| `PATCH /api/task/:id` | Takes `{ "completed": boolean }`. Completes or reopens a task. |

## How the Todoist sync works

Each call to `/api/calendar` does the following:

1. Reads every property's iCal feed. Each feed is cached for an hour.
2. Plans tasks for every stay that starts in the next 30 days:
   - **Send Welcome Letter**, due 3 days before check-in.
   - **Make Door Code**, due 3 days before check-in. Every property except Red gets one.
   - **Send Review Request**, due 2 days after checkout.
3. Skips any task that already exists. Every task's description holds a stable key
   (`bnb-<event uid>-<task slug>`), and the sync checks it against both open and completed
   tasks. As a result:
   - completing a task never brings it back;
   - deleting a task in Todoist does bring it back on the next sync.
4. Returns all open Todoist tasks, sorted by due date.

The board polls every 5 minutes, and also refresh when the tab becomes visible if the data is
more than a minute old. Ticking a task off completes it in Todoist, and Undo reopens it.

Event dates in the API are shifted (start +11h, end +24h), left over from an older FullCalendar
view. The board undoes that shift in `toStays` (`src/components/board/model.ts`).

## Setup

You need Node 20.9 or newer (Next.js requires it). The Pi runs Node 24. Create `.env`; it is gitignored, so never commit it.

```sh
WAVESONG_ICAL_URL=...
RED_ICAL_URL=...
LAKE_BREEZE_ICAL_URL=...
NAUTICAL_NEST_ICAL_URL=...
TODOIST_API_TOKEN=...
```

The API answers 500 and names every missing variable. Each property's feed variable, colour,
initial and door-code rule live together in `src/lib/properties.ts`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the dev server on :3000. |
| `npm run build` / `npm start` | Production build and server. |
| `npm test` | Runs the Vitest suite once. |
| `npm run test:watch` | Runs Vitest in watch mode. |
| `npm run coverage` | Runs the suite with a v8 coverage report in `coverage/`. |
| `npm run typecheck` | Runs `tsc --noEmit`. |

## Tests

The tests sit next to the code as `*.test.ts(x)` files. Shared setup and fixtures are in `test/`.

- **Real services are never called.** `test/setup.ts` removes the real token and feed URLs from
  the environment and makes any unmocked `fetch` throw. Todoist is mocked with
  `vi.mock("@doist/todoist-sdk")`.
- **Time zone:** the suite runs in `America/New_York`, which the npm scripts set. Tests that
  depend on the clock freeze `Date` with `vi.useFakeTimers({ toFake: ["Date"] })`.
- **Environments:** component tests run in jsdom. API route tests opt into Node with
  `// @vitest-environment node`.

## Code map

```
src/app/                  layout, globals.css (Tailwind and the shadcn theme), /v3 page
src/app/api/              calendar sync and task routes
src/components/board/     board UI, model.ts (API → stays/tasks), use-board.ts (data and polling)
src/components/ui/        shadcn components
src/lib/properties.ts     the four properties
src/lib/calendar-types.ts API response types shared by server and client
src/lib/server/           iCal parsing, task planning (pure) and Todoist calls
deploy/                   the Pi's systemd unit and deploy script
```

## Deployment (Raspberry Pi)

The dashboard runs on a Raspberry Pi 5 that drives the wall TV. Its Tailscale address is
`100.117.241.60` and the user is `care`.

- **Location:** the repo is at `~/Desktop/bnb-dashboard`, with its own `.env`.
- **Service:** `bnb-dashboard.service` runs the production server (`next start`) on port 3000.
  - The unit file is versioned in [`deploy/bnb-dashboard.service`](deploy/bnb-dashboard.service).
  - If there's no build yet, the service makes one before starting.
- **Deploy:** run `./deploy/deploy.sh` on the Pi. It does the following:
  1. pulls the latest code;
  2. runs `npm ci` and `npm run build` while the old version keeps serving;
  3. restarts the service and waits for it to come back up;
  4. reloads the TV.

  It asks for the `sudo` password for the restart.
- **Changing the unit:** copy the file over the installed one, then reload and restart:

  ```sh
  sudo cp deploy/bnb-dashboard.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl restart bnb-dashboard.service
  ```
- **Logs:** `journalctl -u bnb-dashboard.service -f`.
- **Kiosk:** `~/.local/bin/kiosk.sh` keeps Chromium open on `http://localhost:3000/v3` and
  relaunches it if it exits.
  - To reload the TV, run `pkill -x chromium`.
  - Don't use `pkill -f kiosk.sh` over SSH, because it matches the SSH command itself.
