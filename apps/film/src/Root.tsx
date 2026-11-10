import { Composition } from "remotion";
import { BoardCheck } from "./BoardCheck";
import { RoadmapFilm } from "./RoadmapFilm";
import { LAYOUTS } from "./layout";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Today } from "./scenes/Scene2Today";
import { Scene3Ground } from "./scenes/Scene3Ground";
import { Scene4Pocket } from "./scenes/Scene4Pocket";
import { Scene5Feel } from "./scenes/Scene5Feel";
import { Scene6Alone } from "./scenes/Scene6Alone";
import { Scene7Depth } from "./scenes/Scene7Depth";
import { Scene8Everywhere } from "./scenes/Scene8Everywhere";
import { FPS, TOTAL_FRAMES } from "./timeline";

export const Root = () => (
  <>
    <Composition
      id="RoadmapFilm"
      component={RoadmapFilm}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ format: "landscape" as const }}
    />
    <Composition id="BoardCheck" component={BoardCheck} durationInFrames={1} fps={FPS} width={1920} height={1080} />
    <Composition id="Scene1" component={Scene1Hook} durationInFrames={210} fps={FPS} width={1920} height={1080} defaultProps={{ layout: LAYOUTS.landscape }} />
    <Composition id="Scene2" component={Scene2Today} durationInFrames={210} fps={FPS} width={1920} height={1080} defaultProps={{ layout: LAYOUTS.landscape }} />
    <Composition id="Scene3" component={Scene3Ground} durationInFrames={240} fps={FPS} width={1920} height={1080} defaultProps={{ layout: LAYOUTS.landscape }} />
    <Composition id="Scene4" component={Scene4Pocket} durationInFrames={240} fps={FPS} width={1920} height={1080} defaultProps={{ layout: LAYOUTS.landscape }} />
    <Composition id="Scene5" component={Scene5Feel} durationInFrames={240} fps={FPS} width={1920} height={1080} defaultProps={{ layout: LAYOUTS.landscape }} />
    <Composition id="Scene6" component={Scene6Alone} durationInFrames={240} fps={FPS} width={1920} height={1080} defaultProps={{ layout: LAYOUTS.landscape }} />
    <Composition id="Scene7" component={Scene7Depth} durationInFrames={210} fps={FPS} width={1920} height={1080} defaultProps={{ layout: LAYOUTS.landscape }} />
    <Composition id="Scene8" component={Scene8Everywhere} durationInFrames={210} fps={FPS} width={1920} height={1080} defaultProps={{ layout: LAYOUTS.landscape }} />
  </>
);
