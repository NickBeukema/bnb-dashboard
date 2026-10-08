"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { KeyRoundIcon, ListTodoIcon, MailIcon, StarIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { PropertySwatch } from "./bits";
import { type BoardTask, type TaskKind, isOverdue } from "./model";

const ICONS: Record<TaskKind, typeof MailIcon> = {
  welcome: MailIcon,
  "door-code": KeyRoundIcon,
  review: StarIcon,
  other: ListTodoIcon,
};

// Long enough to see the tick land before the row leaves the list
const SETTLE_MS = 450;
// A press whose row moved further than this was a scroll, or the list shifted under the finger
const MOVED_PX = 8;

export function TaskRow({
  task,
  today,
  onComplete,
  showDue = false,
}: {
  task: BoardTask;
  today: Date;
  onComplete: (task: BoardTask) => void;
  /** Show the due day, for lists that aren't already grouped by day */
  showDue?: boolean;
}) {
  const [checked, setChecked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pressTop = useRef<number | null>(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const Icon = ICONS[task.kind];
  const overdue = isOverdue(task, today);
  const id = `task-${task.id}`;

  return (
    <li>
      <label
        htmlFor={id}
        onPointerDown={(e) => {
          pressTop.current = e.currentTarget.getBoundingClientRect().top;
        }}
        onClickCapture={(e) => {
          // Only a tap on a row that stayed put completes it. Fast flicks on a touchscreen can
          // still end in a click, and rows close up as tasks finish, so check before ticking.
          const top = e.currentTarget.getBoundingClientRect().top;
          if (pressTop.current !== null && Math.abs(top - pressTop.current) > MOVED_PX) e.preventDefault();
          pressTop.current = null;
        }}
        className={cn(
          "group flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-200 hover:bg-muted/70 active:bg-muted",
          checked && "opacity-60",
        )}
      >
        <Checkbox
          id={id}
          checked={checked}
          disabled={checked}
          onCheckedChange={() => {
            setChecked(true);
            timer.current = setTimeout(() => onComplete(task), SETTLE_MS);
          }}
          className="size-6 rounded-full border-2 border-muted-foreground/50 [&_svg]:size-4!"
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "flex items-center gap-2 font-medium decoration-2 transition-[text-decoration-color] duration-200",
              checked ? "line-through decoration-foreground/60" : "decoration-transparent",
            )}
          >
            <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{task.title}</span>
          </span>
          {(task.guest || task.property) && (
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              {task.property && <PropertySwatch property={task.property} className="size-2.5" />}
              <span className="truncate">
                {[task.guest, task.property?.name].filter(Boolean).join(" · ")}
              </span>
            </span>
          )}
        </span>
        {(overdue || showDue) && (
          <span
            className={cn(
              "shrink-0 text-sm tabular-nums",
              overdue ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {overdue ? `Due ${format(task.due, "MMM d")}` : format(task.due, "EEE d")}
          </span>
        )}
      </label>
    </li>
  );
}
