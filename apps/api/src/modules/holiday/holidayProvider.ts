/**
 * Public-holiday auto-blocking (01-milestones.md Phase 1) — keyed off `Business.region`
 * (e.g. "SG"), which already exists on the schema for this purpose. `HolidayProvider` is
 * the swappable seam (same shape as `CalendarAdapter`/`KeyProvider`): `BookingService`
 * only ever depends on the interface below.
 */
export interface Holiday {
  /** YYYY-MM-DD, in the business's local calendar date. */
  date: string;
  name: string;
}

export interface HolidayProvider {
  /** Public holidays for a region in a given calendar year. */
  getHolidays(region: string, year: number): Promise<Holiday[]>;
}

/**
 * Real default: Nager.Date (https://date.nager.at) is a free, keyless public-holiday API —
 * unlike Google Calendar, no OAuth credentials are needed, so this can be the actual
 * production default rather than a stub. Region codes are ISO 3166-1 alpha-2 (matches
 * `Business.region`, e.g. "SG").
 *
 * Fails open: a transient outage of a third-party holiday API should never block a real
 * booking, so a failed fetch is logged and treated as "no known holidays" rather than
 * thrown. Results are cached per region+year for the process lifetime — public holidays
 * for a given year don't change.
 */
export class NagerDateHolidayProvider implements HolidayProvider {
  private cache = new Map<string, Holiday[]>();

  constructor(
    private readonly baseUrl = "https://date.nager.at/api/v3/publicholidays",
    private readonly onError: (err: unknown) => void = () => {},
  ) {}

  async getHolidays(region: string, year: number): Promise<Holiday[]> {
    const cacheKey = `${region}:${year}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch(`${this.baseUrl}/${year}/${region}`);
      if (!res.ok) {
        // Unsupported/unknown region code (Nager returns 204/404) is not an error worth
        // logging — just means "no holiday data for this region".
        this.cache.set(cacheKey, []);
        return [];
      }
      const body = (await res.json()) as Array<{ date: string; localName: string }>;
      const holidays = body.map((h) => ({ date: h.date, name: h.localName }));
      this.cache.set(cacheKey, holidays);
      return holidays;
    } catch (err) {
      this.onError(err);
      return [];
    }
  }
}

/** In-memory holiday table for local dev/tests, so booking logic is exercisable offline. */
export class StaticHolidayProvider implements HolidayProvider {
  constructor(private readonly table: Record<string, Holiday[]> = {}) {}

  async getHolidays(region: string, year: number): Promise<Holiday[]> {
    return (this.table[`${region}:${year}`] ?? []).slice();
  }
}

/** Formats a Date as YYYY-MM-DD in the given IANA timezone (no extra date library needed). */
export function toLocalDateString(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
