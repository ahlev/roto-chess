import { BRAND } from "@/config/brand";

/**
 * Landing page — placeholder until M8 builds the real marketing page with
 * the auto-playing hero board. The hotseat room (M4) is the first real UI.
 */
export default function Landing() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1
        className="text-5xl text-text"
        style={{ fontFamily: "var(--font-instrument-serif)" }}
      >
        {BRAND.name}
      </h1>
      <p className="max-w-md text-center text-text-dim">{BRAND.tagline}</p>
    </main>
  );
}
