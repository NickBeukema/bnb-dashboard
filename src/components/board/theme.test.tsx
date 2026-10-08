import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoardThemeProvider, ThemeModeToggle, isNight } from "./theme";

const at = (h: number, m: number) => new Date(2026, 9, 7, h, m);

describe("isNight", () => {
  it.each([
    [at(19, 59), false],
    [at(20, 0), true],
    [at(23, 59), true],
    [at(0, 0), true],
    [at(6, 29), true],
    [at(6, 30), false],
    [at(12, 0), false],
  ])("%s → %s", (date, expected) => {
    expect(isNight(date)).toBe(expected);
  });

  it("defaults to the current time", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at(21, 0));
    expect(isNight()).toBe(true);
    vi.setSystemTime(at(9, 0));
    expect(isNight()).toBe(false);
    vi.useRealTimers();
  });
});

describe("BoardThemeProvider and ThemeModeToggle", () => {
  const html = document.documentElement;
  const option = (name: RegExp) => screen.getByRole("radio", { name });

  const renderToggle = () =>
    render(
      <BoardThemeProvider>
        <ThemeModeToggle />
      </BoardThemeProvider>,
    );

  beforeEach(() => {
    localStorage.clear();
    html.className = "";
    html.removeAttribute("style");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("goes dark at night in auto mode", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at(21, 15));
    renderToggle();
    await waitFor(() => expect(html).toHaveClass("dark"));
    expect(option(/auto/i)).toBeChecked();
  });

  it("stays light by day in auto mode", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at(10, 0));
    renderToggle();
    await waitFor(() => expect(html).toHaveClass("light"));
    expect(html).not.toHaveClass("dark");
  });

  it("re-checks the time every minute", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(at(19, 59));
    renderToggle();
    await waitFor(() => expect(html).toHaveClass("light"));

    await act(async () => {
      vi.setSystemTime(at(20, 0));
      vi.advanceTimersByTime(60 * 1000);
    });
    await waitFor(() => expect(html).toHaveClass("dark"));
  });

  it.each(["light", "dark"] as const)(
    "honours a stored %s mode regardless of the time",
    async (mode) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(mode === "light" ? at(23, 0) : at(12, 0));
      localStorage.setItem("bnb-theme-mode", mode);
      renderToggle();
      await waitFor(() => expect(html).toHaveClass(mode));
      expect(option(new RegExp(`^${mode}$`, "i"))).toBeChecked();
    },
  );

  it("never flashes the auto theme before a stored mode is read", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at(12, 0));
    localStorage.setItem("bnb-theme", "dark");
    localStorage.setItem("bnb-theme-mode", "dark");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderToggle();
    await waitFor(() => expect(option(/^dark$/i)).toBeChecked());
    expect(html).toHaveClass("dark");
    expect(setItem).not.toHaveBeenCalledWith("bnb-theme", "light");
  });

  it("ignores a junk stored mode", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at(12, 0));
    localStorage.setItem("bnb-theme-mode", "sepia");
    renderToggle();
    await waitFor(() => expect(html).toHaveClass("light"));
    expect(option(/auto/i)).toBeChecked();
  });

  it("applies and remembers a picked mode", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at(12, 0));
    const user = userEvent.setup();
    renderToggle();
    await waitFor(() => expect(html).toHaveClass("light"));

    await user.click(option(/^dark$/i));
    await waitFor(() => expect(html).toHaveClass("dark"));
    expect(localStorage.getItem("bnb-theme-mode")).toBe("dark");
    expect(option(/^dark$/i)).toBeChecked();

    await user.click(option(/auto/i));
    await waitFor(() => expect(html).toHaveClass("light"));
    expect(localStorage.getItem("bnb-theme-mode")).toBe("auto");
  });

  it("keeps the mode when the active option is tapped again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at(12, 0));
    const user = userEvent.setup();
    renderToggle();

    await user.click(option(/^light$/i));
    await user.click(option(/^light$/i));
    expect(option(/^light$/i)).toBeChecked();
    expect(localStorage.getItem("bnb-theme-mode")).toBe("light");
  });

  it("labels each option for screen readers", () => {
    renderToggle();
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((el) => el.getAttribute("aria-label"))).toEqual([
      "Auto (dark at night)",
      "Light",
      "Dark",
    ]);
  });
});
