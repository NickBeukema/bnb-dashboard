import { act, render } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateNotice } from "./update-notice";

vi.mock("sonner", () => ({ toast: vi.fn() }));

const serverVersion = (version: string) =>
  // A fresh response per call: a body can only be read once
  vi.mocked(fetch).mockImplementation(async () => Response.json({ version }));

const flush = () => act(async () => {});

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.mocked(toast).mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("UpdateNotice", () => {
  it("says nothing while the server runs this build", async () => {
    serverVersion("dev");
    render(<UpdateNotice />);
    await flush();
    expect(fetch).toHaveBeenCalledWith("/api/version", { cache: "no-store" });
    expect(toast).not.toHaveBeenCalled();
  });

  it("offers a refresh once a newer build is deployed", async () => {
    serverVersion("abc1234");
    render(<UpdateNotice />);
    await flush();
    expect(toast).toHaveBeenCalledOnce();
    const [message, options] = vi.mocked(toast).mock.calls[0]!;
    expect(message).toBe("A new version of the board is ready.");
    expect(options).toMatchObject({
      duration: Infinity,
      action: { label: "Refresh" },
      cancel: { label: "Later" },
    });
  });

  it("checks again later, and after Later waits until the app is reopened", async () => {
    vi.useFakeTimers();
    serverVersion("dev");
    render(<UpdateNotice />);
    await flush();
    expect(toast).not.toHaveBeenCalled();

    serverVersion("abc1234");
    await act(() => vi.advanceTimersByTimeAsync(5 * 60 * 1000));
    expect(toast).toHaveBeenCalledOnce();

    // Later
    act(() => vi.mocked(toast).mock.calls[0]![1]!.onDismiss!({} as never));
    await act(() => vi.advanceTimersByTimeAsync(5 * 60 * 1000));
    expect(toast).toHaveBeenCalledOnce();

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(toast).toHaveBeenCalledTimes(2);
  });

  it("stays quiet offline and in development", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
    render(<UpdateNotice />);
    await flush();
    expect(toast).not.toHaveBeenCalled();

    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(fetch).mockClear();
    render(<UpdateNotice />);
    await flush();
    expect(fetch).not.toHaveBeenCalled();
  });
});
