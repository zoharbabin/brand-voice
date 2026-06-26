# Contributing to brand-voice

Thanks for taking the time to contribute.

## Ways to contribute

- **Bug reports** — open a [bug report issue](.github/ISSUE_TEMPLATE/bug_report.md)
- **Feature requests** — open a [feature request issue](.github/ISSUE_TEMPLATE/feature_request.md)
- **Code** — fix a bug, add a rule, improve the parser or CLI
- **Guidelines schema** — improvements to the `brand-guidelines.md` format
- **Documentation** — corrections, examples, or clearer explanations

## Development setup

```sh
git clone https://github.com/zoharbabin/brand-voice.git
cd brand-voice
npm install
npm run build
npm test
```

Required before every commit:

```sh
npm run build      # must produce zero TypeScript errors
npm run typecheck  # strict tsc --noEmit
npm test           # all Jest tests must pass
```

## Project structure

```
src/
  check.ts                 PostToolUse hook entry point
  cli.ts                   CLI entry point
  mcp.ts                   MCP server entry point
  index.ts                 Public API exports
  types.ts                 All shared TypeScript interfaces
  core/
    analyzer.ts            Violation detection and readability scoring
    analyzer.test.ts       Jest tests for analyzer
    ignore.ts              .brand-voice-ignore pattern matching
    load-guidelines.ts     brand-guidelines.md search-path resolution
    parse-guidelines.ts    Markdown → BrandGuidelines parser
    parse-guidelines.test.ts
  setup/
    generate-claude-md.ts  CLAUDE.md injection generator
    generate-vale-ini.ts   .vale.ini + Vale style generator
    register-hook.ts       PostToolUse hook installer/uninstaller
    register-mcp.ts        .mcp.json installer/uninstaller
example/
  brand-guidelines.md      Complete working example
skills/
  brand-voice-setup.md     /brand-voice-setup skill for guided onboarding
```

## Key invariants to preserve

- **Hook exit codes**: exit `0` (clean) or `2` (violations — retry). Never exit `1` — that aborts the Claude Code session.
- **Code block suppression**: `extractProse()` in `analyzer.ts` must never check fenced code, indented code, table rows, or inline code spans.
- **Disable-line comment**: `<!-- brand-voice-disable-line -->` must suppress all violations on that line.
- **Guidelines search path**: current directory → `~/.claude/brand-guidelines.md` → parent dirs to git root. Don't change this order.
- **Parser**: `parse-guidelines.ts` uses line-by-line regex only — no Markdown AST. Keep it that way.

## Adding a new violation rule

1. Add detection logic in `src/core/analyzer.ts` — keep it self-contained, don't couple it to other checks
2. Add the new rule key to `Violation['rule']` in `src/types.ts`
3. Write tests in `src/core/analyzer.test.ts` — verify red/green with `npm test -- --testPathPattern=analyzer`
4. Document the rule in the README under "What gets checked"

## Adding a new `brand-guidelines.md` section

1. Add the field to the relevant interface in `src/types.ts`
2. Add the parser case in `src/core/parse-guidelines.ts`
3. Write tests in `src/core/parse-guidelines.test.ts`
4. Update the schema block in `README.md`

## Tests

```sh
npm test                                    # run all tests
npm test -- --testPathPattern=analyzer      # one file
npm test -- --testPathPattern=analyzer:42   # one test by line
```

Jest uses `ts-jest` with ESM. The `moduleNameMapper` strips `.js` extensions for resolution. Don't add `isolatedModules` to the ts-jest transform — it conflicts with type-import stripping.

## Pull requests

- Keep diffs minimal — don't refactor code outside the scope of your change
- One logical change per PR
- Include a clear description of what the change does and why
- All three checks (`build`, `typecheck`, `test`) must pass

## Code style

- No comments that describe what code does — only why (non-obvious invariants, workarounds)
- All relative imports need `.js` extensions (NodeNext module resolution)
- `type: 'object' as const` required in MCP inputSchema/outputSchema literals
- No `as any`; use explicit nil checks or APIs that return non-nil

## Reporting security issues

Please do **not** open a public issue for security vulnerabilities. Email the maintainer directly (see the GitHub profile) or use [GitHub's private vulnerability reporting](https://github.com/zoharbabin/brand-voice/security/advisories/new).
