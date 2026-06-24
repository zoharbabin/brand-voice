import type { BrandGuidelines, Violation, AnalysisResult, ReadabilityScores } from '../types.js';
import { flesch } from 'flesch';
import { fleschKincaid } from 'flesch-kincaid';

// Count vowel groups in a word as syllable estimate, minimum 1 per word.
function countSyllables(word: string): number {
  const stripped = word.toLowerCase().replace(/[^a-z]/g, '');
  if (stripped.length === 0) return 0;
  const matches = stripped.match(/[aeiou]+/g);
  return matches ? matches.length : 1;
}

// Split text into sentences on terminal punctuation.
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// Split text into words (non-whitespace tokens).
function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(w => w.length > 0);
}

// Count words in a sentence.
function wordCount(sentence: string): number {
  return splitWords(sentence).length;
}

// Build a whole-word case-insensitive RegExp for a term.
function wholeWordRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

// Parse a grade number from a readability target string like "8th grade" or "grade 8".
function parseGradeTarget(target: string): number | null {
  const match = target.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export function analyzeText(
  text: string,
  filePath: string,
  guidelines: BrandGuidelines,
): AnalysisResult {
  const violations: Violation[] = [];
  const lines = text.split('\n');
  const sentences = splitSentences(text);
  const words = splitWords(text);

  // --- Readability scores (whole text) ---
  const sentenceCount = sentences.length || 1;
  const wordCountTotal = words.length || 1;
  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);

  const counts = { sentence: sentenceCount, word: wordCountTotal, syllable: syllableCount };
  const fleschEase: number = flesch(counts);
  const fkGrade: number = fleschKincaid(counts);

  const readabilityScores: ReadabilityScores = {
    fleschReadingEase: fleschEase,
    fleschKincaidGrade: fkGrade,
    sentenceCount,
    wordCount: wordCountTotal,
    avgWordsPerSentence: wordCountTotal / sentenceCount,
  };

  // --- 1. Forbidden / avoid terms ---
  const forbidden = guidelines.vocabulary?.forbidden ?? [];
  const avoid = guidelines.vocabulary?.avoid ?? [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    const lineText = lines[lineIdx];

    for (const term of forbidden) {
      if (wholeWordRegex(term).test(lineText)) {
        violations.push({
          line: lineNum,
          message: `Forbidden term: "${term}"`,
          rule: 'forbidden-term',
          severity: 'error',
        });
      }
    }

    for (const term of avoid) {
      if (wholeWordRegex(term).test(lineText)) {
        violations.push({
          line: lineNum,
          message: `Avoid term: "${term}"`,
          rule: 'avoid-term',
          severity: 'warning',
        });
      }
    }
  }

  // --- 2. Sentence length ---
  const maxWords = guidelines.voice?.maxSentenceWords ?? 25;

  for (const sentence of sentences) {
    const wc = wordCount(sentence);
    if (wc > maxWords) {
      // Find the line number where this sentence starts.
      const firstWords = sentence.split(/\s+/).slice(0, 4).join(' ');
      const lineNum = findLineForText(lines, firstWords);
      violations.push({
        line: lineNum,
        message: `Sentence too long: ${wc} words (max ${maxWords}). Sentence: "${sentence.slice(0, 80)}${sentence.length > 80 ? '…' : ''}"`,
        rule: 'sentence-length',
        severity: 'warning',
      });
    }
  }

  // --- 3. Passive voice ---
  if (guidelines.voice?.activeVoice !== false) {
    const passivePattern = /\b(am|is|are|was|were|be|been|being)\s+\w+ed\b/gi;
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineNum = lineIdx + 1;
      const lineText = lines[lineIdx];
      const match = passivePattern.exec(lineText);
      if (match) {
        violations.push({
          line: lineNum,
          column: match.index + 1,
          message: `Possible passive voice: "${match[0]}"`,
          rule: 'passive-voice',
          severity: 'warning',
        });
      }
      // Reset lastIndex after exec loop
      passivePattern.lastIndex = 0;
    }
  }

  // --- 4. Readability per sentence ---
  const readabilityTarget = guidelines.formatting?.readabilityTarget;
  if (readabilityTarget) {
    const gradeTarget = parseGradeTarget(readabilityTarget);
    if (gradeTarget !== null) {
      for (const sentence of sentences) {
        const sw = splitWords(sentence);
        if (sw.length < 3) continue; // too short to score meaningfully
        const sc = 1;
        const wc2 = sw.length;
        const syl = sw.reduce((sum, w) => sum + countSyllables(w), 0);
        const sentFk: number = fleschKincaid({ sentence: sc, word: wc2, syllable: syl });
        if (sentFk > gradeTarget) {
          const firstWords = sw.slice(0, 4).join(' ');
          const lineNum = findLineForText(lines, firstWords);
          violations.push({
            line: lineNum,
            message: `Readability grade ${sentFk.toFixed(1)} exceeds target ${gradeTarget} (${readabilityTarget}): "${sentence.slice(0, 80)}${sentence.length > 80 ? '…' : ''}"`,
            rule: 'readability-grade',
            severity: 'warning',
          });
        }
      }
    }
  }

  return {
    filePath,
    violations,
    passed: violations.filter(v => v.severity === 'error').length === 0,
    readabilityScores,
  };
}

// Find the first line number (1-based) that contains the given text fragment.
function findLineForText(lines: string[], fragment: string): number {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(fragment)) return i + 1;
  }
  return 1;
}
