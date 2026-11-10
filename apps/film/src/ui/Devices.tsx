import type { Box } from "../layout";
import { PALETTE } from "../theme";

export const PhoneFrame = ({ box, opacity = 1 }: { box: Box; opacity?: number }) => (
  <g opacity={opacity}>
    <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="44" fill="#0b0907" stroke={PALETTE.line} strokeWidth="3" />
    <rect x={box.x + 12} y={box.y + 12} width={box.w - 24} height={box.h - 24} rx="34" fill={PALETTE.surface} />
  </g>
);

export const TabletFrame = ({ box, opacity = 1 }: { box: Box; opacity?: number }) => (
  <g opacity={opacity}>
    <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="30" fill="#0b0907" stroke={PALETTE.line} strokeWidth="3" />
    <rect x={box.x + 14} y={box.y + 14} width={box.w - 28} height={box.h - 28} rx="20" fill={PALETTE.surface} />
  </g>
);

export const LaptopFrame = ({ box, opacity = 1 }: { box: Box; opacity?: number }) => (
  <g opacity={opacity}>
    <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="16" fill="#0b0907" stroke={PALETTE.line} strokeWidth="3" />
    <rect x={box.x + 10} y={box.y + 10} width={box.w - 20} height={box.h - 20} rx="10" fill={PALETTE.surface} />
    <path d={`M${box.x - 50} ${box.y + box.h + 2} h${box.w + 100} l-14 22 h-${box.w + 72} z`} fill="#141009" stroke={PALETTE.line} strokeWidth="2" />
  </g>
);
