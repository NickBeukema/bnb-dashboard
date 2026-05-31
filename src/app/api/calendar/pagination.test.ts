import { describe, it, expect, vi } from "vitest";
import { paginateAll } from "./pagination";

describe("paginateAll", () => {
  it("returns a single page when nextCursor is null on the first call", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({
      items: ["a", "b", "c"],
      nextCursor: null,
    });

    const result = await paginateAll(fetchPage);

    expect(result).toEqual(["a", "b", "c"]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(null);
  });

  it("follows nextCursor through multiple pages and stops at null", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [1, 2], nextCursor: "p2" })
      .mockResolvedValueOnce({ items: [3, 4], nextCursor: "p3" })
      .mockResolvedValueOnce({ items: [5], nextCursor: null });

    const result = await paginateAll(fetchPage);

    expect(result).toEqual([1, 2, 3, 4, 5]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, null);
    expect(fetchPage).toHaveBeenNthCalledWith(2, "p2");
    expect(fetchPage).toHaveBeenNthCalledWith(3, "p3");
  });

  it("respects maxPages and invokes onCap when the cap trips", async () => {
    const fetchPage = vi.fn().mockImplementation((cursor: string | null) => {
      const next = cursor === null ? "1" : String(Number(cursor) + 1);
      return Promise.resolve({ items: [cursor ?? "start"], nextCursor: next });
    });
    const onCap = vi.fn();

    const result = await paginateAll(fetchPage, { maxPages: 3, onCap });

    expect(result).toHaveLength(3);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(onCap).toHaveBeenCalledTimes(1);
    expect(onCap).toHaveBeenCalledWith(3);
  });

  it("returns an empty array when the first page is empty", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [], nextCursor: null });

    const result = await paginateAll(fetchPage);

    expect(result).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
