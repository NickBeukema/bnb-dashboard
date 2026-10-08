// Builders shared by the board component tests. Dates are local (America/New_York in tests).
import { PROPERTIES, type BoardTask, type Property, type Stay } from "@/components/board/model";

export const [WAVESONG, RED, LAKE_BREEZE, NAUTICAL_NEST] = PROPERTIES as [
  Property,
  Property,
  Property,
  Property,
];

/** Local midnight on a day in October 2026 unless a month is given (1-based) */
export const day = (d: number, month = 10, year = 2026) => new Date(year, month - 1, d);

let seq = 0;

export function makeStay(overrides: Partial<Stay> & { checkIn: Date; checkOut: Date }): Stay {
  seq += 1;
  const { checkIn, checkOut } = overrides;
  return {
    id: `stay-${seq}`,
    property: WAVESONG,
    guest: `Guest ${seq}`,
    closed: false,
    nights: Math.round((checkOut.getTime() - checkIn.getTime()) / 864e5),
    ...overrides,
  };
}

export function makeTask(overrides: Partial<BoardTask> & { due: Date }): BoardTask {
  seq += 1;
  return {
    id: `task-${seq}`,
    kind: "welcome",
    title: "Welcome letter",
    guest: "Jen",
    property: WAVESONG,
    stayId: null,
    ...overrides,
  };
}
