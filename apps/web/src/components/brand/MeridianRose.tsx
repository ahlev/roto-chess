/**
 * The Meridian Rose — the name-independent monogram: a ring, four meridian
 * ticks at the compass points, and a crown-notch at north. Works beside
 * "Roto Chess" or "Four Crowns"; works alone as favicon/app icon.
 * Drawn in code, always (never AI-generated).
 */
export function MeridianRose({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      {/* the ring */}
      <circle
        cx="24"
        cy="24"
        r="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      {/* four meridian ticks */}
      <line x1="24" y1="2" x2="24" y2="9" stroke="var(--rule-red, #a8352a)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="39" x2="24" y2="46" stroke="var(--rule-red, #a8352a)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="2" y1="24" x2="9" y2="24" stroke="var(--rule-red, #a8352a)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="39" y1="24" x2="46" y2="24" stroke="var(--rule-red, #a8352a)" strokeWidth="2.5" strokeLinecap="round" />
      {/* the crown-notch at north: a small notch cut into the ring */}
      <path
        d="M 19 9.2 L 21.5 13.5 L 24 9.8 L 26.5 13.5 L 29 9.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
