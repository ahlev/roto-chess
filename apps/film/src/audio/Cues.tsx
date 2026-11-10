import { Audio, Sequence, interpolate, staticFile } from "remotion";
import { TOTAL_FRAMES } from "../timeline";
import { CUE_SHEET } from "./cueSheet";

export const Cues = () => (
  <>
    <Audio
      src={staticFile("audio/motif.wav")}
      volume={(f) => 0.25 * interpolate(f, [TOTAL_FRAMES - 60, TOTAL_FRAMES], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
    />
    {CUE_SHEET.map((c, i) => (
      <Sequence key={`${c.cue}-${i}`} from={c.frame} durationInFrames={90}>
        <Audio src={staticFile(`audio/${c.cue}.wav`)} volume={c.gain ?? 0.8} />
      </Sequence>
    ))}
  </>
);
