import { readFileSync, existsSync } from 'fs';
import { join, resolve, relative } from 'path';

export function loadIgnorePatterns(startDir: string): string[] {
  const ignorePath = join(startDir, '.brand-voice-ignore');
  if (!existsSync(ignorePath)) return [];
  return readFileSync(ignorePath, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'));
}

export function isIgnored(filePath: string, baseDir: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  const rel = relative(resolve(baseDir), resolve(filePath)).replace(/\\/g, '/');
  return patterns.some(p => matchPattern(p, rel));
}

function matchPattern(pattern: string, filePath: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\x00')
    .replace(/\*/g, '[^/]*')
    .replace(/\x00/g, '.*');
  const regex = new RegExp(`^${regexStr}(/.*)?$`);
  return regex.test(filePath);
}
