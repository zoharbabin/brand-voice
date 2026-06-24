import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, rmdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const SKILL_NAME = 'brand-voice-setup';

function resolveSkillSource(): string {
  const __filename = fileURLToPath(import.meta.url);
  // dist/setup/install-skill.js → project root
  const pkgRoot = join(dirname(__filename), '..', '..');
  return join(pkgRoot, 'skills', `${SKILL_NAME}.md`);
}

function resolveSkillTarget(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  return join(home, '.claude', 'skills', SKILL_NAME, 'SKILL.md');
}

export function installSkill(): void {
  const src = resolveSkillSource();
  if (!existsSync(src)) {
    return;
  }

  const dest = resolveSkillTarget();
  const destDir = dirname(dest);

  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  writeFileSync(dest, readFileSync(src, 'utf-8'), 'utf-8');
}

export function uninstallSkill(): void {
  const dest = resolveSkillTarget();
  if (!existsSync(dest)) {
    return;
  }

  rmSync(dest);

  try {
    rmdirSync(dirname(dest));
  } catch {
    // Directory not empty — leave it
  }
}
