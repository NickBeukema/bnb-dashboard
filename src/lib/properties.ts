/**
 * The rentals, in the order they're listed everywhere (calendar lanes, legends, API sources).
 * `name` is the iCal source name and the Todoist label, so it can't change without
 * re-labelling existing tasks.
 */
export const PROPERTY_CONFIG = [
  {
    name: "Wavesong",
    icalEnv: "WAVESONG_ICAL_URL",
    color: "#1e56b0",
    token: "wavesong",
    initial: "W",
    doorCode: true,
  },
  {
    name: "Red",
    icalEnv: "RED_ICAL_URL",
    color: "#ff0000",
    token: "red-house",
    initial: "R",
    doorCode: false,
  },
  {
    name: "Lake Breeze",
    icalEnv: "LAKE_BREEZE_ICAL_URL",
    color: "#21a677",
    token: "lake-breeze",
    initial: "L",
    doorCode: true,
  },
  {
    name: "Nautical Nest",
    icalEnv: "NAUTICAL_NEST_ICAL_URL",
    color: "#ffd700",
    token: "nautical-nest",
    initial: "N",
    doorCode: true,
  },
] as const;

export type PropertyConfig = (typeof PROPERTY_CONFIG)[number];
