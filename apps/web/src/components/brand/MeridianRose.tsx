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
      {/* the ring — gapped at north (±20°) so the crown-notch seats INSIDE
          the gap instead of scribbling over the stroke. Endpoints:
          (24 ± 16·sin20°, 24 − 16·cos20°) ≈ (29.47|18.53, 8.96). */}
      <path
        d="M 29.47 8.96 A 16 16 0 1 1 18.53 8.96"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* four meridian ticks */}
      <line x1="24" y1="2" x2="24" y2="9" stroke="var(--rule-red, #a8352a)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="39" x2="24" y2="46" stroke="var(--rule-red, #a8352a)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="2" y1="24" x2="9" y2="24" stroke="var(--rule-red, #a8352a)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="39" y1="24" x2="46" y2="24" stroke="var(--rule-red, #a8352a)" strokeWidth="2.5" strokeLinecap="round" />
      {/* the crown-notch at north: a clean three-point notch bridging the
          ring gap — points at each ring end plus a center point, valleys
          dipping inward. Same stroke as the ring so it reads as one mark. */}
      <path
        d="M 18.53 8.96 L 21.2 13.2 L 24 9.4 L 26.8 13.2 L 29.47 8.96"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
