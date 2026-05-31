import { describe, it, expect } from "vitest";
import { planDedupe, type DedupableTask } from "./dedupe";

const make = (
  id: string,
  description: string,
  addedAt: string | null = "2026-01-01T00:00:00Z",
): DedupableTask => ({ id, description, addedAt });

describe("planDedupe", () => {
  it("returns empty plan when given no tasks", () => {
    const plan = planDedupe([]);
    expect(plan).toEqual({ toKeep: [], toDelete: [], groups: 0 });
  });

  it("returns empty plan when no descriptions repeat", () => {
    const tasks = [
      make("1", "bnb-a-welcome"),
      make("2", "bnb-b-welcome"),
      make("3", "bnb-c-welcome"),
    ];
    const plan = planDedupe(tasks);
    expect(plan.toKeep).toEqual([]);
    expect(plan.toDelete).toEqual([]);
    expect(plan.groups).toBe(0);
  });

  it("keeps the earliest-added task in a duplicate group and deletes the rest", () => {
    const oldest = make("1", "bnb-a-welcome", "2026-01-01T00:00:00Z");
    const middle = make("2", "bnb-a-welcome", "2026-02-01T00:00:00Z");
    const newest = make("3", "bnb-a-welcome", "2026-03-01T00:00:00Z");

    const plan = planDedupe([newest, oldest, middle]);

    expect(plan.groups).toBe(1);
    expect(plan.toKeep.map((t) => t.id)).toEqual(["1"]);
    expect(plan.toDelete.map((t) => t.id).sort()).toEqual(["2", "3"]);
  });

  it("handles multiple duplicate groups independently", () => {
    const tasks = [
      make("a1", "bnb-a-welcome", "2026-01-01"),
      make("a2", "bnb-a-welcome", "2026-01-02"),
      make("b1", "bnb-b-review", "2026-01-03"),
      make("b2", "bnb-b-review", "2026-01-04"),
      make("c1", "bnb-c-door", "2026-01-05"),
    ];

    const plan = planDedupe(tasks);

    expect(plan.groups).toBe(2);
    expect(plan.toKeep.map((t) => t.id).sort()).toEqual(["a1", "b1"]);
    expect(plan.toDelete.map((t) => t.id).sort()).toEqual(["a2", "b2"]);
  });

  it("ignores tasks whose description doesn't start with the prefix", () => {
    const tasks = [
      make("1", "buy groceries"),
      make("2", "buy groceries"),
      make("3", "bnb-a-welcome", "2026-01-01"),
      make("4", "bnb-a-welcome", "2026-01-02"),
    ];

    const plan = planDedupe(tasks);

    expect(plan.groups).toBe(1);
    expect(plan.toKeep.map((t) => t.id)).toEqual(["3"]);
    expect(plan.toDelete.map((t) => t.id)).toEqual(["4"]);
  });

  it("ignores tasks with an empty description", () => {
    const tasks = [
      make("1", ""),
      make("2", ""),
      make("3", "bnb-a-welcome", "2026-01-01"),
      make("4", "bnb-a-welcome", "2026-01-02"),
    ];

    const plan = planDedupe(tasks);

    expect(plan.groups).toBe(1);
    expect(plan.toKeep.map((t) => t.id)).toEqual(["3"]);
  });

  it("sorts null addedAt last so a missing timestamp is preferred for deletion", () => {
    const tasks = [
      make("1", "bnb-a-welcome", null),
      make("2", "bnb-a-welcome", "2026-01-01T00:00:00Z"),
    ];

    const plan = planDedupe(tasks);

    expect(plan.toKeep.map((t) => t.id)).toEqual(["2"]);
    expect(plan.toDelete.map((t) => t.id)).toEqual(["1"]);
  });

  it("breaks ties on equal addedAt by ascending id so the choice is deterministic", () => {
    const tasks = [
      make("b", "bnb-a-welcome", "2026-01-01T00:00:00Z"),
      make("a", "bnb-a-welcome", "2026-01-01T00:00:00Z"),
      make("c", "bnb-a-welcome", "2026-01-01T00:00:00Z"),
    ];

    const plan = planDedupe(tasks);

    expect(plan.toKeep.map((t) => t.id)).toEqual(["a"]);
    expect(plan.toDelete.map((t) => t.id).sort()).toEqual(["b", "c"]);
  });

  it("accepts a custom prefix", () => {
    const tasks = [
      make("1", "custom-x", "2026-01-01"),
      make("2", "custom-x", "2026-01-02"),
      make("3", "bnb-y", "2026-01-03"),
      make("4", "bnb-y", "2026-01-04"),
    ];

    const plan = planDedupe(tasks, "custom-");

    expect(plan.groups).toBe(1);
    expect(plan.toKeep.map((t) => t.id)).toEqual(["1"]);
    expect(plan.toDelete.map((t) => t.id)).toEqual(["2"]);
  });
});
