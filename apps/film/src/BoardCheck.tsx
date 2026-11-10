import { AbsoluteFill } from "remotion";
import { initialState } from "@rotochess/engine";
import { BoardSvg, Meridians, Numerals, Pieces, Rails, Squares } from "./board/Board";
import { useSprites } from "./board/sprites";
import { piecesOf } from "./board/script";
import { PALETTE } from "./theme";

export const BoardCheck = () => {
  const sprites = useSprites();
  const T = { cx: 960, cy: 540, s: 1.6 };
  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.bg }}>
      <BoardSvg width={1920} height={1080}>
        <Squares T={T} />
        <Rails T={T} />
        <Meridians T={T} />
        <Numerals T={T} />
        {sprites ? <Pieces T={T} pieces={piecesOf(initialState())} sprites={sprites} /> : null}
      </BoardSvg>
    </AbsoluteFill>
  );
};
