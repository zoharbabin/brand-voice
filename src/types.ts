// Types shared across the brand-voice package.

export interface BrandGuidelines {
  persona?: string;
  tone?: string[];
  voice?: VoiceConfig;
  vocabulary?: VocabularyConfig;
  visualIdentity?: VisualIdentityConfig;
  onToneExamples?: string[];
  offToneExamples?: string[];
  formatting?: FormattingConfig;
  hardConstraints?: HardConstraintsConfig;
  rawMarkdown: string;
}

export interface VoiceConfig {
  person?: 'first' | 'second' | 'third';
  contractions?: boolean;
  exclamations?: boolean;
  maxSentenceWords?: number;
  activeVoice?: boolean;
}

export interface VocabularyConfig {
  alwaysUse?: string[];
  avoid?: string[];
  forbidden?: string[];
}

export interface VisualIdentityConfig {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  /** URL to the primary (light-background) logo asset. */
  logoLight?: string;
  /** URL to the dark-background logo variant. */
  logoDark?: string;
  /** URL to the compact icon / mark. */
  icon?: string;
  headingFont?: string;
  bodyFont?: string;
}

export interface FormattingConfig {
  headingStyle?: 'sentence' | 'title';
  oxfordComma?: boolean;
  readabilityTarget?: string;
}

export interface HardConstraintsConfig {
  neverMention?: string[];
  requiredSpellings?: Record<string, string>;
  offLimitsTopics?: string[];
}

export interface Violation {
  line: number;
  column?: number;
  message: string;
  rule: string;
  severity: 'error' | 'warning';
}

export interface CheckResult {
  filePath: string;
  violations: Violation[];
  passed: boolean;
}

export interface AnalysisResult extends CheckResult {
  readabilityScores: ReadabilityScores;
}

export interface ReadabilityScores {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  sentenceCount: number;
  wordCount: number;
  avgWordsPerSentence: number;
}
