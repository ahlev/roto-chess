# The Roto Chess Game Archive

The design group has preserved roughly a decade of real Roto Chess games,
recorded as chat messages. Per TDD §10.3 this archive is the engine's most
valuable validation asset: if the engine accepts every move of every real
game, that is strong evidence the rules implementation is correct. This
directory is where that corpus lives and where it is wired into the
automated test suite.

## Layout

```
archive/
  README.md            this file
  corpus/              one game per .rpgn file; any subdirectory layout
    synthetic/         engine-generated seeded playouts (committed now, so
                       the harness demonstrably works before the real
                       corpus arrives; regenerate with
                       `npx tsx scripts/generate-archive-corpus.ts`)
    historical/        the translated real games land here (not yet present)
```

`test/archive.test.ts` discovers every `.rpgn` under `corpus/` recursively
and replays each one through the game layer on every test run. An empty (or
missing) corpus passes with a note — the harness never blocks the build
while the historical games are still being translated.

## The corpus contract

- **One game per file**, extension `.rpgn`, UTF-8.
- **Format:** Roto-PGN per TDD §3 — a `[Key "Value"]` header block followed
  by the round-grouped move list. The parser is lenient about surface
  variation (P1:–P4: labels optional, `&` spacing flexible, both square-token
  orders accepted, the engine's legacy header dialect mapped), so a
  translation only needs to get the *moves* right.
- **Canonical move tokens** (`PIECE FROM - / x TO` + suffixes) are strongly
  preferred; suffix marks (`* † ^ + #`, `=Q`, `e.p.`) may be omitted for
  quiet marks the translator can't infer — the replay recomputes effects and
  only requires that what IS written doesn't contradict the rules.
- **Result headers are optional but checked.** If `[Result]`/`[ResultRound]`
  are present and the replay reaches a terminal position that contradicts
  them, the harness flags a `result-mismatch`. A result the replay cannot
  derive (resignation, agreement) is accepted as-is.

## Translating the historical games

The originals are chat messages in a notation/shorthand that predates this
spec (exact form TBD — it arrives with the corpus). The workflow, per TDD
§10.3:

1. Translate each chat-form game into a `.rpgn` file under
   `corpus/historical/` (one file per game; name it something stable, e.g.
   `2019-03-14-thursday-board.rpgn`). Record anything ambiguous about the
   translation in a comment header tag, e.g. `[TranslationNote "..."]` —
   unknown tags are carried through harmlessly.
2. Run `pnpm test` (or `npx vitest run test/archive.test.ts`). Every file is
   replayed from the standard starting position.
3. Fix or triage failures (below). Once a game passes, it is a permanent
   regression fixture: every future engine change must still pass it.

## Failure triage (TDD §12.2)

A failing game means one of three things, and the harness's structured
report is designed to tell them apart:

- **`parse`** — the token or header is malformed or ambiguous. Almost always
  a translation typo. Fix the `.rpgn`.
- **`illegal-move`** — the token is well-formed but the rules reject it at
  that position. The report gives the turn number, the rejected token, and
  the canonical legal alternatives at that position. Two possibilities:
  1. **Translation error** — the wrong square/piece was transcribed, or an
     earlier mistranslated move corrupted the position. Compare the legal
     alternatives against the chat record; usually the intended move is in
     the list. Fix the `.rpgn`.
  2. **A genuine rules question** — the move really was played, the
     translation is faithful, and the engine still rejects it. Do NOT
     "fix" the engine unilaterally and do NOT massage the game file. Write
     up the position (turn number, board state, the played move, the
     engine's reasoning) and **refer it to the design group** — it is either
     an engine bug or a rules ambiguity the rulebook must resolve. The
     rulebook governs; the engine and TDD are corrected to follow it.
- **`result-mismatch`** — the moves replay fine but the recorded result or
  ending round disagrees with the replay. Check the translation's header
  against the chat record; if the record itself is contradictory, that is
  also a design-group question.

Keep unresolved games out of `corpus/` (e.g. in a `quarantine/` sibling
directory that the harness does not scan) so the suite stays green while a
question is with the design group.
