# brand-voice

Enforce brand writing guidelines in Claude Code.

A PostToolUse hook checks every Markdown file Claude writes or edits against your brand guidelines and signals Claude to correct violations before saving. Visual identity — colors, fonts, logo URLs — lives in the same guidelines file so Claude can reference them when generating any brand-compliant asset. Includes an MCP server for on-demand analysis and a `/brand-voice-setup` skill for guided onboarding.

## Install

```sh
npm install -g brand-voice
```

Or use without installing:

```sh
npx brand-voice@latest check
```

Requires Node.js 18+.

## Quick Start

**Step 1 — Run the setup skill in Claude Code**

```
/brand-voice-setup
```

The skill either reads an existing brand guidelines file you provide or asks four questions to create one. It writes `brand-guidelines.md`, injects a summary into `CLAUDE.md`, and registers the hook and MCP server in `.claude/settings.json` and `.mcp.json`.

**Step 2 — Write Markdown as normal**

Every time Claude uses Write, Edit, or MultiEdit on a `.md` or `.mdx` file, the PostToolUse hook runs `brand-voice-check` against the result. If violations are found, the hook exits with code 2 and outputs the violation list — Claude reads this feedback, corrects the violations, and retries the write automatically.

**Step 3 — Iterate on your guidelines**

Edit `brand-guidelines.md` whenever your rules change. No reinstall needed — the hook reads the file on every invocation.

## How It Works

| Component | What it does |
|---|---|
| **`/brand-voice-setup` skill** | Guided setup: reads or interviews for brand rules, writes `brand-guidelines.md`, injects a summary into CLAUDE.md, registers the hook and MCP server |
| **PostToolUse hook** (`brand-voice-check`) | Runs after every Write/Edit/MultiEdit on `.md`/`.mdx` files; exits 2 with a violation report to trigger automatic correction, exits 0 when clean |
| **MCP server** (`brand-voice-mcp`) | Exposes `analyze_readability` and `apply_suggestions` for on-demand checking and automated term fixes |
| **CLI** (`brand-voice`) | Standalone checker for CI pipelines, ratchet baseline enforcement, and git-diff-aware checks |

### Violation types checked

- **Forbidden terms** — whole-word, case-insensitive match; severity: error
- **Avoid terms** — same matching; severity: warning
- **Sentence length** — configurable max words per sentence (default: 25)
- **Passive voice** — auxiliary + past-participle pattern detection
- **Readability grade** — Flesch-Kincaid grade per sentence checked against your target

Readability scores (Flesch Reading Ease, Flesch-Kincaid grade, sentence/word counts) are returned by `analyze_readability`.

### PostToolUse hook exit codes

| Code | Meaning |
|---|---|
| `0` | No violations — file accepted |
| `2` | Violations found — Claude retries and corrects |

Exit 1 is never used by the hook (it would abort the session rather than signal a retry).

### Example hook output

```
Brand Voice violations in docs/quickstart.md:
  Line 12: Forbidden term: "simply"
  Line 23: Avoid term: "utilize"
  Line 31: Sentence too long: 34 words (max 25). Sentence: "Our platform..."
  Line 45: Possible passive voice: "is configured"
Fix these violations, then the file will be saved.
```

## Brand Guidelines File

`brand-guidelines.md` is a plain Markdown file in your project root (or `~/.claude/` for user-scope). Keep it **under 600 words / ~750 tokens** so it fits cleanly in CLAUDE.md context.

### Schema

```markdown
# Brand Guidelines

## Persona
Who you are and who you write for.

## Tone & Voice
- Direct, honest, clear
- Person: second        ← "first" | "second" | "third"
- Voice: active         ← "active" | "passive"
- Sentences: max 25 words
- Contractions: yes     ← "yes" | "no"
- Exclamation marks: no

## Vocabulary
**Always use:** Acme, Acme Platform, APIs
**Avoid:** leverage, utilize, synergy, seamless
**Forbidden:** [competitor names, unverified performance claims]

## On-Tone Examples
> Connect your data in minutes — Acme handles the routing, you handle the insights.

## Off-Tone Examples
> Leverage our cutting-edge platform to seamlessly integrate your workflows.

## Visual Identity
- Primary color: #006EFA
- Secondary color: #0050C3
- Accent color: #FF9DFF
- Background color: #FFFFFF
- Text color: #282828
- Logo (light): https://cdn.example.com/logo-light.svg
- Logo (dark): https://cdn.example.com/logo-dark.svg
- Icon / mark: https://cdn.example.com/icon.svg
- Heading font: Inter
- Body font: Source Sans Pro

## Formatting Rules
- Heading style: sentence case
- Oxford comma: yes
- Readability target: 8th grade

## Quick Reference
Repeat your top 5 rules here. This section appears at the end of the
file where LLM attention is highest — restating key rules here counters
"Lost in the Middle" degradation in long context windows.
```

