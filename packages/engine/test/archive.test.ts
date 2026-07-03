/**
 * The Historical Game Archive harness (TDD §10.3, §12.2).
 *
 * Every .rpgn file under archive/corpus/ (recursively) is parsed and
 * replayed through the game layer. A failing game produces a STRUCTURED
 * report distinguishing:
 *   - parse errors            (malformed/ambiguous tokens or headers)
 *   - illegal-move rejections (with turn number, the rejected token, and the
 *                              canonical legal alternatives at that position)
 *   - result mismatches       (headers contradicted by the replay)
 *
 * The corpus is a permanent regression suite: every future engine change
 * must still pass all archived games. When the corpus directory is empty
 * (the historical games have not been translated yet) the harness passes
 * with a note rather than failing. See archive/README.md for the corpus
 * contract and the failure-triage protocol.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateGameText, type GameIssue } from "../src/index.js";

const corpusDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../archive/corpus",
);

function discoverGames(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".rpgn"))
    .map((name) => join(dir, name))
    .sort();
}

const MAX_ALTERNATIVES_SHOWN = 40;

function formatIssue(issue: GameIssue): string {
  const where = [
    issue.ply !== undefined ? `turn ${issue.ply}` : null,
    issue.round !== undefined ? `round ${issue.round}` : null,
    issue.seat !== undefined ? `P${issue.seat} to move` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const lines = [
    `  [${issue.kind}]${where ? ` at ${where}` : ""}`,
    issue.token !== undefined ? `    rejected token: "${issue.token}"` : null,
    `    ${issue.message}`,
  ].filter((l): l is string => l !== null);
  if (issue.legalAlternatives && issue.legalAlternatives.length > 0) {
    const shown = issue.legalAlternatives.slice(0, MAX_ALTERNATIVES_SHOWN);
    const more = issue.legalAlternatives.length - shown.length;
    lines.push(
      `    legal alternatives here (${issue.legalAlternatives.length}): ` +
        shown.join(" ") +
        (more > 0 ? ` … +${more} more` : ""),
    );
  }
  return lines.join("\n");
}

describe("historical game archive", () => {
  const files = discoverGames(corpusDir);

  if (files.length === 0) {
    it("corpus is empty — nothing to validate yet", () => {
      // Not a failure: the historical games arrive later (see
      // archive/README.md). Drop translated .rpgn files under
      // archive/corpus/ and this suite picks them up automatically.
      expect(files).toEqual([]);
    });
    return;
  }

  for (const file of files) {
    const name = relative(corpusDir, file).replace(/\\/gu, "/");
    it(`replays ${name}`, () => {
      const { issues, turns } = validateGameText(readFileSync(file, "utf8"));
      if (issues.length > 0) {
        throw new Error(
          `${name}: replay failed after ${turns.length} good turn(s).\n` +
            `Triage per TDD §12.2: translation error, or a genuine rules ` +
            `question for the design group? (see archive/README.md)\n` +
            issues.map(formatIssue).join("\n"),
        );
      }
      expect(issues).toEqual([]);
      expect(turns.length).toBeGreaterThan(0);
    });
  }
});
