# RULINGS.md — Rulebook Interpretations for Ratification

> **For:** Andrew (rules authority) · **From:** the V1 build
> **How this works:** Rulebook v3.1 is law. Where it is genuinely ambiguous, V1
> proceeds with the interpretation closest to standard chess (the rulebook's own
> §1.3 principle) — but never silently. Each ruling below gives (1) the decision
> to be made, in plain language with an example, (2) the assumption V1 made and
> its reasoning, and (3) what keeping vs. changing it means in practice. Every
> ruling is implemented behind a single named predicate in the engine, so a
> reversal is a one-line change that cannot ripple.
>
> Reply with a one-line verdict per ruling: **keep** or **change**.

---

## R1 — Self-check on the first opening submove

**The decision.** During the five opening rounds you make two moves in one turn
(§4.2). Must the *first* submove independently leave your king out of check, or
only the completed two-move turn? *Example: your king at 32D is screened from a
rook by your knight at 32C. Submove 1 moves the knight (exposing your king);
submove 2 blocks the line again with your bishop. Legal turn or not?*

**V1 assumes: every submove must independently satisfy the no-self-check rule**
(the example turn is illegal). §1.3 reasoning: in standard chess there is no
moment at which your king may stand in check; the closest reading treats each
submove as a real move.

**Keep vs. change.** Keeping it: fewer legal opening turns; no "phantom check"
moments; matches how you'd police it at a physical table. Changing it (only the
completed turn matters): slightly more opening freedom, including brief
self-exposure tricks; in-flight games are unaffected (the opening is over by
round 6). Code flip: predicate `openingSubmoveMustAvoidSelfCheck` in
`packages/engine/src/rulings.ts`.

---

## R2 — Legal single moves but no legal pair in the opening

**The decision.** Suppose during the opening a player has legal individual
moves, but no legal *combination* of one-move-each-side-of-the-meridian. Is that
stalemate? The rulebook defines the turn as two moves (§4.2) but is silent on
this edge.

**V1 assumes: no legal turn → the normal end-of-game evaluation applies** — if
the player is in check it is checkmate (§7.3); if not, stalemate draw (§8.4). A
player's "turn" is the unit the rules evaluate; if no legal turn exists, the
§7.3/§8.4 machinery decides, exactly as in standard chess when a player has no
legal move.

**Keep vs. change.** Keeping it: consistent, already implied by treating the
turn as atomic; this position is astronomically rare in practice. Changing it
(e.g., allow a single-move turn as a fallback): softer, but invents a rule the
book doesn't contain. Code flip: predicate `openingNoPairIsNoLegalTurn`.

---

## R3 — Queenside castling as an opening submove: which side is it?

**The decision.** Queenside castling swaps K and Q across your own meridian
(§8.2.1) — the move itself straddles the line. During the opening you owe one
submove per side (§4.2). Which side does the castle count toward?

**V1 assumes: it counts as the side of the King's origin square.** The King is
the piece castling is "about" in standard chess; its origin is the anchor.
*Example: P1 castles queenside (K 32D ↔ Q 1D). K origin 32D is the
counterclockwise side, so the other submove that turn must be on the clockwise
side (ranks 1–16).*

**Keep vs. change.** Keeping/changing only affects which second submoves pair
with an opening castle — a narrow, strategic nuance with no effect after round
5. Code flip: predicate `castleOpeningSideAnchor` (`"king"` → `"queen"`).

---

## R4 — Avenger: how "recent," and must the avenging move capture?

**The decision.** §6.4 exempts a non-haloed primary piece crossing its own
meridian if it is "avenging the recent loss" of a team piece, with two explicit
conditions (avenger unmoved on its start square; victim lost from its own start
square). "Recent" is undefined, and the rule doesn't say the avenging move must
itself capture.

