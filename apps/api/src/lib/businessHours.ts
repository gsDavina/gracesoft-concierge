import type { BlueprintHours, BlueprintTimeSlot, Weekday } from "@gracesoft/shared-types";

/**
 * Single source of truth for reading a Blueprint's opening hours — used both to offer
 * slots (AvailabilityService) and to reject out-of-hours bookings (BookingService), so
 * the two can never disagree about when a business is open.
 */

/**
 * A day's bookable ranges, sorted by start time. Reads `slots` when present, otherwise
 * falls back to the legacy single `opens`/`closes` pair. Malformed or empty ranges
 * (closes <= opens) are dropped rather than treated as open.
 */
export function getDaySlots(dayHours: BlueprintHours | undefined): BlueprintTimeSlot[] {
  if (!dayHours || dayHours.closed) return [];
  const raw =
    dayHours.slots ??
    (dayHours.opens && dayHours.closes ? [{ opens: dayHours.opens, closes: dayHours.closes }] : []);
  return raw
    .filter((s) => isTime(s.opens) && isTime(s.closes) && toMinutes(s.closes) > toMinutes(s.opens))
    .sort((a, b) => toMinutes(a.opens) - toMinutes(b.opens));
}

/** True if [startMinutes, endMinutes) sits entirely inside one of `slots`. */
export function fitsWithinSlots(slots: BlueprintTimeSlot[], startMinutes: number, endMinutes: number): boolean {
  return slots.some((s) => startMinutes >= toMinutes(s.opens) && endMinutes <= toMinutes(s.closes));
}

/** "HH:mm" -> minutes since midnight. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h! * 60 + m!;
}

/** Minutes since midnight -> "HH:mm". */
export function fromMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function weekdayOf(dateStr: string, timeZone: string): Weekday {
  const d = new Date(`${dateStr}T12:00:00Z`); // noon UTC keeps this clear of any zone's day boundary
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(d).toLowerCase();
  return name as Weekday;
}

/** An instant as business-local calendar date ("YYYY-MM-DD") + minutes since local midnight. */
export function toLocalDateAndMinutes(instant: Date, timeZone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
  };
}

function isTime(value: string | undefined): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
