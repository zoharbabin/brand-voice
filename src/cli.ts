#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, extname } from 'path';
import { loadGuidelines } from './core/load-guidelines.js';
import { analyzeText } from './core/analyzer.js';
import { parseGuidelines } from './core/parse-guidelines.js';
import type { Violation } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect all .md files under a directory. */
function findMdFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMdFiles(full));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
      results.push(full);
    }
  }
  return results;
}

function printViolations(filePath: string, violations: Violation[]): void {
  if (violations.length === 0) return;
  console.log(`\n${filePath}`);
  for (const v of violations) {
    const loc = v.column != null ? `${v.line}:${v.column}` : `${v.line}`;
    const tag = v.severity === 'error' ? 'error' : 'warning';
    console.log(`  ${loc}  ${tag}  ${v.message}  [${v.rule}]`);
  }
}

function printGithubAnnotations(filePath: string, violations: Violation[]): void {
  for (const v of violations) {
    const level = v.severity === 'error' ? 'error' : 'warning';
    const col = v.column != null ? `,col=${v.column}` : '';
    console.log(`::${level} file=${filePath},line=${v.line}${col}::${v.message} [${v.rule}]`);
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdSetup(): void {
  console.log(`Run this in Claude Code:
  /brand-voice-setup

Or with an existing file:
  /brand-voice-setup /path/to/your-brand-guidelines.md`);
}

function cmdValeSync(): void {
  // Check whether the vale binary is resolvable on PATH.
  import('child_process').then(({ execSync }) => {
    try {
      const out = execSync('vale --version', { stdio: 'pipe' }).toString().trim();
      console.log(`Vale is available: ${out}`);
    } catch {
      console.error(
        'Vale binary not found on PATH.\n' +
        'Install it from https://vale.sh or via your package manager:\n' +
        '  brew install vale        # macOS\n' +
        '  sudo snap install vale   # Linux\n' +
        '  choco install vale       # Windows',
      );
      process.exit(1);
    }
  }).catch(() => {
    console.error('Unable to check for Vale binary.');
    process.exit(1);
  });
}

function cmdImport(importFile: string): void {
  const absPath = resolve(importFile);
  if (!existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  let content: string;
  try {
    content = readFileSync(absPath, 'utf-8');
  } catch (err) {
    console.error(`Could not read file: ${absPath}\n${err}`);
    process.exit(1);
  }

  const guidelines = parseGuidelines(content);

  // Build a structured brand-guidelines.md from the extracted values.
  const lines: string[] = [
    '# Brand Guidelines',
    '',
  ];

  if (guidelines.persona) {
    lines.push('## Persona', '', guidelines.persona, '');
  }

  if (guidelines.tone?.length || guidelines.voice) {
    lines.push('## Tone & Voice', '');
    if (guidelines.tone?.length) {
      for (const item of guidelines.tone) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }
    if (guidelines.voice) {
      const v = guidelines.voice;
      if (v.person != null) lines.push(`- Person: ${v.person}`);
      if (v.activeVoice != null) lines.push(`- Voice: ${v.activeVoice ? 'active' : 'passive'}`);
      if (v.maxSentenceWords != null) lines.push(`- Sentences: max ${v.maxSentenceWords} words`);
      if (v.contractions != null) lines.push(`- Contractions: ${v.contractions ? 'yes' : 'no'}`);
      if (v.exclamations != null) lines.push(`- Exclamation marks: ${v.exclamations ? 'yes' : 'no'}`);
      lines.push('');
    }
  }

  if (guidelines.vocabulary) {
    lines.push('## Vocabulary', '');
    const vocab = guidelines.vocabulary;
    if (vocab.alwaysUse?.length) {
      lines.push(`**Always use:** ${vocab.alwaysUse.join(', ')}`);
    }
    if (vocab.avoid?.length) {
      lines.push(`**Avoid:** ${vocab.avoid.join(', ')}`);
    }
    if (vocab.forbidden?.length) {
      lines.push(`**Forbidden:** ${vocab.forbidden.join(', ')}`);
    }
    lines.push('');
  }

  if (guidelines.onToneExamples?.length) {
    lines.push('## On-Tone Examples', '');
    for (const ex of guidelines.onToneExamples) {
      lines.push(`> ${ex}`);
    }
    lines.push('');
  }

  if (guidelines.offToneExamples?.length) {
    lines.push('## Off-Tone Examples', '');
    for (const ex of guidelines.offToneExamples) {
      lines.push(`> ${ex}`);
    }
    lines.push('');
  }

  if (guidelines.formatting) {
    lines.push('## Formatting Rules', '');
    const f = guidelines.formatting;
    if (f.headingStyle != null) lines.push(`- Heading style: ${f.headingStyle}`);
    if (f.oxfordComma != null) lines.push(`- Oxford comma: ${f.oxfordComma ? 'yes' : 'no'}`);
    if (f.readabilityTarget != null) lines.push(`- Readability target: ${f.readabilityTarget}`);
    lines.push('');
  }

  if (guidelines.hardConstraints) {
    lines.push('## Hard Constraints', '');
    const hc = guidelines.hardConstraints;
    if (hc.neverMention?.length) {
      lines.push(`Never mention: ${hc.neverMention.join(', ')}`);
    }
    if (hc.offLimitsTopics?.length) {
      lines.push(`Off-limits topics: ${hc.offLimitsTopics.join(', ')}`);
    }
    if (hc.requiredSpellings && Object.keys(hc.requiredSpellings).length) {
      lines.push('Required spellings:');
      for (const [wrong, right] of Object.entries(hc.requiredSpellings)) {
        lines.push(`- ${wrong} → ${right}`);
      }
    }
    lines.push('');
  }

  const output = lines.join('\n');
  const outPath = join(process.cwd(), 'brand-guidelines.md');

  console.log(output);
  console.log(`\n---\nSaving to: ${outPath}`);
  try {
    writeFileSync(outPath, output, 'utf-8');
    console.log('Saved.');
  } catch (err) {
    console.error(`Could not write ${outPath}: ${err}`);
    process.exit(1);
  }
}

interface CheckOptions {
  changedOnly: boolean;
  baselineFile: string | null;
  reporter: 'default' | 'github-pr-review';
}

function runCheck(files: string[], options: CheckOptions): { totalViolations: number; errorCount: number; ratchetFailed: boolean | null } {
  const cwd = process.cwd();
  const guidelines = loadGuidelines(cwd);

  if (!guidelines) {
    console.error(
      'No brand-guidelines.md found.\n' +
      'Run `brand-voice setup` to get started, or create brand-guidelines.md in your project root.',
    );
    process.exit(1);
  }

  let totalViolations = 0;
  let errorCount = 0;

  // Load baseline if specified for ratchet comparison.
  let baselineCount: number | null = null;
  if (options.baselineFile) {
    const bPath = resolve(options.baselineFile);
    if (existsSync(bPath)) {
      try {
        const bData = JSON.parse(readFileSync(bPath, 'utf-8')) as { violations: number };
        baselineCount = bData.violations;
      } catch {
        console.error(`Could not parse baseline file: ${bPath}`);
      }
    }
  }

  for (const filePath of files) {
    let text: string;
    try {
      text = readFileSync(filePath, 'utf-8');
    } catch {
      console.error(`Could not read: ${filePath}`);
      continue;
    }

    const result = analyzeText(text, filePath, guidelines);
    totalViolations += result.violations.length;
    errorCount += result.violations.filter(v => v.severity === 'error').length;

    if (options.reporter === 'github-pr-review') {
      printGithubAnnotations(filePath, result.violations);
    } else {
      printViolations(filePath, result.violations);
    }
  }

  if (options.reporter !== 'github-pr-review') {
    const summary =
      `\nTotal: ${totalViolations} violation${totalViolations !== 1 ? 's' : ''} ` +
      `(${errorCount} error${errorCount !== 1 ? 's' : ''}) across ${files.length} file${files.length !== 1 ? 's' : ''}`;
    console.log(summary);
  }

  // When a baseline is active, ratchet determines the exit — not raw error count.
  if (baselineCount !== null) {
    if (totalViolations > baselineCount) {
      console.error(
        `Ratchet failed: ${totalViolations} violation${totalViolations !== 1 ? 's' : ''} exceeds baseline of ${baselineCount}.`,
      );
      return { totalViolations, errorCount, ratchetFailed: true };
    } else {
      console.log(`Ratchet passed: ${totalViolations} <= baseline ${baselineCount}.`);
      return { totalViolations, errorCount, ratchetFailed: false };
    }
  }

  return { totalViolations, errorCount, ratchetFailed: null };
}

function cmdCheck(targetFile: string | null, options: CheckOptions): void {
  let files: string[];

  if (targetFile) {
    const abs = resolve(targetFile);
    if (!existsSync(abs)) {
      console.error(`File not found: ${abs}`);
      process.exit(1);
    }
    files = [abs];
  } else {
    files = findMdFiles(process.cwd());
    if (files.length === 0) {
      console.log('No .md files found in current directory.');
      process.exit(0);
    }
  }

  const { errorCount, ratchetFailed } = runCheck(files, options);
  if (ratchetFailed !== null) {
    process.exit(ratchetFailed ? 1 : 0);
  }
  process.exit(errorCount > 0 ? 1 : 0);
}

function cmdBaseline(): void {
  const cwd = process.cwd();
  const files = findMdFiles(cwd);

  if (files.length === 0) {
    console.log('No .md files found — baseline set to 0.');
    writeFileSync(
      join(cwd, '.brand-voice-baseline.json'),
      JSON.stringify({ violations: 0, files: 0, savedAt: new Date().toISOString() }, null, 2),
      'utf-8',
    );
    return;
  }

  const guidelines = loadGuidelines(cwd);
  if (!guidelines) {
    console.error(
      'No brand-guidelines.md found.\n' +
      'Run `brand-voice setup` to get started.',
    );
    process.exit(1);
  }

  let total = 0;
  for (const filePath of files) {
    let text: string;
    try {
      text = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }
    const result = analyzeText(text, filePath, guidelines);
    total += result.violations.length;
  }

  const baselinePath = join(cwd, '.brand-voice-baseline.json');
  const data = {
    violations: total,
    files: files.length,
    savedAt: new Date().toISOString(),
  };
  writeFileSync(baselinePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Baseline saved to ${baselinePath}: ${total} violation${total !== 1 ? 's' : ''} across ${files.length} file${files.length !== 1 ? 's' : ''}.`);
}

// ---------------------------------------------------------------------------
// Arg parsing and dispatch
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`Usage: brand-voice <command> [options]

Commands:
  check [file]              Check a file or all .md files in cwd
  setup                     Print instructions to run /brand-voice-setup in Claude Code
  import <file>             Extract AI-relevant sections from a brand guidelines file
  baseline --save           Save current violation count as ratchet baseline
  vale-sync                 Check that the Vale binary is available

Check options:
  --changed-only            Only check files changed in git (requires git)
  --baseline <file>         Compare against a baseline JSON file (ratchet check)
  --reporter github-pr-review  Emit GitHub Actions annotation format
`);
}

const argv = process.argv.slice(2);
const command = argv[0];

switch (command) {
  case 'setup': {
    cmdSetup();
    break;
  }

  case 'vale-sync': {
    cmdValeSync();
    break;
  }

  case 'import': {
    const importFile = argv[1];
    if (!importFile) {
      console.error('Usage: brand-voice import <file>');
      process.exit(1);
    }
    cmdImport(importFile);
    break;
  }

  case 'baseline': {
    if (argv[1] !== '--save') {
      console.error('Usage: brand-voice baseline --save');
      process.exit(1);
    }
    cmdBaseline();
    break;
  }

  case 'check': {
    // Collect flags and optional positional file argument.
    let targetFile: string | null = null;
    let changedOnly = false;
    let baselineFile: string | null = null;
    let reporter: 'default' | 'github-pr-review' = 'default';

    for (let i = 1; i < argv.length; i++) {
      const arg = argv[i];
      if (arg === '--changed-only') {
        changedOnly = true;
      } else if (arg === '--baseline') {
        baselineFile = argv[++i] ?? null;
        if (!baselineFile) {
          console.error('--baseline requires a file path argument');
          process.exit(1);
        }
      } else if (arg === '--reporter') {
        const val = argv[++i];
        if (val === 'github-pr-review') {
          reporter = 'github-pr-review';
        } else {
          console.error(`Unknown reporter: ${val}`);
          process.exit(1);
        }
      } else if (!arg.startsWith('--')) {
        targetFile = arg;
      }
    }

    // --changed-only: get list of changed .md files from git.
    if (changedOnly) {
      import('child_process').then(({ execSync }) => {
        let changedFiles: string[] = [];
        try {
          const out = execSync('git diff --name-only HEAD', { stdio: 'pipe' }).toString();
          changedFiles = out
            .split('\n')
            .map(f => f.trim())
            .filter(f => f.endsWith('.md') && f.length > 0)
            .map(f => resolve(process.cwd(), f))
            .filter(f => existsSync(f));
        } catch {
          console.error('Could not run git diff. Is this a git repository?');
          process.exit(1);
        }

        if (changedFiles.length === 0) {
          console.log('No changed .md files found.');
          process.exit(0);
        }

        const { errorCount, ratchetFailed } = runCheck(changedFiles, { changedOnly, baselineFile, reporter });
        if (ratchetFailed !== null) {
          process.exit(ratchetFailed ? 1 : 0);
        }
        process.exit(errorCount > 0 ? 1 : 0);
      }).catch(() => {
        console.error('Unable to import child_process.');
        process.exit(1);
      });
    } else {
      cmdCheck(targetFile, { changedOnly, baselineFile, reporter });
    }
    break;
  }

  default: {
    if (command && !command.startsWith('-')) {
      console.error(`Unknown command: ${command}\n`);
    }
    printUsage();
    process.exit(command ? 1 : 0);
    break;
  }
}
