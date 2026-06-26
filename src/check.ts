#!/usr/bin/env node
// PostToolUse hook script. Invoked by Claude Code after Write/Edit/MultiEdit.
// Exit 2 = violations found (Claude retries and fixes). Exit 0 = clean.
// Never exit 1 — that's a hard session failure, not a style violation.

import { readFileSync, existsSync } from 'fs';
import { resolve, extname, basename } from 'path';
import { loadGuidelines } from './core/load-guidelines.js';
import { analyzeText } from './core/analyzer.js';
import { loadIgnorePatterns, isIgnored } from './core/ignore.js';

const filePath = process.env['CLAUDE_TOOL_OUTPUT_FILE'] ?? process.argv[2];

if (!filePath) process.exit(0);

const resolved = resolve(filePath);

if (!existsSync(resolved)) process.exit(0);

const ext = extname(resolved).toLowerCase();
if (ext !== '.md' && ext !== '.mdx') process.exit(0);

const cwd = process.cwd();

const ignorePatterns = loadIgnorePatterns(cwd);
if (isIgnored(resolved, cwd, ignorePatterns)) {
  process.stdout.write(`brand-voice: ✓ ${basename(resolved)} (ignored)\n`);
  process.exit(0);
}

const guidelines = loadGuidelines(cwd);
if (!guidelines) {
  process.stdout.write('brand-voice: no brand-guidelines.md found, skipping check\n');
  process.exit(0);
}

let content: string;
try {
  content = readFileSync(resolved, 'utf-8');
} catch {
  process.exit(0);
}

const result = analyzeText(content, resolved, guidelines);

if (result.violations.length === 0) {
  process.stdout.write(`brand-voice: ✓ ${basename(resolved)}\n`);
  process.exit(0);
}

const filename = basename(resolved);
const lines: string[] = [`Brand Voice violations in ${filename}:`];

for (const v of result.violations) {
  lines.push(`  Line ${v.line}: ${v.message}`);
}

lines.push('Fix these violations, then the file will be saved.');

process.stdout.write(lines.join('\n') + '\n');
process.exit(2);
