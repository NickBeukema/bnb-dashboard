/**
 * Walk a cursor-paginated Todoist endpoint to completion.
 *
 * The Todoist SDK responses come in two shapes (`{ results, nextCursor }` and
 * `{ items, nextCursor }`) — callers normalize to `{ items, nextCursor }` here.
 *
 * `maxPages` exists so a mis-behaving endpoint (or a runaway cursor that never
 * returns null) can't burn through rate limit silently. At the default of 20
 * pages × 200 items = 4 000 items, which is far more than this dashboard will
 * ever legitimately see.
 */
export async function paginateAll<T>(
  fetchPage: (
    cursor: string | null,
  ) => Promise<{ items: T[]; nextCursor: string | null }>,
  options: { maxPages?: number; onCap?: (pages: number) => void } = {},
): Promise<T[]> {
  const { maxPages = 20, onCap } = options;
  const out: T[] = [];
  let cursor: string | null = null;
  let pages = 0;

  while (true) {
    const page = await fetchPage(cursor);
    out.push(...page.items);
    cursor = page.nextCursor;
    pages += 1;

    if (!cursor) break;

    if (pages >= maxPages) {
      if (onCap) {
        onCap(pages);
      } else {
        console.warn(
          `paginateAll: hit max-pages cap of ${maxPages} — results may be incomplete`,
        );
      }
      break;
    }
  }

  return out;
}
