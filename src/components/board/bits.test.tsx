import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropertyName, PropertySwatch, useNow } from "./bits";
import { propertyByName } from "./model";

describe("PropertySwatch", () => {
  it("renders a decorative dot in the property's color", () => {
    const { container } = render(<PropertySwatch property={propertyByName("Lake Breeze")} className="size-5" />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot.style.getPropertyValue("--prop")).toBe("var(--lake-breeze)");
    expect(dot).toHaveClass("bg-(--prop)", "rounded-full", "size-5");
    // The caller's size wins over the default
    expect(dot).not.toHaveClass("size-3");
  });
});

describe("PropertyName", () => {
  it("pairs the swatch with the name, so color is never the only cue", () => {
    const { container } = render(<PropertyName property={propertyByName("Nautical Nest")} className="text-lg" />);
    expect(screen.getByText("Nautical Nest")).toHaveClass("truncate");
    expect(container.firstElementChild).toHaveClass("text-lg");
    expect(container.querySelector("[aria-hidden]")?.getAttribute("style")).toContain("var(--nautical-nest)");
  });

  it("shows an unknown property by name", () => {
    render(<PropertyName property={propertyByName("Betsie")} />);
    expect(screen.getByText("Betsie")).toBeInTheDocument();
  });
});

describe("useNow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is a date once mounted and then ticks on the interval", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 7, 20, 0, 0));
    const { result, unmount } = renderHook(() => useNow(15_000));

    // The mount effect has already run inside renderHook's act()
    expect(result.current).toEqual(new Date(2026, 9, 7, 20, 0, 0));

    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(result.current).toEqual(new Date(2026, 9, 7, 20, 0, 15));

    act(() => {
      vi.advanceTimersByTime(14_999);
    });
    expect(result.current).toEqual(new Date(2026, 9, 7, 20, 0, 15));

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("renders null before mount effects run, so server and client markup match", () => {
    const seen: (Date | null)[] = [];
    function Probe() {
      const now = useNow();
      seen.push(now);
      return null;
    }
    render(<Probe />);
    expect(seen[0]).toBeNull();
    expect(seen.at(-1)).toBeInstanceOf(Date);
  });

  it("restarts the timer when the interval changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 7, 20, 0, 0));
    const { result, rerender } = renderHook(({ ms }) => useNow(ms), { initialProps: { ms: 60_000 } });
    rerender({ ms: 1_000 });
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toEqual(new Date(2026, 9, 7, 20, 0, 1));
    expect(vi.getTimerCount()).toBe(1);
  });
});
