import type { BrandGuidelines } from '../types.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const DELIMITER_START = '<!-- brand-voice:start — generated from brand-guidelines.md -->';
const DELIMITER_END = '<!-- brand-voice:end -->';

export function generateInjection(guidelines: BrandGuidelines): string {
  const lines: string[] = ['## Brand Voice', ''];

  if (guidelines.tone && guidelines.tone.length > 0) {
    lines.push(`**Tone:** ${guidelines.tone.join(', ')}`);
    lines.push('');
  }

  if (guidelines.vocabulary?.forbidden && guidelines.vocabulary.forbidden.length > 0) {
    const forbidden = guidelines.vocabulary.forbidden.map((t) => `NEVER "${t}"`).join(', ');
    lines.push(`**Forbidden terms:** ${forbidden}`);
    lines.push('');
  }

  if (guidelines.voice) {
    const rules: string[] = [];
    if (guidelines.voice.maxSentenceWords !== undefined) {
      rules.push(`Keep sentences to ${guidelines.voice.maxSentenceWords} words or fewer.`);
    }
    if (guidelines.voice.activeVoice === true) {
      rules.push('Use active voice.');
    }
    if (guidelines.voice.person !== undefined) {
      const personMap: Record<string, string> = {
        first: 'Write in first person.',
        second: 'Write in second person.',
        third: 'Write in third person.',
      };
      rules.push(personMap[guidelines.voice.person]);
    }
    if (rules.length > 0) {
      lines.push('**Sentence rules:**');
      for (const rule of rules) {
        lines.push(`- ${rule}`);
      }
      lines.push('');
    }
  }

  if (guidelines.voice?.contractions !== undefined) {
    const contractionsRule = guidelines.voice.contractions
      ? 'Use contractions (e.g. "don\'t", "it\'s").'
      : 'Avoid contractions; write words in full.';
    lines.push(`**Contractions:** ${contractionsRule}`);
    lines.push('');
  }

  if (guidelines.vocabulary?.alwaysUse && guidelines.vocabulary.alwaysUse.length > 0) {
    lines.push(`**Brand terms (always use these spellings):** ${guidelines.vocabulary.alwaysUse.join(', ')}`);
    lines.push('');
  }

  if (guidelines.visualIdentity) {
    const vi = guidelines.visualIdentity;
    const colorEntries: string[] = [];
    if (vi.primaryColor) colorEntries.push(`primary: ${vi.primaryColor}`);
    if (vi.secondaryColor) colorEntries.push(`secondary: ${vi.secondaryColor}`);
    if (vi.accentColor) colorEntries.push(`accent: ${vi.accentColor}`);
    if (vi.backgroundColor) colorEntries.push(`background: ${vi.backgroundColor}`);
    if (vi.textColor) colorEntries.push(`text: ${vi.textColor}`);
    if (colorEntries.length > 0) {
      lines.push(`**Brand colors:** ${colorEntries.join(' · ')}`);
      lines.push('');
    }

    const fontEntries: string[] = [];
    if (vi.headingFont) fontEntries.push(`headings: ${vi.headingFont}`);
    if (vi.bodyFont) fontEntries.push(`body: ${vi.bodyFont}`);
    if (fontEntries.length > 0) {
      lines.push(`**Fonts:** ${fontEntries.join(' · ')}`);
      lines.push('');
    }

    const logoEntries: string[] = [];
    if (vi.logoLight) logoEntries.push(`logo (light): ${vi.logoLight}`);
    if (vi.logoDark) logoEntries.push(`logo (dark): ${vi.logoDark}`);
    if (vi.icon) logoEntries.push(`icon: ${vi.icon}`);
    if (logoEntries.length > 0) {
      lines.push('**Logo assets:**');
      for (const entry of logoEntries) {
        lines.push(`- ${entry}`);
      }
      lines.push('');
    }
  }

  if (guidelines.onToneExamples && guidelines.onToneExamples.length > 0) {
    lines.push('**On-tone example:**');
    lines.push(`> ${guidelines.onToneExamples[0]}`);
    lines.push('');
  }

  const content = lines.join('\n').trimEnd();
  return `${DELIMITER_START}\n${content}\n${DELIMITER_END}`;
}

export function injectIntoClaudeMd(claudeMdPath: string, injection: string): void {
  if (!existsSync(claudeMdPath)) {
    writeFileSync(claudeMdPath, injection + '\n', 'utf8');
    return;
  }

  const existing = readFileSync(claudeMdPath, 'utf8');

  const startIdx = existing.indexOf(DELIMITER_START);
  const endIdx = existing.indexOf(DELIMITER_END);

  if (startIdx === -1 || endIdx === -1) {
    const separator = existing.endsWith('\n') ? '\n' : '\n\n';
    writeFileSync(claudeMdPath, existing + separator + injection + '\n', 'utf8');
    return;
  }

  const before = existing.slice(0, startIdx);
  const after = existing.slice(endIdx + DELIMITER_END.length);
  writeFileSync(claudeMdPath, before + injection + after, 'utf8');
}
