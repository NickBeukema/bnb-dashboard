/**
 * Pure dedupe planner. Groups tasks by their `description` dedup key, keeps the
 * earliest-added in each group, marks the rest for deletion.
 *
 * Only tasks whose description starts with `prefix` (default `bnb-`) are
 * considered — anything the app didn't create is left alone.
 */

export interface DedupableTask {
  id: string;
  description: string;
  addedAt: string | null;
}

export interface DedupePlan<T extends DedupableTask> {
  toKeep: T[];
  toDelete: T[];
  groups: number;
}

export function planDedupe<T extends DedupableTask>(
  tasks: T[],
  prefix = "bnb-",
): DedupePlan<T> {
  const groups = new Map<string, T[]>();
  for (const t of tasks) {
    if (!t.description || !t.description.startsWith(prefix)) continue;
    const arr = groups.get(t.description) ?? [];
    arr.push(t);
    groups.set(t.description, arr);
  }

  const toKeep: T[] = [];
  const toDelete: T[] = [];
  let duplicateGroups = 0;

  for (const arr of groups.values()) {
    if (arr.length < 2) continue;
    duplicateGroups += 1;

    const sorted = [...arr].sort((a, b) => {
      if (a.addedAt === b.addedAt) return a.id.localeCompare(b.id);
      if (a.addedAt === null) return 1;
      if (b.addedAt === null) return -1;
      return a.addedAt.localeCompare(b.addedAt);
    });

    toKeep.push(sorted[0]);
    toDelete.push(...sorted.slice(1));
  }

  return { toKeep, toDelete, groups: duplicateGroups };
}
