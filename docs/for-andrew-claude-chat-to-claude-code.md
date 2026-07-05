# From Claude Chat to Claude Code — How Roto Chess Got Built

*A short guide for Andrew. No coding background needed.*

---

## The one-sentence version

**Claude Chat is a brilliant thinking partner. Claude Code is the same intelligence, but with hands** — it lives on a computer, reads and writes the real project files, runs the game, tests it, fixes it, and publishes it online.

Chat gives you *words and ideas*. Code gives you a *working product people can play*.

---

## 1. Where we started: your documents

Roto Chess began the way most good things do — as an idea, worked out in conversation. You developed the rules and wrote them down, including a technical design document (the "TDD") describing things like how moves are written down and how finished games get saved.

Those documents became the **source of truth**. In Claude Code we keep them in the project and have Claude *read them before building*, so the software matches your vision instead of drifting away from it.

> **Why this matters:** The clearer your written description, the better the result. A good document is leverage — Claude can turn a clear paragraph into a correct feature, but it can only guess at a vague one.

---

## 2. What Claude Code plugs into (the tools)

You don't operate these yourself, but it helps to know what's happening behind the scenes:

| Tool | In plain terms |
|------|----------------|
| **Git & GitHub** | A save-history for all the code. Every change is a labeled snapshot you can undo or review. Nothing is ever really lost. |
| **Vercel** | The hosting service. Every time we "save" the code to GitHub, Vercel automatically publishes the new version to the web. That's why you can just open a link and play. |
| **Supabase** | The accounts + database + live multiplayer. It stores logins, saved games, and lets four players see the board update in real time. |
| **Playwright** | A "robot browser." Claude uses it to actually click through the game and *see* that a feature works — not just assume it does. |
| **Automated tests** | Small checks that prove the rules engine is correct (e.g. "a checkmate is detected at the right moment"). They run in seconds and catch mistakes early. |

---

## 3. How we talk to it (the prompting approach)

This is the part that matters most for you, because **this is your job now: describe, decide, review.** A few habits make it work well:

**Plan before building.** For anything non-trivial, Claude writes out a plan first, you approve it, *then* it builds. This catches wrong assumptions before any work is wasted.

**Brainstorm → design → approve → build.** For new features there's a deliberate "design gate": Claude proposes options, you pick, and only then does it write code.
> *Real example — the victory screen:* we talked through the feel ("playful but clear"), Claude offered choices, you said "Looks awesome," and only then was it built.

**You can just say "fix it."** For bugs, point at the problem in plain language and let Claude diagnose and repair it on its own. You don't have to explain *how*.
> *Real example:* you said the scoreboard line "doesn't make sense and looks ugly." That was enough — Claude found it, redesigned it, and re-checked it in a browser.

**"Done" has to be proven.** Claude doesn't claim success without evidence — passing tests, a screenshot, a clean build. If something failed, it says so plainly.

**Good prompts vs. vague ones:**
- 🟢 *"When a checkmate happens, show a clear victory moment with who won, the mating piece, and the turn count."* → specific, buildable.
- 🔴 *"Make the ending better."* → Claude has to guess what "better" means.

You don't need technical words. You need **clear intent, a decision when asked, and honest feedback.**

---

## 4. Skills — Claude's built-in playbooks

A **skill** is a reusable set of expert instructions Claude can pull off the shelf. You rarely manage these yourself; Claude reaches for the right one. Two you'll see in action:

- **Brainstorming** — turns a rough idea into an approved design before any building starts.
- **Systematic debugging** — hunts down the *root cause* of a bug instead of slapping on a quick patch.

Knowing these exist explains why Claude sometimes says *"let me design this first"* rather than diving straight in. That pause is a feature, not a delay.

---

## 5. How it stays consistent across sessions (the memory)

A Chat conversation forgets everything when you close the tab. Claude Code keeps a set of standing documents so the project has continuity even across dozens of sessions:

- **`CLAUDE.md`** — a coaching manual Claude reads every session: *"plan first, keep it simple, verify before calling it done."* Your working preferences, written once, applied always.
- **Memory notes** — short records of key decisions (which technology we use, how the site deploys, your rulings on the rules) so nothing has to be re-explained.
- **Specs folder** — every real feature gets a short written design *before* it's built. A paper trail of what and why.
- **Tasks & lessons** — a running to-do list, plus a "mistakes we won't repeat" log that makes Claude better over time.

> **Why this matters:** it's the difference between a helper who starts fresh every morning and a teammate who remembers the whole project.

---

## 6. The life of one feature (start to finish)

Here's exactly how the **checkmate victory moment** went — a good model for how any request flows:

1. **You asked**, in plain language, for a victory moment with "clever context about the game."
2. **Claude brainstormed** the design, offered choices, you approved.
3. **It wrote a short spec** so the plan was on paper.
4. **It built** the logic and the on-screen card, and wrote tests proving the game facts were correct.
5. **It verified** — checked the code, ran the tests, built the site, and took real screenshots in a browser.
6. **You gave feedback** ("that scoreboard is ugly") → it fixed and re-verified.
7. **It saved to GitHub and published** → the new version went live automatically.

That whole loop — idea to deployed feature — is now something you can trigger with a sentence.

---

## 7. The takeaway for you

- You can request features in **normal language** and get **working, deployed software** back.
- Your highest-value inputs are: **clear descriptions, good reference documents, and honest feedback.**
- You don't need to learn to code. You need to **describe what you want, decide when asked, and react to what you see.**

Claude Chat was the drawing board. Claude Code is the workshop — and you're still the one deciding what gets built.

---

## Quick glossary

- **Repo (repository)** — the project's home folder, tracked by Git.
- **Commit** — one saved, labeled snapshot of changes.
- **Push** — sending your saved changes up to GitHub (which triggers the live update).
- **Deploy** — publishing the latest version to the web.
- **Engine** — the part of the code that knows the *rules* of Roto Chess, with no visuals attached.
- **Spec** — a short written design for a feature, agreed before building.
- **Test** — an automated check that proves something works.
