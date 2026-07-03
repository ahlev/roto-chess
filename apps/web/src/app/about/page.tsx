import type { Metadata } from "next";
import Link from "next/link";
import { MeridianRose } from "@/components/brand/MeridianRose";
import { BRAND } from "@/config/brand";

export const metadata: Metadata = {
  title: "The Story",
  description:
    "A decade of games, four players, one circular board — how Roto Chess came to be.",
};

/**
 * The Story — Compendium mode (paper). The heritage IS the marketing:
 * ten years, ~250 hand-recorded games, a group chat that never stopped.
 */
export default function AboutPage() {
  return (
    <main className="compendium min-h-screen">
      <div className="mx-auto max-w-2xl px-6 pb-16">
        <header className="flex items-center justify-between py-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-2xl text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            <MeridianRose size={28} className="text-[color:var(--ink)]" />
            {BRAND.name}
          </Link>
          <nav className="flex gap-4 text-sm text-[color:var(--ink-dim)]">
            <Link href="/rules" className="hover:underline">
              The Book
            </Link>
            <Link href="/login" className="hover:underline">
              Sign in
            </Link>
          </nav>
        </header>

        <article
          className="space-y-6 text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-source-serif)" }}
        >
          <h1
            className="border-b border-[color:var(--rule-red)] pb-3 text-4xl"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            The Story
          </h1>

          <p className="text-lg leading-relaxed">
            Roto Chess wasn't designed. It accreted — over more than a decade
            of regular play among four friends who wanted chess they could all
            sit at together.
          </p>

          <img
            src="/plates/story-decade.webp"
            alt=""
            aria-hidden="true"
            width={800}
            height={537}
            loading="lazy"
            className="h-auto w-full rounded-lg border border-[color:var(--ink-dim)]/30"
          />

          <p className="leading-relaxed">
            The board began as a drawing: a chessboard bent into a ring, four
            armies at the compass points, partners across the table. The rules
            grew the way house rules do — by argument, by playing the position
            out, by someone insisting <em>that can't be legal</em> and being
            wrong. Hundreds of full games were played on shared slides and a
            group chat that never went quiet, each move typed out by hand in a
            notation the table invented for itself.
          </p>

          <p className="leading-relaxed">
            The strange parts earned their place. The <strong>halo</strong>{" "}
            exists because an early exploit — two partners hurling everything
            backward around their own meridians in a suicidal pincer — kept
            winning. The <strong>double-move opening</strong> exists because a
            slow game with four players needs engagement on both fronts, and
            because a player who develops toward only one opponent leaves their
            partner alone against the other: the table named that mistake the{" "}
            <em>Dormant Front</em>, and then wrote rules so it would hurt. The{" "}
            <strong>banana curl</strong> is just what a bishop's diagonal
            becomes on a circle — the name stuck the first time someone traced
            one.
          </p>

          <p className="leading-relaxed">
            The rulebook was formalized in 2026 — versioned, ratified,
            argued-over clause by clause — and this app is its first real
            client. The rules here are exactly the table's rules; where the
            book is silent, the app asks the table rather than deciding for
            it.
          </p>

          <img
            src="/plates/story-scoresheets.webp"
            alt=""
            aria-hidden="true"
            width={800}
            height={537}
            loading="lazy"
            className="h-auto w-full rounded-lg border border-[color:var(--ink-dim)]/30"
          />

          <p className="leading-relaxed">
            The archive of the original games — some 250 of them — still
            exists, and one day it will live here too.
          </p>

          <div className="border-t border-[color:var(--rule-red)] pt-6 text-center">
            <Link
              href="/rules"
              className="mr-3 inline-block rounded-full border border-[color:var(--ink-dim)] px-5 py-2 text-sm"
              style={{ fontFamily: "var(--font-instrument-sans)" }}
            >
              Read the Book
            </Link>
            <Link
              href="/login"
              className="inline-block rounded-full bg-[color:var(--ink)] px-5 py-2 text-sm text-[color:var(--paper)]"
              style={{ fontFamily: "var(--font-instrument-sans)" }}
            >
              Take a seat
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
