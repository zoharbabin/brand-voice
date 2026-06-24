#!/usr/bin/env node
// Runs automatically after `npm install -g brand-voice`.
// Copies the /brand-voice-setup skill into ~/.claude/skills/.

import { installSkill } from './setup/install-skill.js';

try {
  installSkill();
} catch {
  // Non-fatal — user can run /brand-voice-setup manually after copying the skill
}
