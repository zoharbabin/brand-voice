// Public API for programmatic use.

export { parseGuidelines } from './core/parse-guidelines.js';
export { analyzeText } from './core/analyzer.js';
export { loadGuidelines } from './core/load-guidelines.js';
export { generateInjection, injectIntoClaudeMd } from './setup/generate-claude-md.js';
export { generateValeIni, generateBrandVoiceStyle } from './setup/generate-vale-ini.js';
export { registerHook, unregisterHook } from './setup/register-hook.js';
export { registerMcp, unregisterMcp } from './setup/register-mcp.js';
export type {
  BrandGuidelines,
  VoiceConfig,
  VocabularyConfig,
  VisualIdentityConfig,
  FormattingConfig,
  HardConstraintsConfig,
  Violation,
  CheckResult,
  AnalysisResult,
  ReadabilityScores,
} from './types.js';
