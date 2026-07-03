"use client";

/**
 * The Book — the ratified rules presented in Compendium mode (paper), with
 * clause-numbered deep anchors (/rules#5.4) and LIVE demo boards powered by
 * the real engine. Digital additions, never rewrites: every statement here
 * traces to Rulebook v3.1, and every highlighted move is engine-true.
 */
import { useMemo } from "react";
import Link from "next/link";
import { MeridianRose } from "@/components/brand/MeridianRose";
import { DemoBoard } from "@/components/board/DemoBoard";
import { demoState } from "@/lib/game/demo-positions";
import { BRAND } from "@/config/brand";

/** Contents — one entry per section below; drives the sticky chip-row. */
const CONTENTS = [
  { id: "deltas", label: "Seven differences" },
  { id: "1", label: "§1 · The object" },
  { id: "2", label: "§2 · The board" },
  { id: "3", label: "§3 · Turns" },
  { id: "4", label: "§4 · The pieces" },
  { id: "5", label: "§5 · Meridian & halo" },
  { id: "6", label: "§6 · Check & mate" },
  { id: "7", label: "§7 · Special rules" },
] as const;

export default function RulesPage() {
  const wrapDemo = useMemo(
    () => demoState([{ at: "5B", kind: "R", seat: 1, hasMoved: true }]),
    [],
  );
  const pawnDemo = useMemo(
    () =>
      demoState([
        { at: "2B", kind: "P", seat: 1 },
        { at: "31B", kind: "P", seat: 1 },
      ]),
    [],
  );
  const curlDemo = useMemo(
    () => demoState([{ at: "5B", kind: "B", seat: 1, hasMoved: true }]),
    [],
  );
  const evapDemo = useMemo(
    () => demoState([{ at: "2B", kind: "N", seat: 1, hasMoved: true, origin: "1C" }]),
    [],
  );
  const haloDemo = useMemo(
    () => demoState([{ at: "2B", kind: "N", seat: 1, halo: true, hasMoved: true, origin: "1C" }]),
    [],
  );
  const castleDemo = useMemo(
    () =>
      demoState(
        [
          { at: "32D", kind: "K", seat: 1 },
          { at: "1D", kind: "Q", seat: 1 },
          { at: "32A", kind: "R", seat: 1 },
        ],
        1,
        { startMoved: ["32B", "32C"] },
      ),
    [],
  );
  const promoDemo = useMemo(
    () => demoState([{ at: "7B", kind: "P", seat: 1, origin: "2B", hasMoved: true }]),
    [],
  );

  return (
    <main className="compendium min-h-screen">
      <div className="mx-auto max-w-3xl px-6 pb-20">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-2xl text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            <MeridianRose size={28} className="text-[color:var(--ink)]" />
            {BRAND.name}
          </Link>
          <nav className="flex gap-4 text-sm text-[color:var(--ink-dim)]">
            <Link href="/learn" className="hover:underline">
              Learn the game
            </Link>
            <Link href="/about" className="hover:underline">
              The Story
            </Link>
            <Link href="/login" className="hover:underline">
              Sign in
            </Link>
          </nav>
        </header>

        <h1
          className="border-b-2 border-[color:var(--rule-red)] pb-3 text-4xl text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          The Book
        </h1>
        <p className="pt-2 text-sm text-[color:var(--ink-dim)]">
          Rulebook {BRAND.rulebookVersion} — the table's ratified rules. Every
          diagram below is live: tap a piece to see its true moves.
        </p>

        {/* ---- Contents — a slim sticky finding-aid, in the paper idiom ---- */}
        <nav
          aria-label="Contents"
          className="sticky top-0 z-10 -mx-6 mt-4 border-b border-[color:var(--rule-red)] bg-[color:var(--paper)]"
        >
          <div
            className="flex items-center gap-x-5 overflow-x-auto whitespace-nowrap px-6 py-2.5 text-xs text-[color:var(--ink-dim)]"
            style={{ fontFamily: "var(--font-instrument-sans)" }}
          >
            {CONTENTS.map((entry) => (
              <a
                key={entry.id}
                href={`#${entry.id}`}
                className="shrink-0 hover:underline"
              >
                {entry.label}
              </a>
            ))}
          </div>
        </nav>

        {/* ---- Already play chess? The seven deltas ---- */}
        <Section
          id="deltas"
          title="Already play chess? Seven differences."
          plate="chapter-meridians"
        >
          <ol className="list-decimal space-y-2 pl-6">
            <li>
              The board is a ring: 4 files A(inner)–D(outer), 32 ranks
              clockwise. Coordinates are letter-first — <Mono>D32</Mono>,{" "}
              <Mono>A1</Mono>. Rank 32 borders rank 1.
            </li>
            <li>
              Four armies, two teams. Partners sit opposite; play runs
              clockwise. Checkmate EITHER opponent and your team takes the
              crown.
            </li>
            <li>
              Four red meridians divide the board. Yours runs through the
              middle of your camp.
            </li>
            <li>
              Pawns march away from their own meridian — half your pawns go
              clockwise, half counter — and promote on the opposing back rank
              they reach.
            </li>
            <li>
              Sliders wrap around the ring. Bishops trace a{" "}
              <em>banana curl</em> and may bounce off a rail once per move.
            </li>
            <li>
              Rooks, bishops, and knights need a <em>halo</em> — earned by a
              capture, or by reaching an enemy back rank — to cross their own
              meridian. Crossing without one, the piece completes its move and
              then <em>evaporates</em>.
            </li>
            <li>
              The first five rounds are double-moves (one on each side of your
              meridian), and a check is not checkmate until the threatened
              player's own turn arrives with no escape.
            </li>
          </ol>
        </Section>

        {/* ---- 1 ---- */}
        <Section id="1" title="§1 · The object, and the governing principle">
          <p>
            Four players, numbered clockwise. Seats 1 and 3 (North and South —
            red and blue) form one team; 2 and 4 (East and West — black and
            gold) the other. A team wins the moment either opposing player is
            checkmated (§1.2).
          </p>
          <p id="1.3" className="rounded border-l-2 border-[color:var(--rule-red)] bg-[color:var(--paper-raised)] p-3">
            <strong>The Standard Chess Principle (§1.3).</strong> Where the
            rules don't say otherwise, standard chess applies; where a rule is
            genuinely ambiguous, the reading closest to standard chess is the
            correct one. This app follows that principle, and every judgment
            call it makes is written down for the table's ratification rather
            than decided silently.
          </p>
        </Section>

        {/* ---- 2 ---- */}
        <Section id="2" title="§2 · The board" plate="chapter-board">
          <p>
            128 squares: four concentric FILES (A innermost through D) crossed
            by thirty-two RANKS numbered 1–32 clockwise. The center is
            unplayable; so is everything outside file D. The rank numbers
            printed in the center hole are absolute — they never renumber, no
            matter how the board is turned.
          </p>
          <p>
            Each player's camp: the two back ranks flanking their meridian
            carry rook (A), bishop (B), knight (C), and king-or-queen (D),
            with four pawns on the next rank out on each side. Kings and
            queens follow the like-pieces-face convention anchored on North's
            king at <Mono>32D</Mono>.
          </p>
          <DemoBoard
            state={wrapDemo}
            caption="§4.6 — tap the rook: file-wise moves wrap straight through the 32↔1 seam."
            className="mx-auto max-w-sm"
          />
        </Section>

        {/* ---- 3 ---- */}
        <Section
          id="3"
          title="§3 · Turns, and the double-move opening"
          plate="chapter-movement"
        >
          <p>
            Play proceeds clockwise, one move per turn — except the first FIVE
            rounds, where each turn is TWO moves, one on each side of your own
            meridian, recorded as a single turn (§3.2). The table built this
            rule from experience: it makes slow games engage faster, and it
            forbids the <em>Dormant Front</em> — developing against one
            opponent while leaving your partner alone against the other.
          </p>
        </Section>

        {/* ---- 4 ---- */}
        <Section id="4" title="§4 · How the pieces move" plate="chapter-curl">
          <p>
            Kings step one square any direction; queens slide along files,
            ranks, or diagonals; rooks slide along files (wrapping the ring)
            and ranks (bounded by the rails); knights make the standard L on
            the grid and never leave the annulus. All as standard, bent round
            (§4.1–4.6).
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <DemoBoard
              state={pawnDemo}
              caption="§4.7 — tap each pawn: they advance AWAY from their own meridian, in opposite directions."
            />
            <DemoBoard
              state={curlDemo}
              caption="§4.4 — tap the bishop: the banana curl, with one rail bounce per move."
            />
          </div>
          <p id="4.4">
            A bishop rides its color chain around the curve. Once per move it
            may bounce off a rail — inner or outer — and continue along the
            chain in the new direction. It never leaves its starting color,
            and it may stop on any open square along the way. Captures are
            legal before or after the bounce; the move ends at a blocker, a
            capture, or a rail with no bounce left.
          </p>
          <p id="4.7">
            Pawns advance along their file, away from their own meridian, one
            square at a time (two from their start), capturing one diagonal
            step forward. A pawn promotes the moment it reaches the opposing
            back rank in its path — the player's choice of queen, rook,
            bishop, or knight — and a promoted piece always carries a halo
            (§7.3).
          </p>
          <DemoBoard
            state={promoDemo}
            caption="§4.7/§7.3 — tap the pawn: one step from the enemy back rank, four promotion choices."
            className="mx-auto max-w-sm"
          />
        </Section>

        {/* ---- 5 ---- */}
        <Section
          id="5"
          title="§5 · The meridian, the halo, and the Avenger"
          plate="chapter-halos"
        >
          <p id="5.2">
            The four red lines are meridians; yours runs between your two back
            ranks. Kings and queens cross any meridian freely. Rooks, bishops,
            and knights — the <em>primary pieces</em> — may not safely cross
            their OWN meridian until they've earned a <strong>halo</strong>:
            capture any opposing piece, or reach (or pass) an opposing
            player's back rank, and the halo is yours for the rest of the
            game (§5.2).
          </p>
          <p id="5.3">
            Cross home without one and the piece <strong>evaporates</strong> —
            it completes its move, including any capture, and is then removed
            (§5.3). The app will warn you and let you do it anyway; after 250
            games, the kamikaze capture is a known weapon.
          </p>
          <p id="5.4">
            The <strong>Avenger</strong> exemption (§5.4): a primary piece
            still on its original square may cross penalty-free to answer the
            loss of a team piece that was itself taken on its original square.
            Alert defense, rewarded.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <DemoBoard
              state={evapDemo}
              caption="§5.3 — tap the unhaloed knight: crossing moves complete, then the piece evaporates."
            />
            <DemoBoard
              state={haloDemo}
              caption="§5.2 — the same knight, haloed: home is open, forever."
            />
          </div>
        </Section>

        {/* ---- 6 ---- */}
        <Section
          id="6"
          title="§6 · Check, and when mate actually lands"
          plate="chapter-crown"
        >
          <p id="6.3">
            You may never leave your own king in check — even certain your
            partner would fix it (§6.1). You owe your partner's king nothing
            (§6.2). And the rule that surprises every chess player:{" "}
            <strong>
              it is not checkmate until the threatened player's own turn
              arrives with no legal escape (§6.3)
            </strong>
            . A check declared across the table may be answered by the moves
            between — including, if they choose, the partner's.
          </p>
        </Section>

        {/* ---- 7 ---- */}
        <Section id="7" title="§7 · The special rules" plate="chapter-avenger">
          <p id="7.1">
            <strong>En passant (§7.1)</strong> works as in standard chess,
            available on the move immediately following the double step.
          </p>
          <p id="7.2">
            <strong>Castling (§7.2)</strong> comes in two shapes. Queenside:
            king and queen swap squares across your own meridian. Kingside:
            the king slides radially inward D→A along its back rank while the
            rook steps out A→B — legal only when neither has moved, the B and
            C pieces have genuinely moved away, no square the king touches is
            attacked, and you are not in check.
          </p>
          <DemoBoard
            state={castleDemo}
            caption="§7.2 — tap the king: both castling shapes, live. (O-O-O swaps K and Q; O-O runs the king inward.)"
            className="mx-auto max-w-sm"
          />
          <p id="7.4">
            <strong>Draws.</strong> Stalemate is a draw for all four (§7.4).
            Threefold repetition and the fifty-move rule are CLAIMS — the app
            detects them and offers the button; nothing ends on its own
            (§7.5–7.6). All four players may also simply agree (§7.7).
          </p>
        </Section>

        <div className="mt-10 border-t border-[color:var(--rule-red)] pt-6 text-center">
          <Link
            href="/login"
            className="inline-block rounded-full bg-[color:var(--ink)] px-6 py-3 text-sm text-[color:var(--paper)]"
            style={{ fontFamily: "var(--font-instrument-sans)" }}
          >
            Take a seat
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({
  id,
  title,
  plate,
  children,
}: {
  id: string;
  title: string;
  /** Optional engraved chapter plate — decorative, sits above the heading. */
  plate?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-14 space-y-4 pt-10">
      {plate && (
        <img
          src={`/plates/${plate}.webp`}
          alt=""
          aria-hidden="true"
          width={800}
          height={597}
          loading="lazy"
          className="ml-auto block h-auto max-h-40 w-auto rounded border border-[color:var(--ink-dim)]/30 shadow-sm"
        />
      )}
      <h2
        className="text-2xl text-[color:var(--ink)]"
        style={{ fontFamily: "var(--font-instrument-serif)" }}
      >
        {title}
      </h2>
      <div
        className="space-y-4 leading-relaxed text-[color:var(--ink)]"
        style={{ fontFamily: "var(--font-source-serif)" }}
      >
        {children}
      </div>
    </section>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded bg-[color:var(--paper-raised)] px-1"
      style={{ fontFamily: "var(--font-plex-mono)" }}
    >
      {children}
    </span>
  );
}
