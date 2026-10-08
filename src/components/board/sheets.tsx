"use client";

import { addDays, format, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PropertyName } from "./bits";
import type { BoardTask, Stay } from "./model";
import { TaskRow } from "./task-row";

/** Details for one stay, with its welcome letter / door code / review to-dos */
export function StaySheet({
  stay,
  today,
  tasks,
  onClose,
  onCompleteTask,
}: {
  stay: Stay | null;
  today: Date;
  tasks: BoardTask[];
  onClose: () => void;
  onCompleteTask: (task: BoardTask) => void;
}) {
  const own = stay ? tasks.filter((t) => t.stayId === stay.id) : [];

  return (
    <Drawer open={!!stay} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        {stay && (
          <div className="mx-auto flex w-full max-w-xl flex-col">
            <DrawerHeader className="gap-2 text-left">
              <DrawerTitle className="text-3xl font-semibold tracking-tight">
                {stay.blocked ? "Blocked" : stay.guest}
              </DrawerTitle>
              <DrawerDescription asChild>
                <div className="text-base">
                  <PropertyName property={stay.property} />
                </div>
              </DrawerDescription>
            </DrawerHeader>

            <dl className="mx-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-border ring-1 ring-border">
              {[
                ["Check-in", format(stay.checkIn, "EEE, MMM d")],
                ["Checkout", format(stay.checkOut, "EEE, MMM d")],
                ["Nights", String(stay.nights)],
              ].map(([term, value]) => (
                <div key={term} className="bg-card px-4 py-3">
                  <dt className="text-sm text-muted-foreground">{term}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            {!stay.blocked && (
              <div className="mt-5 px-4">
                <h3 className="px-2 text-lg font-semibold">To-dos</h3>
                {own.length === 0 ? (
                  <p className="px-2 py-2 text-muted-foreground">
                    Nothing open for this stay. To-dos appear here once they're within a month.
                  </p>
                ) : (
                  <ul className="mt-1 flex flex-col">
                    {own.map((task) => (
                      <TaskRow key={task.id} task={task} today={today} onComplete={onCompleteTask} showDue />
                    ))}
                  </ul>
                )}
              </div>
            )}

            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline" size="lg" className="h-12 text-base">
                  Close
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

const groupName = (due: Date, today: Date) => {
  if (due < today) return "Overdue";
  if (isSameDay(due, today)) return "Today";
  if (isSameDay(due, addDays(today, 1))) return "Tomorrow";
  if (due < addDays(today, 7)) return "This week";
  return "Later";
};

/** Every open to-do, for looking further ahead than the next three days */
export function AllTasksSheet({
  open,
  onOpenChange,
  today,
  tasks,
  onCompleteTask,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: Date;
  tasks: BoardTask[];
  onCompleteTask: (task: BoardTask) => void;
}) {
  const groups = new Map<string, BoardTask[]>();
  for (const task of tasks) {
    const name = groupName(task.due, today);
    groups.set(name, [...(groups.get(name) ?? []), task]);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-3xl font-semibold tracking-tight">All to-dos</DrawerTitle>
            <DrawerDescription className="text-base">
              {tasks.length === 0 ? "You're all caught up." : `${tasks.length} open, soonest first.`}
            </DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="min-h-0 flex-1 px-4">
            {[...groups].map(([name, items]) => (
              <section key={name} aria-label={name} className="mb-4">
                <h3 className={name === "Overdue" ? "px-2 font-semibold text-destructive" : "px-2 font-semibold"}>
                  {name}
                </h3>
                <ul className="flex flex-col">
                  {items.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      today={today}
                      onComplete={onCompleteTask}
                      showDue={name === "This week" || name === "Later"}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </ScrollArea>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" size="lg" className="h-12 text-base">
                Close
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
