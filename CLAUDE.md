# brand-voice — Agent Instructions

## Project overview

**brand-voice** is a Node.js/TypeScript package that enforces brand writing guidelines in Claude Code. It ships three entry points:

| Binary | Source | Role |
|---|---|---|
| `brand-voice` | `src/cli.ts` | CLI for CI pipelines and ratchet baseline |
| `brand-voice-check` | `src/check.ts` | PostToolUse hook — exits 2 on violations, 0 when clean |
| `brand-voice-mcp` | `src/mcp.ts` | MCP server — `analyze_readability` and `apply_suggestions` tools |

Public programmatic API is exported from `src/index.ts`. All types live in `src/types.ts`.

## Required commands before every commit

```sh
npm run build        # tsc — must produce zero errors
npm run typecheck    # tsc --noEmit — strict mode
npm test             # Jest — all 23 tests must pass
```

No shortcut exists that runs all three; run them in order. The CI workflow runs build + typecheck + test on Node 18, 20, and 22.

## Repository structure

```
src/
  check.ts                  PostToolUse hook entry point
  cli.ts                    CLI entry point (brand-voice command)
  mcp.ts                    MCP server entry point
  index.ts                  Public API exports
  types.ts                  All shared TypeScript interfaces
  core/
    analyzer.ts             Violation detection and readability scoring
    load-guidelines.ts      brand-guidelines.md search-path resolution
    parse-guidelines.ts     Markdown → BrandGuidelines parser
    analyzer.test.ts        Jest tests for analyzer
    parse-guidelines.test.ts  Jest tests for parser (23 tests total)
  setup/
    generate-claude-md.ts   CLAUDE.md injection generator
    generate-vale-ini.ts    .vale.ini + BrandVoice Vale style generator
    register-hook.ts        PostToolUse hook installer/uninstaller
    register-mcp.ts         .mcp.json installer/uninstaller
example/
  brand-guidelines.md       Working example — uses On-Brand Examples heading alias
skills/
  brand-voice-setup.md      /brand-voice-setup skill for guided onboarding
.github/workflows/
  ci.yml                    CI: build + typecheck + test on Node 18/20/22
  publish.yml               Publish to npm on GitHub Release (requires NPM_TOKEN secret)
```

## Key invariants

### PostToolUse hook exit codes
- Exit **0** — no violations, file accepted
- Exit **2** — violations found; Claude reads stdout and retries
- **Never exit 1** — that terminates the Claude Code session, not a retry

### brand-guidelines.md search path (load-guidelines.ts)
1. `<startDir>/brand-guidelines.md`
2. `~/.claude/brand-guidelines.md`
3. Walk parent dirs up to git root

### Parser section aliases
`## On-Brand Examples` and `## Off-Brand Examples` are accepted as aliases for `## On-Tone Examples` / `## Off-Tone Examples`. All other section names are case-insensitive exact matches.

### MCP tool conventions
Both tools follow MCP spec: `title`, `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`), and `outputSchema` are declared. Tool errors use `isError: true` in `CallToolResult` — never throw protocol-level errors. `apply_suggestions` loads guidelines from `dirname(absPath)`, not the file path itself.

### TypeScript / ESM
- Module system: `NodeNext` — all relative imports need `.js` extensions
- `type: 'object' as const` required in inputSchema/outputSchema literals to prevent TypeScript widening
- `isolatedModules: true` in tsconfig

## Code standards

- New source files: `// @ts-check` comment is not needed — tsconfig `strict: true` covers everything
- No comments that describe what the code does — only why (non-obvious invariants, workarounds)
- No `T.must`, no `as any` — use explicit nil checks or APIs that return non-nil
- Keep each violation check in `analyzer.ts` self-contained; do not couple checks to each other
- `parse-guidelines.ts` uses line-by-line regex only — no Markdown AST dependency; keep it that way

## Testing

```sh
npm test                          # run all tests
npm test -- --testPathPattern=analyzer  # run one file
```

Jest uses `ts-jest` with ESM. The `moduleNameMapper` strips `.js` extensions for module resolution. Do not add `isolatedModules` to the ts-jest transform options — it conflicts with type-import stripping.

When adding or tightening tests, verify with a red/green cycle using `--testPathPattern=<file>`.

## Publishing

Version is managed manually in `package.json`. To publish:
1. Bump `version` in `package.json`
2. Commit and push
3. Create a GitHub Release with tag `v<version>` — the publish workflow triggers, verifies the tag matches `package.json`, then runs `npm publish --provenance`

Requires `NPM_TOKEN` secret set in the GitHub repo.

## What NOT to change without a clear reason

- The `BUILTIN_REPLACEMENTS` map in `mcp.ts` — changes affect `apply_suggestions` behavior for all users
- The `.gitignore` entries for `brand-voice-design-brief.md` and `readability-oss-reference.md` — these are private local files intentionally excluded from the repo
- The `## Quick Reference` section requirement in the brand-guidelines schema — it exists to reinforce rules at the end of the file where LLM attention is highest
