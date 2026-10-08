import { afterEach, beforeEach, vi } from "vitest";

// Tests must never reach the owner's real Todoist account or the booking feeds. Drop any
// secrets that leaked into the environment, and fail loudly on any fetch a test didn't mock.
for (const key of Object.keys(process.env)) {
  if (key === "TODOIST_API_TOKEN" || key.endsWith("_ICAL_URL")) delete process.env[key];
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      throw new Error(`Unmocked fetch in a test: ${String(input)}`);
    }),
  );
});

// Everything below only applies to tests running in jsdom
if (typeof window !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());

  // jsdom leaves out a few browser APIs that Radix, vaul and sonner call
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;

  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
}
