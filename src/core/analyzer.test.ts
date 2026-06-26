import { analyzeText } from './analyzer.js';
import type { BrandGuidelines } from '../types.js';

const guidelines: BrandGuidelines = {
  rawMarkdown: '',
  vocabulary: {
    forbidden: ['simply', 'easy'],
    avoid: ['utilize', 'leverage'],
  },
  voice: {
    maxSentenceWords: 25,
    activeVoice: true,
  },
};

const FILE = 'test.md';

describe('analyzeText', () => {
  it('returns no violations for clean text', () => {
    const result = analyzeText('The system processes requests efficiently.', FILE, guidelines);
    expect(result.violations).toHaveLength(0);
  });

  it('detects a forbidden term', () => {
    const result = analyzeText('It is simply a matter of configuration.', FILE, guidelines);
    const forbidden = result.violations.filter((v) => v.rule === 'forbidden-term');
    expect(forbidden.length).toBeGreaterThan(0);
    expect(forbidden[0].message).toContain('simply');
  });

  it('detects an avoid term', () => {
    const result = analyzeText('You should utilize this feature.', FILE, guidelines);
    const avoid = result.violations.filter((v) => v.rule === 'avoid-term');
    expect(avoid.length).toBeGreaterThan(0);
    expect(avoid[0].message).toContain('utilize');
  });

  it('flags a sentence exceeding the max word count', () => {
    const longSentence =
      'This sentence has been carefully constructed to contain well over twenty five total words so that it will clearly trigger the sentence length violation check in the analyzer.';
    const result = analyzeText(longSentence, FILE, guidelines);
    const lengthViolations = result.violations.filter((v) => v.rule === 'sentence-length');
    expect(lengthViolations.length).toBeGreaterThan(0);
  });

  it('detects passive voice', () => {
    const result = analyzeText('The server is configured by the administrator.', FILE, guidelines);
    const passive = result.violations.filter((v) => v.rule === 'passive-voice');
    expect(passive.length).toBeGreaterThan(0);
  });

  it('returns readability scores', () => {
    const result = analyzeText('The quick brown fox jumps over the lazy dog.', FILE, guidelines);
    expect(result.readabilityScores).toBeDefined();
    expect(typeof result.readabilityScores.fleschReadingEase).toBe('number');
    expect(typeof result.readabilityScores.fleschKincaidGrade).toBe('number');
    expect(typeof result.readabilityScores.wordCount).toBe('number');
  });

  it('reports multiple violations in one text', () => {
    const text =
      'It is simply easy to utilize this tool, and the configuration is managed by the system in a way that takes more than twenty five words to explain properly here.';
    const result = analyzeText(text, FILE, guidelines);
    expect(result.violations.length).toBeGreaterThan(2);
  });

  it('matches terms case-insensitively', () => {
    const result = analyzeText('SIMPLY put, this should be flagged.', FILE, guidelines);
    const forbidden = result.violations.filter(
      (v) => v.rule === 'forbidden-term' && v.message.toLowerCase().includes('simply'),
    );
    expect(forbidden.length).toBeGreaterThan(0);
  });

  it('does not trigger "simply" on the word "simplify"', () => {
    const result = analyzeText('We aim to simplify the process.', FILE, guidelines);
    const forbidden = result.violations.filter((v) => v.rule === 'forbidden-term');
    expect(forbidden).toHaveLength(0);
  });

  it('passed is false when error-severity violations exist', () => {
    const result = analyzeText('This is simply wrong.', FILE, guidelines);
    expect(result.passed).toBe(false);
  });

  it('passed is true when only warnings exist', () => {
    const guidelinesAvoidOnly: BrandGuidelines = {
      rawMarkdown: '',
      vocabulary: { avoid: ['utilize'] },
    };
    const result = analyzeText('You can utilize this.', FILE, guidelinesAvoidOnly);
    // avoid-term is a warning, so passed should be true
    expect(result.passed).toBe(true);
    expect(result.violations.some((v) => v.severity === 'warning')).toBe(true);
  });

  it('does not flag terms inside fenced code blocks', () => {
    const text = 'Good prose here.\n```js\nconst x = simply(utilize());\n```\nMore prose.';
    const result = analyzeText(text, FILE, guidelines);
    expect(result.violations.filter(v => v.rule === 'forbidden-term' || v.rule === 'avoid-term')).toHaveLength(0);
  });

  it('does not flag terms inside indented code blocks', () => {
    const text = 'Good prose here.\n    const x = simply(utilize());\nMore prose.';
    const result = analyzeText(text, FILE, guidelines);
    expect(result.violations.filter(v => v.rule === 'forbidden-term' || v.rule === 'avoid-term')).toHaveLength(0);
  });

  it('does not flag terms inside inline code spans', () => {
    const text = 'Call the `utilize()` method or the `simply` helper.';
    const result = analyzeText(text, FILE, guidelines);
    expect(result.violations.filter(v => v.rule === 'forbidden-term' || v.rule === 'avoid-term')).toHaveLength(0);
  });

  it('does not flag sentence length on table rows', () => {
    const text = [
      '| Column A | Column B | Column C | Column D | Column E | Column F | Column G |',
      '|---|---|---|---|---|---|---|',
      '| val1 | val2 | val3 | val4 | val5 | val6 | val7 |',
    ].join('\n');
    const result = analyzeText(text, FILE, guidelines);
    expect(result.violations.filter(v => v.rule === 'sentence-length')).toHaveLength(0);
  });

  it('does not flag passive voice inside fenced code blocks', () => {
    const text = 'Good intro.\n```\nif (value is configured by user) {}\n```\nDone.';
    const result = analyzeText(text, FILE, guidelines);
    expect(result.violations.filter(v => v.rule === 'passive-voice')).toHaveLength(0);
  });

  it('still flags terms in prose after a code block', () => {
    const text = '```\nclean code\n```\nYou should utilize this feature.';
    const result = analyzeText(text, FILE, guidelines);
    expect(result.violations.filter(v => v.rule === 'avoid-term')).toHaveLength(1);
  });

  it('suppresses all violations on a line marked with brand-voice-disable-line', () => {
    const text = 'It is simply easy to utilize this. <!-- brand-voice-disable-line -->';
    const result = analyzeText(text, FILE, guidelines);
    expect(result.violations).toHaveLength(0);
  });

  it('does not suppress violations on unmarked lines', () => {
    const text = 'Clean line.\nIt is simply wrong. <!-- brand-voice-disable-line -->\nAlso simply wrong.';
    const result = analyzeText(text, FILE, guidelines);
    expect(result.violations.filter(v => v.rule === 'forbidden-term')).toHaveLength(1);
    expect(result.violations[0].line).toBe(3);
  });
});