**V1 assumes: eligibility persists while the two §6.4 conditions hold — no time
window — and the avenging move need not capture.** The two written conditions
are the entire test; adding an unwritten timer or an unwritten capture
requirement would be inventing rules. Once one of your team's unmoved pieces has
been captured on its start square, any of your still-unmoved primaries may cross
your meridian penalty-free (until that avenging piece itself moves, which ends
its own eligibility by breaking condition 1).

**Keep vs. change.** Keeping it: simple, teachable, matches the written text.
Changing to a tight window (e.g., only until your next turn ends): makes the
Avenger a rare reactive tactic rather than a standing right — a genuine gameplay
difference worth a table conversation. Code flip: predicate `isAvengingMove` in
one function; a window variant would add a `capturedAtPly` check.

---

## R5 — En passant windows across four players and the double-move opening

**The decision.** §8.1 says EP is "available only on the move immediately
following the two-square advance." With four players: whose move is
"immediately following"? And during the opening, is EP available to both
submoves of that following turn?

**V1 assumes: the EP target expires when the immediately-following player's
turn completes**, and during the opening it is available to *either* submove of
that turn (expiring at the turn's end either way). Closest to standard chess:
exactly one opponent turn of opportunity. Also encoded: a double-step made as
submove 1 of an opening turn still presents its EP target to the next player
even though the mover's submove 2 happened after it.

**Keep vs. change.** Widening the window (e.g., until the pawn's owner moves
again — three opponent turns) makes EP much stronger than standard chess.
Narrowing (submove 1 only) is arbitrary. In-flight games: EP windows are
seconds-scale; no migration concern. Code flip: predicate `epWindowIsOpen`.

---

## R6 — Kingside castling: do captured-in-place pieces "move away"?

**The decision.** §8.2.3 (v3.1): for kingside castling, files B and C must be
unoccupied *and* the knight and bishop "must both have moved away." If your
knight was captured while still sitting on its start square, the square is
empty — but the knight never *moved*. Castle legal or not?

**V1 assumes: NO — captured-in-place does not satisfy "moved away."** Reading
§8.2.3 literally: the pieces must have moved. (The v3.1 revision history shows
this clause was deliberately tightened, so the literal reading is respected.)

**Keep vs. change.** Keeping it: a player whose B/C pieces were captured at home
can never castle kingside — strict but literal. Changing it (empty squares
suffice, like standard chess's only-K-and-R-history rule): closer to §1.3's
standard-chess instinct, and arguably what a table would actually play. **This
one is a genuine coin-flip — please give it a real look.** Code flip: predicate
`kingsideCastleRequiresPiecesMoved`. The engine tracks "the piece that started
here has moved" separately from square emptiness, so both readings are cheap.

---

## R7 — §5.7 erratum: Player 4's direction labels (documentation fix, not a ruling)

**The discovery.** §2.1 numbers ranks 1–32 **clockwise**, so decreasing rank
numbers = counterclockwise. §5.7's Player 4 rows read "rank 23, clockwise →
rank 17" and "rank 26, counterclockwise → rank 32" — but 23→17 is *decreasing*
(counterclockwise) and 26→32 is *increasing* (clockwise). The direction words in
those two rows are swapped; the origin/promotion **ranks are correct** and agree
with §2.8 (pawns advance away from their own meridian) and with all six other
rows.

**V1 assumes the ranks, not the labels**: P4's rank-23 pawns advance
counterclockwise to promote at 17; rank-26 pawns advance clockwise to promote
at 32. No gameplay decision is actually at stake — the geometry only works one
way — but the rulebook text should be corrected in its next revision.

**Action for Andrew:** fix the two direction words in §5.7 in rulebook v3.2.

---

## R8 — What counts as "each side of their Meridian" for the opening pair?

**The decision.** §4.2 requires one opening move "on each side of their
Meridian," but the rulebook never says (a) which side a square *far* from your
meridian belongs to, or (b) whether a move's side is judged by its origin or
destination. Pawns can't get far in five rounds, but a knight or a slider can
travel past the board's halfway point, and any piece can move *across* regions.

**V1 assumes two conventions.** (a) The ring splits 16/16 at the antipode: the
16 ranks clockwise of your meridian are your clockwise side, the 16
counterclockwise are the other — the split falls exactly on your partner's
meridian, the only symmetric reading. (b) **A submove's side is the side of the
moved piece's ORIGIN square** — consistent with R3's treatment of castling and
with how a table would naturally police it ("you moved something from that
side").

**Keep vs. change.** These only matter for opening-turn legality in rounds 1–5.
Judging by destination instead of origin would let one piece "serve" the other
side by traveling there, which reads as against the rule's development purpose
(App. A.2). Code flip: predicates `openingSideSplit` / `openingSideAnchor`.

---

## R9 — Partner pieces are friendly (blocking, capture, and check)

**The decision.** The rulebook consistently says pieces capture "opposing"
pieces and that check comes from "an opposing piece" (§6.2, §7.1), but never
states outright whether you may capture your PARTNER's pieces or whether a
partner's piece could ever threaten your king.

**V1 assumes: partner pieces are fully friendly.** They block movement like
your own pieces, cannot be captured, and never deliver check. This is the
standard team-chess reading and the only one consistent with the rulebook's
"opposing" language throughout.

**Keep vs. change.** Changing this would be a different game (sacrificing your
partner's pieces for tempo). Encoded in one place: the `isEnemy` predicate.

---

## R10 — §3.3 erratum: move-notation examples use the dead coordinate order

**The discovery.** §3.3's examples — `NC32–B30`, `RA1xA8` — write coordinates
file-first ("C32"), the **pre-v3.0 convention**. §2.2/§3.2 define rank-first
(`32D`, `1A`) and the v3.0 revision history says the order was deliberately
swapped. Andrew's chat digest also warns that any earlier-convention example is
invalid. These two examples appear to have survived the revision unconverted.

**V1 assumes rank-first everywhere**, per §2.2 and the Roto-PGN spec: the
knight example reads `N32C-30B`, the rook capture `R1Ax8A`. All notation
examples in the app and docs are engine-generated, never hand-written
(Andrew's own rule from the planning chat).

**Action for Andrew:** update the two §3.3 example tokens in rulebook v3.2.

---

## R11 — May the same piece make both opening submoves?

**The decision.** §4.2 requires one move on each side of your meridian. If a
piece's first submove carries it ACROSS the meridian (kings/queens freely,
haloed pieces, or an evaporation-immune mover), it now stands on the other
side. May it also make the second submove? *Example: your queen sweeps from
2B across the meridian to 32B (submove 1, clockwise side), then continues
30B (submove 2, counterclockwise side — its new origin).*

**V1 assumes: yes.** §4.2 constrains the SIDES of the two moves (judged by
each move's origin square, R8) — it never says two different pieces must
move. App. A.2's development rationale is arguably diluted, which is why
this deserves your eye.

**Keep vs. change.** Changing to "two distinct pieces" is a one-line flip:
`OPENING_MAY_MOVE_SAME_PIECE_TWICE` in `rulings.ts`. Only affects rounds 1–5.

---

## R12 — Kings are never capturable

**The decision.** The rulebook never says what happens if a king could be
"taken," because in two-player chess it can't happen. In Roto it CAN: §7.3
delays mate until the victim's turn, and §7.2 lets the partner ignore it, so a
checked king can legally sit attacked through other players' turns — and a
third player's piece may bear on it.

**V1 assumes: kings are never capture targets.** They block movement like any
piece but no move may take one; games end by checkmate alone (§1.2). This is
the only reading consistent with §7.3 — a mate that must wait for the victim's
turn cannot be pre-empted by simply grabbing the king.

**Keep vs. change.** The alternative (king capture = instant win) is a
materially different game. Structural guard: `isCapturable` in the engine.

---

## R13 — A bishop may stop anywhere along its curl

**The decision.** §5.4 says the move "ends when the bishop reaches a rail
(with no remaining bounces), is blocked by a friendly piece, or captures."
Read hyper-literally, that's a FORCED slide to one of those endpoints. Read as
standard chess (§1.3), sliders may stop voluntarily on any square along the
way — and the bounce is likewise optional (the bishop may stop on the rail
square instead of reflecting).

**V1 assumes the standard-chess reading: voluntary stops anywhere along the
chain, bounce optional.** The §5.4 sentence describes where the path CANNOT
continue, not a movement mandate.

**Keep vs. change.** Forced maximal slides would be a drastically different
(and strange) game; we're confident here, but it's an interpretation and you
should ratify it. Code: the generators emit every intermediate square.

---

## R14 — The Avenger exemption applies automatically (not declinable)

**The decision.** §6.4 says an eligible piece "may cross… penalty-free." Does
"may" make the exemption OPTIONAL — could a player deliberately evaporate an
eligible piece (to vacate a square, or to avoid stalemate)?

**V1 assumes the exemption auto-applies:** an eligible avenger crossing its
meridian never evaporates. "May" reads as permission to cross, not a choice of
penalty. This slightly changes the legal-move set in exotic corners.

**Keep vs. change.** Making it declinable would generate a second, evaporating
variant of each eligible crossing (a confirm-bar choice in the UI). One
generator change if ever wanted.

---

## R15 — Fifty-move details (§8.6)

**The decision(s).** Two small counter questions: (1) does a double-move
opening turn increment the fifty-move counter by 1 or 2? (2) does an
EVAPORATION (material loss without capture) reset it?

**V1 assumes:** (1) an opening turn counts as ONE move — §8.6 says a move "means
one player's turn"; (2) evaporation does NOT reset the counter — §8.6 names
only pawn moves and captures, read literally. (Practical impact of both is
nearly nil: the clock can't approach 50 during the opening, and evaporations
are usually near captures anyway.)

---

## R16 — Two en passant consequences of the circle (documented behaviors)

**The decisions.** Four-player circular geometry creates two EP situations
standard chess can't produce; V1 encodes the natural reading of each:

1. **A trailing same-direction enemy pawn may EP-capture.** On a ring, enemy
   pawns can travel the SAME rotational direction as yours. If an enemy pawn
   double-steps past your pawn's diagonal, the §8.1 test ("could have captured
   it had it advanced only one") is met regardless of which direction the
   victim was traveling. V1 allows it.
2. **EP dies if the landing square is occupied.** If the passed-over square is
   occupied by the time of the capture attempt (possible mid-opening when the
   double-stepper's own second submove lands there), no EP move exists — a
   normal capture of the occupant is offered instead where legal.

**Keep vs. change.** Both follow from applying §8.1 mechanically; flagged so
nothing about EP is silent.

---

## P1 — Policy: abandonment (community feel, not rules)

**The decision.** What happens when a player goes silent? The rulebook is
(rightly) silent; this is a table-culture question.

**V1 ships the humane ladder:** nothing automatic for 3 days (human "nudge"
available, once per 24h); day 7, the system sends the absent player one
reminder; day 14, the game becomes *closeable* — if the other three agree, it
ends, recorded as a team resignation **only if the absent player's partner is
among those agreeing**; if the partner objects, the game goes dormant (hidden,
resumable, no result). A vacation flag pauses the ladder. **The system never
awards a result on its own; humans close games, the system only unlocks the
door.**

---

## P2 — Policy: resignation is a team act

**The decision.** §7.4 says "a team may resign." One tap or two?

**V1 ships two-step:** either partner proposes; the other confirms on their own
schedule; the game continues meanwhile; the proposal expires when the proposer's
next turn arrives. A solo player can never end the team's game — that protects
the partnership, which is the product's core asset.

---

*Discovered during the build, any new ambiguity gets appended here in the same
format before the code encodes a default.*