The `## Quick Reference` section is required. It restates the most critical rules at the end of the file, where attention is strongest, to reinforce them against context-window attention drop-off.

See [`example/brand-guidelines.md`](example/brand-guidelines.md) for a complete working example.

### Guidelines search path

The hook and CLI search for `brand-guidelines.md` in this order:

1. Current working directory
2. `~/.claude/brand-guidelines.md` (user scope)
3. Parent directories up to the git root

### Importing from an existing document

If you have a `brand-guidelines.md` that already follows the schema above, `brand-voice import` re-parses and normalizes it into the current directory:

```sh
brand-voice import /path/to/brand-guidelines.md
```

For a document with different section headings or prose narrative, use `/brand-voice-setup` instead — the skill uses Claude to translate any format into the schema.

## MCP Server

The `brand-voice-mcp` server exposes two tools:

### `analyze_readability`

Check a file or inline text for violations and get readability scores.

**Inputs:**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | string | one of | Absolute or cwd-relative path to a `.md`/`.mdx` file |
| `text` | string | one of | Inline Markdown text to analyze |
| `cwd` | string | no | Working directory for locating `brand-guidelines.md` |

**Returns:** `{ filePath, passed, violations[], readabilityScores, visualIdentity }`

### `apply_suggestions`

Apply safe word-level substitutions to fix common violations (forbidden/avoid terms). Does not fix sentence length, passive voice, or readability — those require manual editing.

**Inputs:**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | string | yes | Path to the file to fix |
| `dryRun` | boolean | no | Return a diff without writing (default: false) |

**Returns:** `{ changes[], diff? }` (dryRun) or `{ filePath, changes[], message }` (live)

**Tip:** Call `apply_suggestions` with `dryRun: true` first to preview changes, then again without `dryRun` to apply them.

## Distribution

| Scenario | How |
|---|---|
| **Solo developer** | Run `/brand-voice-setup` once per project; commit `brand-guidelines.md` |
| **Team** | Commit `brand-guidelines.md`, `.claude/settings.json` (hook), and `.mcp.json` (MCP server); teammates get enforcement automatically on `git pull` |
| **claude.ai (browser)** | The setup skill outputs a paste block for Claude Project instructions — no hook or MCP server required |
| **Enterprise / CI** | Use `brand-voice check` in pipelines; commit `.brand-voice-baseline.json` for ratchet enforcement |

## CI Integration

`brand-voice` includes a standalone CLI for pipelines, independent of Claude Code.

**Check all `.md` files:**

```sh
npx brand-voice check
```

**Check only files changed in the current branch:**

```sh
npx brand-voice check --changed-only
```

**GitHub Actions annotations** (inline PR diff comments):

```sh
npx brand-voice check --reporter github-pr-review
```

**Ratchet enforcement** — prevent regressions without requiring a clean slate:

```sh
# Save current violation count as baseline (run once, commit the file)
npx brand-voice baseline --save

# In CI: fail only if violations increase above baseline
npx brand-voice check --baseline .brand-voice-baseline.json
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

Exit code 0 = clean or within baseline. Exit code 1 = errors found or baseline exceeded.

## CLI Reference

```
brand-voice <command> [options]

Commands:
  check [file]              Check a file or all .md files in cwd
  setup                     Print instructions to run /brand-voice-setup
  import <file>             Normalize a brand-guidelines.md into cwd
  baseline --save           Save current violation count as ratchet baseline
  vale-sync                 Check that the Vale binary is available

Check options:
  --changed-only            Only check files changed in git (requires git)
  --baseline <file>         Compare against a baseline JSON file (ratchet check)
  --reporter github-pr-review  Emit GitHub Actions annotation format
```

## Programmatic API

```ts
import { parseGuidelines, analyzeText, loadGuidelines } from 'brand-voice';

const guidelines = loadGuidelines(process.cwd());
if (guidelines) {
  const result = analyzeText(markdownString, 'doc.md', guidelines);
  console.log(result.violations);       // Violation[]
  console.log(result.readabilityScores);
}
```

See [src/types.ts](src/types.ts) for the full type definitions.

## Stack

All packages MIT licensed.

| Package | Role |
|---|---|
| `flesch` + `flesch-kincaid` | Flesch Reading Ease and Flesch-Kincaid grade scoring |
| `@modelcontextprotocol/sdk` | MCP server stdio transport |

## Contributing

1. Fork the repository and create a branch.
2. `npm install && npm run build`
3. `npm test` — runs the Jest suite under `src/`
4. `npm run typecheck` — strict TypeScript via `tsc --noEmit`
5. Open a pull request with a clear description of the change.

Bug reports and guideline schema improvements are welcome via GitHub Issues.

## License

MIT — see [LICENSE](LICENSE).
