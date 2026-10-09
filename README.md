# bnb-dashboard

A kitchen-wall dashboard for four vacation rentals: Wavesong, Red, Lake Breeze and Nautical Nest.
It merges each property's booking calendar (iCal) into one view and keeps a Todoist to-do list in
step with the bookings.

## Routes

| Route                 | What it is                                                                          |
| --------------------- | ----------------------------------------------------------------------------------- |
| `/`                   | The board. The wall TV (portrait, 1080×1920) shows it, and it also works on phones. |
| `/v3`                 | Redirects to `/` (the board's old address).                                         |
| `GET /api/calendar`   | Bookings and open to-dos. This is also where the sync runs (see below).             |
| `PATCH /api/task/:id` | Takes `{ "completed": boolean }`. Completes or reopens a task.                      |
| `GET /api/version`    | The commit the server was built from. Open boards use it to offer a refresh.        |

## How the Todoist sync works

Each call to `/api/calendar` does the following:

1. Reads every property's iCal feed. Each feed is cached for an hour. If a feed can't be read,
   the others still sync; the response lists it in `failed`, and the board keeps that
   property's last known stays and names it in the footer.
2. Plans tasks for every stay except seasonal closures (see [Owner blocks](#owner-blocks)).
   A task is planned once its due date, and the day it hangs off, are both within the next 30 days:
   - **Send Welcome Letter**, due 3 days before check-in at 11:00.
   - **Make Door Code**, due 3 days before check-in at 11:00. Every property except Red gets one.
   - **Send Review Request**, due at the start of the third day after checkout. It hangs off
     checkout, so long stays and stays that began earlier still get one.
3. Skips any task that already exists. Every task's description holds a stable key
   (`bnb-<event uid>-<task slug>`), and the sync checks it against both open and completed
   tasks. As a result:
   - completing a task never brings it back;
   - deleting a task in Todoist does bring it back on the next sync.
4. Returns all open Todoist tasks, sorted by due date.

The board polls every 5 minutes, and also refresh when the tab becomes visible if the data is
more than a minute old. Ticking a task off completes it in Todoist, and Undo reopens it.

Each event's `checkIn` and `checkOut` are plain local days (`yyyy-MM-dd`), read from the feeds'
date-only `DTSTART`/`DTEND`. `checkOut` is the day the guest leaves.

### Owner blocks

Dates the owner blocks off in a listing reach the feeds as "Blocked" or "Not available"
events, with no guest name. A block means one of two things, depending on its length:

- **14 nights or fewer: a private booking.** Someone is staying who didn't book through a
  platform. It gets the same welcome letter, door code and review request tasks as any guest,
  and the board shows it as a stay named "Private booking", with arrivals, departures and an
  agenda entry.
- **More than 14 nights: a seasonal closure.** The property is shut for the season. It gets no
  tasks. The board shows it as a hatched "Closed" bar on the calendar and leaves it out of
  arrivals, departures and the agenda.

The cut-off is `PRIVATE_BOOKING_MAX_NIGHTS` in `src/lib/calendar-types.ts`.

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

| Script                            | What it does                                                    |
| --------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                     | Starts the dev server on :3000.                                 |
| `npm run build` / `npm start`     | Production build and server.                                    |
| `npm test`                        | Runs the Vitest suite once.                                     |
| `npm run test:watch`              | Runs Vitest in watch mode.                                      |
| `npm run coverage`                | Runs the suite with a v8 coverage report in `coverage/`.        |
| `npm run typecheck`               | Runs `tsc --noEmit`.                                            |
| `npm run lint`                    | Lints with oxlint (`.oxlintrc.json`).                           |
| `npm run format` / `format:check` | Formats with oxfmt (`.oxfmtrc.json`), or checks the formatting. |
| `npm run icons`                   | Redraws the app icons in `public/icons/`.                       |

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
src/app/                  layout, globals.css (Tailwind and the shadcn theme), board page, manifest
src/app/api/              calendar sync and task routes
src/components/board/     board UI, model.ts (API → stays/tasks), use-board.ts (data and polling)
src/components/ui/        shadcn components
src/lib/properties.ts     the four properties
src/lib/calendar-types.ts API response types shared by server and client
src/lib/server/           iCal parsing, task planning (pure) and Todoist calls
deploy/                   the Pi's systemd unit and deploy script
public/sw.js              service worker (offline copy of the board)
scripts/make-icons.mts    draws the app icons
```

## Installing on a phone

The board is a Progressive Web App: it can be added to a phone's home screen and opens full
screen like an app.

- **Install:** on iPhone, open the board in Safari, tap Share, then **Add to Home Screen**. On
  Android, open it in Chrome and tap **Install app** in the menu.
- **HTTPS:** browsers only run the service worker, and Android only offers to install, over
  HTTPS (or on `localhost`, which is why the TV has it). The phone reaches the Pi through
  Tailscale, so serve the board over HTTPS with Tailscale (see [Deployment](#deployment-raspberry-pi)).
- **Offline:** the service worker ([`public/sw.js`](public/sw.js)) keeps the last board it
  loaded. With no connection, the board opens from that copy and the footer reads "Offline.
  Showing <time>". Ticking tasks off needs the connection.
- **Updates:** pages and data always come from the network first, so a deploy shows up on the
  next load. Bump `VERSION` in `sw.js` only when changing how it caches.
- **New version notice:** an installed app can stay open for days, so the board checks
  `GET /api/version` every 5 minutes, when it's reopened and when it's back online. Each build is
  stamped with its git commit (`BUILD_ID` in `next.config.ts`). When the server's commit differs,
  a toast offers **Refresh**; **Later** hides it until the app is next opened.
- **Icons:** drawn by `npm run icons` from the property colours.

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
  4. makes sure Tailscale serves it over HTTPS;
  5. reloads the TV.

  It asks for the `sudo` password for the restart.

- **Changing the unit:** copy the file over the installed one, then reload and restart:

  ```sh
  sudo cp deploy/bnb-dashboard.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl restart bnb-dashboard.service
  ```

- **Logs:** `journalctl -u bnb-dashboard.service -f`.
- **HTTPS for phones:** Tailscale serves the board at `https://raspberrypi.tail1f7a99.ts.net/`
  for any device signed in to the tailnet, and renews the certificate itself. The deploy script
  sets this up (`tailscale serve`); check it with `tailscale serve status`. It needs HTTPS
  certificates enabled for the tailnet (Tailscale admin console, DNS page), which they are.
- **Kiosk:** `~/.local/bin/kiosk.sh` keeps Chromium open on `http://localhost:3000/` and
  relaunches it if it exits.
  - To reload the TV, run `pkill -x chromium`.
  - Don't use `pkill -f kiosk.sh` over SSH, because it matches the SSH command itself.
