/**
 * Beat 8 (local 0–210): devices fade up (0–12); the account chip travels
 * the dotted path (20–62, 1.4 s); store pills at 120 (57 s); the rose and
 * name resolve at 150 (58 s); hold; fade to black 195–210. Type at 60.
 */
import { useCurrentFrame } from "remotion";
import { Meridians, Pieces, Squares } from "../board/Board";
import { useSprites } from "../board/sprites";
import { SCRIPT, piecesOf } from "../board/script";
import { FONTS } from "../fonts";
import type { Layout } from "../layout";
import { DUR, fade, tween } from "../motion";
import { PALETTE, SEAT_COLOR } from "../theme";
import { Chip } from "../ui/Chip";
import { LaptopFrame, PhoneFrame, TabletFrame } from "../ui/Devices";
import { LowerThird } from "../ui/LowerThird";
import { Rose } from "../ui/Rose";
import { SceneFrame } from "./SceneFrame";

/** Board scale as a fraction of the device box width (the landscape scales 0.46 / 0.72 / 0.42 over the 300 / 700 / 460 px boxes). */
const BOARD_K = { phone: 0.46 / 300, tablet: 0.72 / 700, laptop: 0.42 / 460 };

export const Scene8Everywhere = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const sprites = useSprites();
  const E = layout.everywhere;
  const pos = piecesOf(SCRIPT.states[16]!);
  const up = fade(frame, 0, DUR.slow);
  // Tablet and laptop boards sit left of their sidebars (36% / 33% across the box); the phone board is centred, below its "Your move" title.
  const Tp = { cx: E.phone.x + E.phone.w / 2, cy: E.phone.y + E.phone.h * 0.55, s: E.phone.w * BOARD_K.phone };
  const Tt = { cx: E.tablet.x + E.tablet.w * 0.36, cy: E.tablet.y + E.tablet.h / 2, s: E.tablet.w * BOARD_K.tablet };
  const Tl = { cx: E.laptop.x + E.laptop.w * 0.33, cy: E.laptop.y + E.laptop.h / 2, s: E.laptop.w * BOARD_K.laptop };
  const anchors = [
    { x: E.phone.x + E.phone.w / 2, y: E.phone.y - 40 },
    { x: E.tablet.x + E.tablet.w / 2, y: E.tablet.y - 40 },
    { x: E.laptop.x + E.laptop.w / 2, y: E.laptop.y - 40 },
  ];
  const t = tween(frame, 20, 1400, 0, 2);
  const seg = Math.min(1, Math.floor(t));
  const u = t - seg;
  const a = anchors[seg]!;
  const b = anchors[Math.min(2, seg + 1)]!;
  const cx = a.x + (b.x - a.x) * u;
  const cy = a.y + (b.y - a.y) * u - 90 * Math.sin(u * Math.PI);
  const black = fade(frame, 195, 500);
  return (
    <SceneFrame layout={layout} id="s8">
      <PhoneFrame box={E.phone} opacity={up} />
      <g opacity={up}>
        <Squares T={Tp} />
        <Meridians T={Tp} width={2} />
        {sprites ? <Pieces T={Tp} pieces={pos} sprites={sprites} size={15} /> : null}
        <text x={E.phone.x + E.phone.w / 2} y={E.phone.y + 70} fontFamily={FONTS.sans} fontSize="20" fontWeight="600" fill={PALETTE.text} textAnchor="middle">Your move</text>
      </g>
      <TabletFrame box={E.tablet} opacity={up} />
      <g opacity={up}>
        <Squares T={Tt} />
        <Meridians T={Tt} width={2.5} />
        {sprites ? <Pieces T={Tt} pieces={pos} sprites={sprites} size={24} /> : null}
        <text x={E.tablet.x + E.tablet.w - 220} y={E.tablet.y + 90} fontFamily={FONTS.mono} fontSize="14" fill={PALETTE.textDim} letterSpacing="2">HISTORY</text>
        {["12. N C9→D11", "13. B B1→C3", "14. P A2→A4", "15. Q D1→C2"].map((row, i) => (
          <text key={row} x={E.tablet.x + E.tablet.w - 220} y={E.tablet.y + 126 + i * 30} fontFamily={FONTS.mono} fontSize="17" fill={i === 3 ? PALETTE.text : PALETTE.textDim}>{row}</text>
        ))}
      </g>
      <LaptopFrame box={E.laptop} opacity={up} />
      <g opacity={up}>
        <Squares T={Tl} />
        <Meridians T={Tl} width={2} />
        {sprites ? <Pieces T={Tl} pieces={pos} sprites={sprites} size={14} /> : null}
        <text x={E.laptop.x + E.laptop.w - 160} y={E.laptop.y + 90} fontFamily={FONTS.mono} fontSize="15" fill={PALETTE.textDim} letterSpacing="2">Observing</text>
        <text x={E.laptop.x + E.laptop.w - 160} y={E.laptop.y + 124} fontFamily={FONTS.sans} fontSize="18" fill={SEAT_COLOR[4]}>West · Casey</text>
      </g>
      <path d={`M ${anchors[0]!.x} ${anchors[0]!.y} Q ${(anchors[0]!.x + anchors[1]!.x) / 2} ${anchors[0]!.y - 90} ${anchors[1]!.x} ${anchors[1]!.y} Q ${(anchors[1]!.x + anchors[2]!.x) / 2} ${anchors[1]!.y - 90} ${anchors[2]!.x} ${anchors[2]!.y}`} fill="none" stroke={SEAT_COLOR[4]} strokeWidth="2.5" strokeDasharray="4 12" strokeLinecap="round" opacity={0.8 * fade(frame, 14, DUR.base)} />
      {anchors.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="7" fill={SEAT_COLOR[4]} opacity={fade(frame, 14 + i * 20, DUR.base)} />)}
      <g opacity={fade(frame, 20, DUR.base)}>
        <Chip x={cx - 175} y={cy - 26} w={350} h={52} label="Alex · one account, every device" color={SEAT_COLOR[4]} size={21} />
      </g>
      <g opacity={fade(frame, 120, DUR.slow)}>
        <Chip x={E.store.x} y={E.store.y} w={190} h={50} label="App Store" color={PALETTE.textDim} textColor={PALETTE.text} size={20} />
        <Chip x={E.store.x + 210} y={E.store.y} w={200} h={50} label="Google Play" color={PALETTE.textDim} textColor={PALETTE.text} size={20} />
        <text x={E.store.x + 200} y={E.store.y + 90} fontFamily={FONTS.sans} fontSize="19" fill={PALETTE.textDim} textAnchor="middle">native shell around the same code</text>
      </g>
      <g opacity={fade(frame, 150, DUR.ceremony)}>
        <Rose x={E.brandX} y={E.brandY} size={96} />
        <text x={E.brandX + 120} y={E.brandY + 70} fontFamily={FONTS.display} fontSize="84" fill={PALETTE.text}>Roto Chess</text>
      </g>
      <LowerThird text="One game. Every table." enterAt={60} layout={layout} id="s8" />
      <rect width={layout.width} height={layout.height} fill="#000" opacity={black} />
    </SceneFrame>
  );
};
