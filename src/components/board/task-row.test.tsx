import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LAKE_BREEZE, day, makeTask } from "../../../test/board-fixtures";
import { TaskRow } from "./task-row";

const today = day(7);

function renderRow(props: Partial<Parameters<typeof TaskRow>[0]> = {}) {
  const onComplete = vi.fn();
  const task = props.task ?? makeTask({ due: today });
  const utils = render(
    <ul>
      <TaskRow task={task} today={today} onComplete={onComplete} {...props} />
    </ul>,
  );
  return { ...utils, onComplete, task, checkbox: screen.getByRole("checkbox") };
}

describe("TaskRow", () => {
  it("shows the title, guest and property", () => {
    renderRow({ task: makeTask({ due: today, guest: "Nikki", property: LAKE_BREEZE }) });
    expect(screen.getByText("Welcome letter")).toBeInTheDocument();
    expect(screen.getByText("Nikki · Lake Breeze")).toBeInTheDocument();
  });

  it("labels the checkbox with the row text", () => {
    renderRow({ task: makeTask({ due: today, title: "Door code", kind: "door-code", guest: "Eva" }) });
    expect(screen.getByRole("checkbox", { name: /Door code/ })).toBeInTheDocument();
  });

  it("omits the guest line when there is no guest or property", () => {
    const { container } = renderRow({
      task: makeTask({ due: today, kind: "other", title: "Buy towels", guest: null, property: null }),
    });
    expect(screen.getByText("Buy towels")).toBeInTheDocument();
    expect(container.querySelector(".text-sm.text-muted-foreground")).toBeNull();
  });

  it("shows only the guest when the property is unknown", () => {
    renderRow({ task: makeTask({ due: today, guest: "Jen", property: null }) });
    expect(screen.getByText("Jen")).toBeInTheDocument();
  });

  it.each([
    ["welcome", "lucide-mail"],
    ["door-code", "lucide-key-round"],
    ["review", "lucide-star"],
    ["other", "lucide-list-todo"],
  ] as const)("uses the %s icon", (kind, iconClass) => {
    const { container } = renderRow({ task: makeTask({ due: today, kind }) });
    expect(container.querySelector(`svg.${iconClass}`)).not.toBeNull();
  });

  it("flags overdue tasks with their due date", () => {
    renderRow({ task: makeTask({ due: day(3) }) });
    expect(screen.getByText("Due Oct 3")).toHaveClass("text-destructive");
  });

  it("shows the due day only when asked", () => {
    renderRow({ task: makeTask({ due: day(12) }), showDue: true });
    expect(screen.getByText("Mon 12")).toBeInTheDocument();
  });

  it("shows no date for a task due today without showDue", () => {
    const { container } = renderRow({ task: makeTask({ due: today }) });
    expect(container).not.toHaveTextContent(/Due |Wed 7/);
  });

  describe("completing", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("ticks right away and reports completion after the settle delay", () => {
      const { checkbox, onComplete, task } = renderRow();
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      expect(checkbox).toBeDisabled();
      expect(screen.getByText("Welcome letter").parentElement).toHaveClass("line-through");
      act(() => vi.advanceTimersByTime(449));
      expect(onComplete).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(onComplete).toHaveBeenCalledExactlyOnceWith(task);
    });

    it("completes from a tap anywhere on the row", () => {
      const { onComplete } = renderRow();
      fireEvent.click(screen.getByText("Jen · Wavesong"));
      act(() => vi.runAllTimers());
      expect(onComplete).toHaveBeenCalledOnce();
    });

    it("only completes once however many times it is tapped", () => {
      const { checkbox, onComplete } = renderRow();
      fireEvent.click(checkbox);
      fireEvent.click(checkbox);
      fireEvent.click(screen.getByText("Welcome letter"));
      act(() => vi.runAllTimers());
      expect(onComplete).toHaveBeenCalledOnce();
    });

    it("does not report completion if it unmounts during the settle delay", () => {
      const { checkbox, onComplete, unmount } = renderRow();
      fireEvent.click(checkbox);
      unmount();
      act(() => vi.runAllTimers());
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe("tap guard", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const moveRow = (label: HTMLElement, tops: number[]) => {
      const spy = vi.spyOn(label, "getBoundingClientRect");
      for (const top of tops) spy.mockReturnValueOnce({ top } as DOMRect);
    };

    it("ignores a tap whose row scrolled away during the press", () => {
      const { checkbox, onComplete, container } = renderRow();
      const label = container.querySelector("label")!;
      moveRow(label, [300, 180]);
      fireEvent.pointerDown(label);
      fireEvent.click(checkbox);
      act(() => vi.runAllTimers());
      expect(checkbox).not.toBeChecked();
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("ignores a tap when the list closed up under the finger", () => {
      const { onComplete, container } = renderRow();
      const label = container.querySelector("label")!;
      moveRow(label, [300, 244]);
      fireEvent.pointerDown(label);
      fireEvent.click(label);
      act(() => vi.runAllTimers());
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("allows a little jitter", () => {
      const { checkbox, onComplete, container } = renderRow();
      const label = container.querySelector("label")!;
      moveRow(label, [300, 306]);
      fireEvent.pointerDown(label);
      fireEvent.click(checkbox);
      act(() => vi.runAllTimers());
      expect(onComplete).toHaveBeenCalledOnce();
    });

    it("accepts the next clean tap after an ignored one", () => {
      const { checkbox, onComplete, container } = renderRow();
      const label = container.querySelector("label")!;
      moveRow(label, [300, 100, 100, 100]);
      fireEvent.pointerDown(label);
      fireEvent.click(checkbox);
      fireEvent.pointerDown(label);
      fireEvent.click(checkbox);
      act(() => vi.runAllTimers());
      expect(onComplete).toHaveBeenCalledOnce();
    });
  });

  it("completes with the keyboard", async () => {
    const user = userEvent.setup();
    const { checkbox, onComplete } = renderRow();
    checkbox.focus();
    await user.keyboard(" ");
    expect(checkbox).toBeChecked();
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalledOnce(), { timeout: 1500 });
  });
});
