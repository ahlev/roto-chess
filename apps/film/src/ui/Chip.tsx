import { FONTS } from "../fonts";
import { PALETTE } from "../theme";

export const Chip = ({ x, y, w, h, label, color, fill = PALETTE.surfaceRaised, textColor, size = 24, opacity = 1 }: { x: number; y: number; w: number; h: number; label: string; color: string; fill?: string; textColor?: string; size?: number; opacity?: number }) => (
  <g transform={`translate(${x} ${y})`} opacity={opacity}>
    <rect width={w} height={h} rx={h / 2} fill={fill} stroke={color} strokeWidth="2" />
    <text x={w / 2} y={h / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontFamily={FONTS.sans} fontSize={size} fontWeight="500" fill={textColor ?? color}>
      {label}
    </text>
  </g>
);
