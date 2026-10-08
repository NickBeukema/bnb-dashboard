"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { type Property, propertyStyle } from "./model";

/** A property's color. The inset ring keeps light colors (Nautical Nest's gold) visible on white. */
export function PropertySwatch({
  property,
  className,
}: {
  property: Property;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={propertyStyle(property)}
      className={cn(
        "inline-block size-3 shrink-0 rounded-full bg-(--prop) ring-1 ring-foreground/15 ring-inset",
        className,
      )}
    />
  );
}

/** Color and name together, so the property never depends on telling red from green */
export function PropertyName({ property, className }: { property: Property; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <PropertySwatch property={property} />
      <span className="truncate">{property.name}</span>
    </span>
  );
}

/** The current time, ticking. `null` until mounted so the server and client render the same. */
export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // Set after mount on purpose, so the server render and hydration agree
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
