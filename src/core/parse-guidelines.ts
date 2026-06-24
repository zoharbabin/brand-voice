// Parses a brand-guidelines.md file into a BrandGuidelines object.
// Uses simple line-by-line regex parsing — no Markdown AST dependency.

import type {
  BrandGuidelines,
  FormattingConfig,
  HardConstraintsConfig,
  VisualIdentityConfig,
  VocabularyConfig,
  VoiceConfig,
} from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Split the markdown into named sections keyed by their H2 heading text. */
function extractSections(markdown: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let currentKey: string | null = null;
  let currentLines: string[] = [];

  for (const line of markdown.split('\n')) {
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      if (currentKey !== null) {
        sections.set(currentKey, currentLines);
      }
      currentKey = h2[1].trim();
      currentLines = [];
    } else if (currentKey !== null) {
      currentLines.push(line);
    }
  }

  if (currentKey !== null) {
    sections.set(currentKey, currentLines);
  }

  return sections;
}

/** Extract bullet-point text (lines starting with "- " or "* "). */
function bulletItems(lines: string[]): string[] {
  return lines
    .map((l) => l.match(/^\s*[-*]\s+(.+)/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => m[1].trim());
}

/**
 * Parse comma- or newline-separated values that follow a bold prefix on the
 * same line, then continue until the next bold prefix or blank separator.
 *
 * Example input lines:
 *   **Always use:** AI, Kaltura, video
 *   **Avoid:** content library
 */
function parseVocabKey(
  lines: string[],
  prefix: RegExp,
): string[] {
  const result: string[] = [];
  let capturing = false;

  for (const line of lines) {
    const match = line.match(prefix);
    if (match) {
      capturing = true;
      // Values may appear on the same line after the prefix.
      const rest = line.slice(match[0].length).trim().replace(/^:?\s*/, '');
      if (rest) {
        result.push(
          ...rest
            .split(/[,\n]+/)
            .map((v) => v.trim())
            .filter(Boolean),
        );
      }
      continue;
    }

    if (capturing) {
      // Stop at the next bold prefix or a blank line that precedes one.
      if (/^\*\*[^*]+\*\*/.test(line)) {
        capturing = false;
        continue;
      }
      const cleaned = line.replace(/^[-*]\s+/, '').trim();
      if (cleaned) {
        result.push(
          ...cleaned
            .split(/,/)
            .map((v) => v.trim())
            .filter(Boolean),
        );
      }
    }
  }

  return result;
}

/** Extract blockquote content (lines beginning with ">"). */
function blockquoteLines(lines: string[]): string[] {
  return lines
    .filter((l) => /^>\s?/.test(l))
    .map((l) => l.replace(/^>\s?/, '').trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Section parsers
// ---------------------------------------------------------------------------

function parsePersona(lines: string[]): string | undefined {
  const text = lines
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ');
  return text || undefined;
}

function parseTone(lines: string[]): string[] | undefined {
  const items = bulletItems(lines);
  return items.length ? items : undefined;
}

function parseVoice(lines: string[]): VoiceConfig | undefined {
  const voice: VoiceConfig = {};

  for (const line of lines) {
    const kv = line.match(/^\s*[-*]?\s*([^:]+):\s*(.+)/);
    if (!kv) continue;
    const key = kv[1].trim().toLowerCase();
    const val = kv[2].trim().toLowerCase();

    if (key === 'person') {
      if (val.includes('first')) voice.person = 'first';
      else if (val.includes('second')) voice.person = 'second';
      else if (val.includes('third')) voice.person = 'third';
    } else if (key === 'voice') {
      voice.activeVoice = val.includes('active');
    } else if (key === 'sentences') {
      const n = val.match(/\d+/);
      if (n) voice.maxSentenceWords = parseInt(n[0], 10);
    } else if (key === 'contractions') {
      voice.contractions = /yes|true|allowed|use/i.test(val);
    } else if (key === 'exclamation marks' || key === 'exclamations') {
      voice.exclamations = /yes|true|allowed|use/i.test(val);
    }
  }

  return Object.keys(voice).length ? voice : undefined;
}

function parseVocabulary(lines: string[]): VocabularyConfig | undefined {
  const vocab: VocabularyConfig = {};

  const alwaysUse = parseVocabKey(lines, /\*\*Always use:\*\*/i);
  const avoid = parseVocabKey(lines, /\*\*Avoid:\*\*/i);
  const forbidden = parseVocabKey(lines, /\*\*Forbidden:\*\*/i);

  if (alwaysUse.length) vocab.alwaysUse = alwaysUse;
  if (avoid.length) vocab.avoid = avoid;
  if (forbidden.length) vocab.forbidden = forbidden;

  return Object.keys(vocab).length ? vocab : undefined;
}

function parseFormatting(lines: string[]): FormattingConfig | undefined {
  const formatting: FormattingConfig = {};

  for (const line of lines) {
    const kv = line.match(/^\s*[-*]?\s*([^:]+):\s*(.+)/);
    if (!kv) continue;
    const key = kv[1].trim().toLowerCase();
    const val = kv[2].trim().toLowerCase();

    if (key === 'heading style' || key === 'headings') {
      if (val.includes('sentence')) formatting.headingStyle = 'sentence';
      else if (val.includes('title')) formatting.headingStyle = 'title';
    } else if (key === 'oxford comma') {
      formatting.oxfordComma = /yes|true|use|always/i.test(val);
    } else if (
      key === 'readability target' ||
      key === 'readability' ||
      key === 'target'
    ) {
      formatting.readabilityTarget = kv[2].trim();
    }
  }

  return Object.keys(formatting).length ? formatting : undefined;
}

function parseVisualIdentity(lines: string[]): VisualIdentityConfig | undefined {
  const vi: VisualIdentityConfig = {};

  for (const line of lines) {
    const kv = line.match(/^\s*[-*]?\s*([^:]+):\s*(.+)/);
    if (!kv) continue;
    const key = kv[1].trim().toLowerCase();
    const val = kv[2].trim();

    if (key === 'primary color' || key === 'primary') vi.primaryColor = val;
    else if (key === 'secondary color' || key === 'secondary') vi.secondaryColor = val;
    else if (key === 'accent color' || key === 'accent') vi.accentColor = val;
    else if (key === 'background color' || key === 'background') vi.backgroundColor = val;
    else if (key === 'text color' || key === 'text') vi.textColor = val;
    else if (key === 'logo' || key === 'logo (light)' || key === 'logo light') vi.logoLight = val;
    else if (key === 'logo (dark)' || key === 'logo dark') vi.logoDark = val;
    else if (key === 'icon' || key === 'icon / mark' || key === 'mark') vi.icon = val;
    else if (key === 'heading font' || key === 'headings font' || key === 'heading') vi.headingFont = val;
    else if (key === 'body font' || key === 'body') vi.bodyFont = val;
  }

  return Object.keys(vi).length ? vi : undefined;
}

function parseHardConstraints(
  lines: string[],
): HardConstraintsConfig | undefined {
  const hc: HardConstraintsConfig = {};

  // Gather multi-value lists for each key.
  const neverMention = parseVocabKey(lines, /Never mention:/i);
  const offLimits = parseVocabKey(lines, /Off-limits topics:/i);

  // Required spellings: "wrong → right" or "wrong: right"
  const spellings: Record<string, string> = {};
  let inSpellings = false;
  for (const line of lines) {
    if (/Required spellings:/i.test(line)) {
      inSpellings = true;
      // Check for inline values on the same line.
      const rest = line.replace(/Required spellings:\s*/i, '').trim();
      if (rest) {
        parseSpellingPairs(rest, spellings);
      }
      continue;
    }
    if (inSpellings) {
      if (/^\*\*[^*]+\*\*/.test(line) || /^##/.test(line)) {
        inSpellings = false;
        continue;
      }
      const cleaned = line.replace(/^[-*]\s+/, '').trim();
      if (cleaned) parseSpellingPairs(cleaned, spellings);
    }
  }

  if (neverMention.length) hc.neverMention = neverMention;
  if (Object.keys(spellings).length) hc.requiredSpellings = spellings;
  if (offLimits.length) hc.offLimitsTopics = offLimits;

  return Object.keys(hc).length ? hc : undefined;
}

function parseSpellingPairs(
  text: string,
  out: Record<string, string>,
): void {
  // Accept "wrong → right", "wrong -> right", or "wrong: right".
  for (const chunk of text.split(/[,;]/)) {
    const pair =
      chunk.match(/(.+?)\s*(?:→|->)\s*(.+)/) ??
      chunk.match(/(.+?):\s*(.+)/);
    if (pair) {
      out[pair[1].trim()] = pair[2].trim();
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseGuidelines(markdown: string): BrandGuidelines {
  const sections = extractSections(markdown);

  // Resolve section names tolerantly (case-insensitive key lookup).
  const find = (target: string): string[] => {
    for (const [key, val] of sections) {
      if (key.toLowerCase() === target.toLowerCase()) return val;
    }
    return [];
  };

  const guidelines: BrandGuidelines = {
    rawMarkdown: markdown,
  };

  const persona = parsePersona(find('Persona'));
  if (persona !== undefined) guidelines.persona = persona;

  const toneAndVoiceLines = find('Tone & Voice');

  const tone = parseTone(toneAndVoiceLines);
  if (tone !== undefined) guidelines.tone = tone;

  const voice = parseVoice(toneAndVoiceLines);
  if (voice !== undefined) guidelines.voice = voice;

  const vocabulary = parseVocabulary(find('Vocabulary'));
  if (vocabulary !== undefined) guidelines.vocabulary = vocabulary;

  const visualIdentity = parseVisualIdentity(find('Visual Identity'));
  if (visualIdentity !== undefined) guidelines.visualIdentity = visualIdentity;

  const onTone = blockquoteLines(
    find('On-Tone Examples').length ? find('On-Tone Examples') : find('On-Brand Examples'),
  );
  if (onTone.length) guidelines.onToneExamples = onTone;

  const offTone = blockquoteLines(
    find('Off-Tone Examples').length ? find('Off-Tone Examples') : find('Off-Brand Examples'),
  );
  if (offTone.length) guidelines.offToneExamples = offTone;

  const formatting = parseFormatting(find('Formatting Rules'));
  if (formatting !== undefined) guidelines.formatting = formatting;

  const hardConstraints = parseHardConstraints(find('Hard Constraints'));
  if (hardConstraints !== undefined)
    guidelines.hardConstraints = hardConstraints;

  // Quick Reference section is intentionally not mapped to a typed field;
  // it is preserved implicitly via rawMarkdown.

  return guidelines;
}
