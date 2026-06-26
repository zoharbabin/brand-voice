# brand-voice

**Brand writing enforcement for Claude Code — automatic, configurable, zero-friction.**

[![npm version](https://img.shields.io/npm/v/brand-voice.svg)](https://www.npmjs.com/package/brand-voice)
[![npm downloads](https://img.shields.io/npm/dm/brand-voice.svg)](https://www.npmjs.com/package/brand-voice)
[![CI](https://github.com/zoharbabin/brand-voice/actions/workflows/ci.yml/badge.svg)](https://github.com/zoharbabin/brand-voice/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

Every time Claude writes or edits a Markdown file, `brand-voice` checks it against your brand guidelines and signals Claude to fix violations **before** the file saves. No manual review. No rule reminders in every prompt.

![brand-voice demo](docs/demo.svg)

Claude reads the violation list, corrects the file, and retries the write — automatically.

---

## Why brand-voice?

Your brand guidelines live in a doc somewhere. Claude doesn't read them unless you paste them into every prompt. Even then, the rules drift over time.

`brand-voice` makes the rules structural:

- **Works for any company** — configure your own vocabulary, voice, and visual identity
- **Auto-corrects, doesn't just report** — the PostToolUse hook blocks bad writes and triggers a retry
- **Covers the full stack** — hook for Claude Code, MCP server for on-demand checks, CLI for CI pipelines
- **Smart about code** — ignores fenced blocks, indented code, inline code spans, and table cells
- **Escape hatches** — `.brand-voice-ignore` for whole files, `<!-- brand-voice-disable-line -->` for individual lines
- **Visual identity included** — colors, fonts, logo URLs live in the same guidelines file

---

## Install

```sh
npm install -g brand-voice
```

Or run without installing:

```sh
npx brand-voice@latest check
```

**Requires Node.js 18+.**

---

## Quick Start

### Option A — Guided setup in Claude Code (recommended)

Run the setup skill inside any Claude Code session:

```
/brand-voice-setup
```

The skill does everything:
1. Asks whether you have existing brand docs or want to answer four questions
2. Optionally researches your brand automatically via web
3. Writes `brand-guidelines.md` to your project
4. Injects a summary block into `CLAUDE.md`
5. Registers the PostToolUse hook in `.claude/settings.json`
6. Registers the MCP server in `.mcp.json`

After setup, every `.md` and `.mdx` file Claude touches is checked automatically.

### Option B — Manual setup

```sh
# 1. Install
npm install -g brand-voice

# 2. Create brand-guidelines.md in your project root (see schema below)

# 3. Register the hook
brand-voice setup
```

---

## How It Works

Three components work together:

| Component | What it does |
|---|---|
| **PostToolUse hook** (`brand-voice-check`) | Runs after every Write/Edit/MultiEdit on `.md`/`.mdx`; exits `2` with violations so Claude auto-corrects, exits `0` when clean |
| **MCP server** (`brand-voice-mcp`) | Exposes `analyze_readability` and `apply_suggestions` for on-demand analysis and word-level fixes |
| **CLI** (`brand-voice`) | Standalone checker for CI pipelines, ratchet baselines, and GitHub PR annotations |

### What gets checked

| Rule | Severity | Description |
|---|---|---|
| **Forbidden terms** | error | Whole-word, case-insensitive match — blocks the write |
| **Avoid terms** | warning | Same matching — signals a preferred alternative |
| **Sentence length** | warning | Configurable max words per sentence (default: 25) |
| **Passive voice** | warning | Auxiliary + past-participle pattern detection |
| **Readability grade** | warning | Flesch-Kincaid grade per sentence vs. your target |

Code blocks, inline code, indented blocks, and table rows are **never checked** — only prose.

### PostToolUse hook exit codes

| Code | Meaning |
|---|---|
| `0` | No violations — file accepted |
| `2` | Violations found — Claude reads output, corrects, and retries |

Exit `1` is never used (it aborts the session rather than triggering a retry).

---

## brand-guidelines.md

One Markdown file holds your entire brand configuration. Keep it **under 600 words** so it fits cleanly in context.

```markdown
# Brand Guidelines

## Persona
Who you are and who you write for.

## Tone & Voice
- Direct, honest, clear
- Person: second          ← "first" | "second" | "third"
- Voice: active           ← "active" | "passive"
- Sentences: max 25 words
- Contractions: yes       ← "yes" | "no"
- Exclamation marks: no

## Vocabulary
**Always use:** Acme, Acme Platform, APIs
**Avoid:** leverage, utilize, synergy, seamless
**Forbidden:** [competitor names, unverified claims]

## On-Tone Examples
> Connect your data in minutes — Acme handles the routing.

## Off-Tone Examples
> Leverage our cutting-edge platform to seamlessly integrate.

## Visual Identity
- Primary color: #006EFA
- Secondary color: #0050C3
- Accent color: #FF9DFF
- Background color: #FFFFFF
- Text color: #282828
- Logo (light): https://cdn.example.com/logo-light.svg
- Logo (dark):  https://cdn.example.com/logo-dark.svg
- Heading font: Inter
- Body font: Source Sans Pro

## Formatting Rules
- Heading style: sentence case
- Oxford comma: yes
- Readability target: 8th grade

## Quick Reference
Repeat your top 5 rules here. This section appears last —
where LLM attention is highest — to reinforce critical rules
against context-window attention drop-off.
```

See [`example/brand-guidelines.md`](example/brand-guidelines.md) for a complete working example.

### Section aliases

`## On-Brand Examples` and `## Off-Brand Examples` are accepted as aliases for `## On-Tone Examples` / `## Off-Tone Examples`. All other section names are case-insensitive exact matches.

### Search path

The hook and CLI search for `brand-guidelines.md` in this order:

1. Current working directory
2. `~/.claude/brand-guidelines.md` (user scope — enforces rules across all your projects)
3. Parent directories up to the git root

---

## Suppressing Violations

### Skip files or directories — `.brand-voice-ignore`

Create a `.brand-voice-ignore` file in your project root. Uses gitignore-style patterns:

```
# Auto-generated content
dist/
CHANGELOG.md

# Agent prompt files — intentional brand vocabulary exceptions
data/prompts/**

# Vendor docs
vendor/
```

### Skip a single line — inline comment

```markdown
<!-- brand-voice-disable-line -->
```

Add this comment anywhere on a line to suppress all violations on that line. Useful for one-off exceptions where the violation is intentional.

---

## MCP Server

### `analyze_readability`

Check a file or inline text for violations and readability scores.

**Inputs:**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | string | one of `file`/`text` | Absolute or relative path to a `.md`/`.mdx` file |
| `text` | string | one of `file`/`text` | Inline Markdown to analyze |
| `cwd` | string | no | Working directory for locating `brand-guidelines.md` |

**Returns:** `{ filePath, passed, violations[], readabilityScores, visualIdentity }`

### `apply_suggestions`

Apply safe word-level substitutions for forbidden/avoid terms. Does not fix sentence length, passive voice, or grade — those need human judgment.

**Inputs:**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | string | yes | Path to the file to fix |
| `dryRun` | boolean | no | Preview diff without writing (default: `false`) |

**Returns:** diff + change list (dry run) or confirmation + change list (live)

**Tip:** Run `dryRun: true` first to preview, then apply.

---

## CI Integration

`brand-voice` works independently of Claude Code — add it to any pipeline.

**Check all `.md` files:**

```sh
npx brand-voice@latest check
```

**Check only files changed in the current branch:**

```sh
npx brand-voice@latest check --changed-only
```

**GitHub Actions inline annotations (PR diff comments):**

```sh
npx brand-voice@latest check --reporter github-pr-review
```

**Ratchet enforcement** — block regressions without requiring a clean slate:

```sh
# Run once, commit the file
npx brand-voice@latest baseline --save

# In CI: fail only if violations increase above baseline
npx brand-voice@latest check --baseline .brand-voice-baseline.json
```

**Example GitHub Actions workflow:**

```yaml
name: Brand Voice
on:
  pull_request:
    paths: ['**.md', '**.mdx']

jobs:
  prose:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - run: npx brand-voice@latest check --changed-only --reporter github-pr-review
```

Exit `0` = clean or within baseline. Exit `1` = errors found or baseline exceeded.

---

## CLI Reference

```
brand-voice <command> [options]

Commands:
  check [file]          Check a file or all .md files in cwd
  setup                 Print instructions to run /brand-voice-setup in Claude Code
  import <file>         Normalize a brand-guidelines.md into cwd
  baseline --save       Save current violation count as ratchet baseline
  vale-sync             Check that the Vale binary is available

Check options:
  --changed-only        Only check files changed in git (requires git)
  --baseline <file>     Compare against a baseline JSON file (ratchet check)
  --reporter github-pr-review  Emit GitHub Actions annotation format
```

---

## Programmatic API

```ts
import { parseGuidelines, analyzeText, loadGuidelines } from 'brand-voice';

const guidelines = loadGuidelines(process.cwd());
if (guidelines) {
  const result = analyzeText(markdownString, 'doc.md', guidelines);
  console.log(result.violations);        // Violation[]
  console.log(result.readabilityScores); // ReadabilityScores
  console.log(result.passed);            // false if any error-severity violations
}
```

See [src/types.ts](src/types.ts) for full type definitions.

---

## Distribution Patterns

| Scenario | What to do |
|---|---|
| **Solo developer** | Run `/brand-voice-setup` once per project; commit `brand-guidelines.md` |
| **Team** | Commit `brand-guidelines.md`, `.claude/settings.json`, and `.mcp.json`; teammates get enforcement on `git pull` |
| **Global (all projects)** | Run `/brand-voice-setup` with the global flag; writes to `~/.claude/brand-guidelines.md` |
| **claude.ai (browser)** | Setup skill outputs a paste block for Claude Project instructions — no hook or MCP needed |
| **Enterprise / CI** | Use `brand-voice check` in pipelines; commit `.brand-voice-baseline.json` for ratchet enforcement |

---

## Requirements

- **Node.js 18+**
- **`brand-guidelines.md`** — created by `/brand-voice-setup` or written manually
- **Vale** — optional; only required for `vale-sync`

---

## Contributing

Bug reports, feature requests, and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, key invariants to preserve, and code style guidance.

---

## License

MIT — see [LICENSE](LICENSE).
