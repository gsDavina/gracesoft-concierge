/**
 * Converts a business-local wall-clock date+time into the correct UTC instant, using
 * only Intl.DateTimeFormat (no date-fns-tz/luxon dependency). Needed by
 * modules/booking/availabilityService.ts to turn "9:00 AM on 2026-01-05, Asia/Singapore"
 * into the ISO instant BookingService.create() expects.
 *
 * How it works: treat the wall-clock values as if they were already UTC (`utcGuess`),
 * then ask Intl how that instant actually reads in `timeZone`. The difference between
 * the two is the zone's UTC offset at that instant — subtract it from `utcGuess` to get
 * the real UTC instant. This is correct for any IANA zone, including ones with DST,
 * except for the (rare, and out of scope here) ambiguous/skipped hour right at a DST
 * transition.
 */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year!, month! - 1, day!, hour!, minute!));

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(utcGuess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");

  const shownAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  const offsetMs = shownAsUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}
