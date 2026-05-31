/**
 * Single-flight gate. `runOnce(fn)` runs `fn` when no other call is in flight;
 * any concurrent callers `await` the same in-flight promise and return without
 * re-running `fn` themselves.
 *
 * Used to keep `/api/calendar`'s Todoist task-creation side effect from racing
 * itself when two browser tabs (or a fast reload) hit the route simultaneously.
 *
 * Returns `{ ran: true }` for the caller that actually executed `fn`, and
 * `{ ran: false }` for callers that observed someone else's run.
 *
 * Module-scope only — does not coordinate across serverless instances.
 */
export function createRunOnce() {
  let inFlight: Promise<void> | null = null;

  return async function runOnce(
    fn: () => Promise<void>,
  ): Promise<{ ran: boolean }> {
    if (inFlight) {
      await inFlight;
      return { ran: false };
    }

    const promise = fn().finally(() => {
      inFlight = null;
    });
    inFlight = promise;
    await promise;
    return { ran: true };
  };
}
