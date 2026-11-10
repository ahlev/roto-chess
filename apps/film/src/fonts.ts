import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadSans } from "@remotion/google-fonts/InstrumentSans";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";

const serif = loadSerif("normal", { weights: ["400"], subsets: ["latin"] });
const serifItalic = loadSerif("italic", { weights: ["400"], subsets: ["latin"] });
const sans = loadSans("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

export const FONTS = {
  display: `${serif.fontFamily}, Georgia, serif`,
  displayItalic: `${serifItalic.fontFamily}, Georgia, serif`,
  sans: `${sans.fontFamily}, system-ui, sans-serif`,
  mono: `${mono.fontFamily}, ui-monospace, monospace`,
} as const;

export const fontsReady = Promise.all([serif.waitUntilDone(), serifItalic.waitUntilDone(), sans.waitUntilDone(), mono.waitUntilDone()]);
