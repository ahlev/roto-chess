import Link from "next/link";
import { MeridianRose } from "@/components/brand/MeridianRose";
import { HeroBoard } from "@/components/board/HeroBoard";
import { BRAND } from "@/config/brand";

/**
 * Landing — sell the game in ten seconds to an invite-link clicker.
 * The auto-playing board carries the pitch; the copy stays out of its way.
 * The engraved games-room plate sits BEHIND everything under a heavy espresso
 * veil — ambiance, never a billboard; the board and copy keep full contrast.
 */
export default function Landing() {
  return (
    <main className="min-h-screen">
      {/* ---- Hero band: hero-a plate, dark-veiled, behind header + hero ---- */}
      <div className="relative overflow-hidden">
        <img
          src="/plates/hero-a.webp"
          alt=""
          aria-hidden="true"
          width={1376}
          height={768}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-[rgba(23,19,14,0.78)] via-[rgba(23,19,14,0.7)] to-[color:var(--bg)]"
        />
        <div className="relative mx-auto max-w-5xl px-6">
          <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-5">
            <span
              className="flex items-center gap-2 text-2xl text-text"
              style={{ fontFamily: "var(--font-instrument-serif)" }}
            >
              <MeridianRose size={30} className="text-text" />
              {BRAND.name}
            </span>
            <nav className="flex items-center gap-4 text-sm text-text-dim">
              <Link href="/rules" className="hover:underline">
                The Book
              </Link>
              <Link href="/about" className="hover:underline">
                The Story
              </Link>
              <Link href="/login" className="hover:underline">
                Sign in
              </Link>
            </nav>
          </header>

          <section className="grid items-center gap-10 py-8 md:grid-cols-2">
            <div>
              <h1
                className="text-5xl leading-tight text-text"
                style={{ fontFamily: "var(--font-instrument-serif)" }}
              >
                Chess, bent into a ring.
                <br />
                Four players. Two crowns.
              </h1>
              <p className="mt-4 max-w-md text-text-dim">
                {BRAND.description}
              </p>
              <div className="mt-6 flex gap-3">
                <Link
                  href="/login"
                  className="rounded-full bg-[color:var(--focus-ring)] px-6 py-3 font-semibold text-[color:var(--ink)]"
                >
                  Take a seat
                </Link>
                <Link
                  href="/learn"
                  className="rounded-full border border-line px-6 py-3 text-text-dim"
                >
                  How to play
                </Link>
              </div>
              <p className="mt-4 text-xs text-text-dim">
                Or{" "}
                <Link href="/hotseat" className="underline">
                  play hotseat on this device
                </Link>{" "}
                — no account, four chairs, one phone.
              </p>
            </div>
            <div className="mx-auto w-full max-w-lg">
              <HeroBoard className="w-full" />
            </div>
          </section>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6">
        <section className="grid gap-6 border-t border-line py-10 md:grid-cols-3">
          {[
            {
              title: "One move on each side",
              body: "The five opening rounds are double-moves — one on each side of your meridian. Both opponents feel you arrive.",
            },
            {
              title: "Earn your way home",
              body: "Rooks, bishops, and knights cross their own meridian only with a halo — earned by capture, or by reaching an enemy back rank. Cross without one and the piece evaporates.",
            },
            {
              title: "The table persists",
              body: "Your four, your chat, your running tally. Games are episodes; the table is the thing. Run it back whenever.",
            },
          ].map((f) => (
            <div key={f.title}>
              <h3
                className="text-lg text-text"
                style={{ fontFamily: "var(--font-instrument-serif)" }}
              >
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-dim">
                {f.body}
              </p>
            </div>
          ))}
        </section>
      </div>

      {/* ---- Footer band: footer-band plate under the same discipline ---- */}
      <div className="relative overflow-hidden">
        <img
          src="/plates/footer-band.webp"
          alt=""
          aria-hidden="true"
          width={1584}
          height={672}
          loading="lazy"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-[color:var(--bg)] to-[rgba(23,19,14,0.78)]"
        />
        <div className="relative mx-auto max-w-5xl px-6 pb-16">
          <footer className="border-t border-line pt-6 text-center text-xs text-text-dim">
            <MeridianRose size={22} className="mx-auto mb-2 text-text-dim" />
            <p>
              {BRAND.name} — a four-player circular chess variant, played for a
              decade before it was software.
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
