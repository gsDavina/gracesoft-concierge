/** Public holiday used for booking auto-blocking (01-milestones.md Phase 1). */
export interface Holiday {
  /** YYYY-MM-DD, in the business's local calendar date. */
  date: string;
  name: string;
}
