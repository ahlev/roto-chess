import { useEffect, useState } from "react";
import { AbsoluteFill, Sequence, cancelRender, continueRender, delayRender } from "remotion";
import { Cues } from "./audio/Cues";
import { fontsReady } from "./fonts";
import { LAYOUTS } from "./layout";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Today } from "./scenes/Scene2Today";
import { Scene3Ground } from "./scenes/Scene3Ground";
import { Scene4Pocket } from "./scenes/Scene4Pocket";
import { Scene5Feel } from "./scenes/Scene5Feel";
import { Scene6Alone } from "./scenes/Scene6Alone";
import { Scene7Depth } from "./scenes/Scene7Depth";
import { Scene8Everywhere } from "./scenes/Scene8Everywhere";
import { PALETTE } from "./theme";
import { beatRange } from "./timeline";

// A type alias, not an interface: Remotion's Composition props must be assignable to Record<string, unknown>.
export type FilmProps = {
  format: "landscape" | "portrait";
};

const SCENES = [
  ["hook", Scene1Hook],
  ["today", Scene2Today],
  ["ground", Scene3Ground],
  ["pocket", Scene4Pocket],
  ["feel", Scene5Feel],
  ["alone", Scene6Alone],
  ["depth", Scene7Depth],
  ["everywhere", Scene8Everywhere],
] as const;

export const RoadmapFilm = ({ format }: FilmProps) => {
  const layout = LAYOUTS[format];
  // Hold every frame until the three Google fonts are loaded, so a render never captures a fallback face.
  const [handle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    fontsReady.then(() => continueRender(handle)).catch((e) => cancelRender(e));
  }, [handle]);
  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.bg }}>
      {SCENES.map(([id, Scene]) => {
        const { from, durationInFrames } = beatRange(id);
        return (
          <Sequence key={id} from={from} durationInFrames={durationInFrames} name={id}>
            <Scene layout={layout} />
          </Sequence>
        );
      })}
      <Cues />
    </AbsoluteFill>
  );
};
