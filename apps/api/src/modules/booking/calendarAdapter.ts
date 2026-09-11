/**
 * Calendar write boundary. The parameter type is the enforcement mechanism for
 * "Calendar events write only: token, service type, time slot — never name/phone/notes"
 * (01-milestones.md Phase 0): there is no field on CalendarEventInput a caller could even
 * pass a name or phone number through.
 */
export interface CalendarEventInput {
  token: string;
  serviceType: string;
  startsAt: string;
  endsAt: string;
}

export interface CalendarEventRef {
  calendarEventId: string;
}

export interface CalendarAdapter {
  createEvent(input: CalendarEventInput): Promise<CalendarEventRef>;
  cancelEvent(calendarEventId: string): Promise<void>;
}

/**
 * Google Calendar API integration is not wired in yet — it needs a real Google Cloud
 * project + OAuth credentials per business, which don't exist in this environment.
 * `GoogleCalendarAdapter` is the seam where that client goes; every caller in
 * modules/booking already only depends on the `CalendarAdapter` interface above, so
 * swapping this in later touches nothing else.
 */
export class GoogleCalendarAdapter implements CalendarAdapter {
  createEvent(_input: CalendarEventInput): Promise<CalendarEventRef> {
    throw new Error(
      "GoogleCalendarAdapter is not configured. Provide Google Calendar OAuth credentials " +
        "and implement this adapter before using it — see packages docs (03-project-structure.md).",
    );
  }

  cancelEvent(_calendarEventId: string): Promise<void> {
    throw new Error("GoogleCalendarAdapter is not configured.");
  }
}

/** In-memory adapter for local dev and tests, so booking logic is exercisable without Google Calendar. */
export class InMemoryCalendarAdapter implements CalendarAdapter {
  private events = new Map<string, CalendarEventInput>();
  private counter = 0;

  async createEvent(input: CalendarEventInput): Promise<CalendarEventRef> {
    const calendarEventId = `local-${++this.counter}`;
    this.events.set(calendarEventId, input);
    return { calendarEventId };
  }

  async cancelEvent(calendarEventId: string): Promise<void> {
    this.events.delete(calendarEventId);
  }
}
