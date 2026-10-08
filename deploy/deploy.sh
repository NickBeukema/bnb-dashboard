#!/usr/bin/env bash
# Run on the Pi from the repo: pulls the latest code, builds it and restarts the dashboard.
# The old server keeps serving while the new build runs, so the TV is only down for the restart.
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
# The build needs dev dependencies (Tailwind, TypeScript) whatever NODE_ENV says
npm ci --include=dev --no-audit --no-fund
# Dev-server leftovers; their stale route types would fail the build's type check
rm -rf .next/dev
npm run build

sudo systemctl restart bnb-dashboard.service
for _ in $(seq 60); do
  curl -sf -o /dev/null --max-time 5 http://localhost:3000/ && break
  sleep 1
done
curl -sf -o /dev/null --max-time 5 http://localhost:3000/ || { echo "Dashboard didn't come back up" >&2; exit 1; }

# HTTPS for phones on the tailnet (installing the app needs it), at
# https://<this machine's MagicDNS name>/. Tailscale keeps the setting and renews the
# certificate; setting it again is harmless and restores it on a fresh Pi.
sudo tailscale serve --bg --https=443 http://localhost:3000 >/dev/null

# The kiosk supervisor relaunches Chromium on the new build
pkill -x chromium || true
echo "Deployed $(git rev-parse --short HEAD)"
