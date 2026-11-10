import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { BoardSvg } from "../board/Board";
import type { Layout } from "../layout";
import { PALETTE } from "../theme";

export const SceneFrame = ({ layout, id, children }: { layout: Layout; id: string; children: ReactNode }) => (
  <AbsoluteFill style={{ backgroundColor: PALETTE.bg }}>
    <BoardSvg width={layout.width} height={layout.height}>
      <defs>
        <radialGradient id={`vig-${id}`} cx="50%" cy="48%" r="70%">
          <stop offset="60%" stopColor={PALETTE.bg} stopOpacity="0" />
          <stop offset="100%" stopColor="#0b0906" stopOpacity="0.75" />
        </radialGradient>
        <radialGradient id={`glow-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={PALETTE.halo} stopOpacity="0.55" />
          <stop offset="100%" stopColor={PALETTE.halo} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={layout.width} height={layout.height} fill={PALETTE.bg} />
      {children}
      <rect width={layout.width} height={layout.height} fill={`url(#vig-${id})`} />
    </BoardSvg>
  </AbsoluteFill>
);
