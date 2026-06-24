import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const HOOK_MATCHER = 'Write|Edit|MultiEdit';
const HOOK_COMMAND = 'brand-voice-check "$CLAUDE_TOOL_OUTPUT_FILE"';
const HOOK_TIMEOUT = 10000;

interface HookEntry {
  type: string;
  command: string;
  timeout: number;
}

interface PostToolUseEntry {
  matcher: string;
  hooks: HookEntry[];
}

interface Settings {
  hooks?: {
    PostToolUse?: PostToolUseEntry[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function readSettings(settingsPath: string): Settings {
  if (!existsSync(settingsPath)) {
    return {};
  }
  const raw = readFileSync(settingsPath, 'utf8');
  try {
    return JSON.parse(raw) as Settings;
  } catch {
    return {};
  }
}

function writeSettings(settingsPath: string, settings: Settings): void {
  const dir = dirname(settingsPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

function isBrandVoiceHook(entry: PostToolUseEntry): boolean {
  return (
    entry.matcher === HOOK_MATCHER &&
    entry.hooks.some((h) => h.command === HOOK_COMMAND)
  );
}

export function registerHook(settingsPath: string): void {
  const settings = readSettings(settingsPath);

  if (!settings.hooks) {
    settings.hooks = {};
  }

  if (!settings.hooks.PostToolUse) {
    settings.hooks.PostToolUse = [];
  }

  // Remove any existing brand-voice-check entry to replace it
  settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
    (entry) => !isBrandVoiceHook(entry),
  );

  settings.hooks.PostToolUse.push({
    matcher: HOOK_MATCHER,
    hooks: [
      {
        type: 'command',
        command: HOOK_COMMAND,
        timeout: HOOK_TIMEOUT,
      },
    ],
  });

  writeSettings(settingsPath, settings);
}

export function unregisterHook(settingsPath: string): void {
  const settings = readSettings(settingsPath);

  if (!settings.hooks?.PostToolUse) {
    return;
  }

  settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
    (entry) => !isBrandVoiceHook(entry),
  );

  if (settings.hooks.PostToolUse.length === 0) {
    delete settings.hooks.PostToolUse;
  }

  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  writeSettings(settingsPath, settings);
}
