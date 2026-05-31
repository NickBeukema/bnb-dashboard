import { describe, it, expect, vi } from "vitest";
import { createRunOnce } from "./syncLock";

describe("createRunOnce", () => {
  it("runs fn and returns ran:true for a single caller", async () => {
    const runOnce = createRunOnce();
    const fn = vi.fn().mockResolvedValue(undefined);

    const result = await runOnce(fn);

    expect(result).toEqual({ ran: true });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("only runs fn once across concurrent callers; others observe ran:false", async () => {
    const runOnce = createRunOnce();
    let resolveInFlight: (() => void) | undefined;
    const fn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveInFlight = resolve;
        }),
    );

    const first = runOnce(fn);
    const second = runOnce(fn);
    const third = runOnce(fn);

    // All three callers should be awaiting the same in-flight promise.
    expect(fn).toHaveBeenCalledTimes(1);

    resolveInFlight?.();

    const [r1, r2, r3] = await Promise.all([first, second, third]);
    expect(r1).toEqual({ ran: true });
    expect(r2).toEqual({ ran: false });
    expect(r3).toEqual({ ran: false });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("releases the gate after fn settles so the next caller runs", async () => {
    const runOnce = createRunOnce();
    const fn = vi.fn().mockResolvedValue(undefined);

    const a = await runOnce(fn);
    const b = await runOnce(fn);

    expect(a).toEqual({ ran: true });
    expect(b).toEqual({ ran: true });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("releases the gate after fn rejects so the next caller can retry", async () => {
    const runOnce = createRunOnce();
    const failing = vi.fn().mockRejectedValueOnce(new Error("boom"));
    const succeeding = vi.fn().mockResolvedValue(undefined);

    await expect(runOnce(failing)).rejects.toThrow("boom");

    const result = await runOnce(succeeding);
    expect(result).toEqual({ ran: true });
    expect(succeeding).toHaveBeenCalledTimes(1);
  });
});
