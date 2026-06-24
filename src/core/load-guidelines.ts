import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';
import { parseGuidelines } from './parse-guidelines.js';
import type { BrandGuidelines } from '../types.js';

const FILENAME = 'brand-guidelines.md';

export function loadGuidelines(startDir: string): BrandGuidelines | null {
  const candidates = buildSearchPaths(startDir);
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf-8');
        return parseGuidelines(content);
      } catch {
        // skip unreadable file
      }
    }
  }
  return null;
}

function buildSearchPaths(startDir: string): string[] {
  const paths: string[] = [];
  const start = resolve(startDir);

  // 1. Current working directory
  paths.push(join(start, FILENAME));

  // 2. ~/.claude/
  paths.push(join(homedir(), '.claude', FILENAME));

  // 3. Walk up from startDir to git root (skipping startDir, already added)
  let dir = start;
  while (true) {
    // Stop at git root
    if (existsSync(join(dir, '.git'))) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
    paths.push(join(dir, FILENAME));
  }

  return paths;
}
