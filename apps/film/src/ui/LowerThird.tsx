import { useCurrentFrame } from "remotion";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { enter } from "../motion";
import { PALETTE } from "../theme";

/**
 * The on-screen line: a bottom scrim so type reads over any board, a red
 * meridian tick, and the line rising 24 px as it fades in (400 ms settle).
 * `enterAt` is the scene-local frame the line starts entering.
 */
export const LowerThird = ({ text, enterAt, layout, id }: { text: string; enterAt: number; layout: Layout; id: string }) => {
  const frame = useCurrentFrame();
  const { opacity, dy } = enter(frame, enterAt);
  const scrimTop = layout.height - 260;
  return (
    <g>
      <defs>
        <linearGradient id={`scrim-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PALETTE.bg} stopOpacity="0" />
          <stop offset="0.45" stopColor={PALETTE.bg} stopOpacity="0.7" />
          <stop offset="1" stopColor={PALETTE.bg} stopOpacity="0.94" />
        </linearGradient>
      </defs>
      <rect x="0" y={scrimTop} width={layout.width} height="260" fill={`url(#scrim-${id})`} opacity={opacity} />
      <g transform={`translate(${layout.lowerX} ${layout.lowerY + dy})`} opacity={opacity}>
        <line x1="0" y1={-layout.lowerSize * 0.4} x2="0" y2="2" stroke={PALETTE.boardMeridian} strokeWidth="5" strokeLinecap="round" />
        <text x="34" y="0" fontFamily={FONTS.display} fontSize={layout.lowerSize} fill={PALETTE.text} letterSpacing="-1">
          {text}
        </text>
      </g>
    </g>
  );
};
