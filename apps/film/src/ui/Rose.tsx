import { PALETTE } from "../theme";

export const Rose = ({ x, y, size, color = PALETTE.text, opacity = 1 }: { x: number; y: number; size: number; color?: string; opacity?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${size / 48})`} opacity={opacity}>
    <path d="M 29.47 8.96 A 16 16 0 1 1 18.53 8.96" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <g stroke={PALETTE.ruleRed} strokeWidth="2.5" strokeLinecap="round">
      <line x1="24" y1="2" x2="24" y2="9" />
      <line x1="24" y1="39" x2="24" y2="46" />
      <line x1="2" y1="24" x2="9" y2="24" />
      <line x1="39" y1="24" x2="46" y2="24" />
    </g>
    <path d="M 18.53 8.96 L 21.2 13.2 L 24 9.4 L 26.8 13.2 L 29.47 8.96" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </g>
);
