/**
 * Per _internal-docs/09-branding-guidelines.md's "Logo" rule: the first 2 capital
 * letters of the product name, in the same colour treatment as the company mark.
 */
export function Mark({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: "var(--accent-solid)",
        color: "var(--accent-contrast)",
        fontFamily: "var(--font-montserrat), sans-serif",
        fontWeight: 800,
        fontStyle: "italic",
        fontSize: size * 0.42,
        letterSpacing: -0.5,
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}
