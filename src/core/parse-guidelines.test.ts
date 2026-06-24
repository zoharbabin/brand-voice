import { parseGuidelines } from './parse-guidelines.js';

const FULL_GUIDELINES = `
# Brand Guidelines

## Persona
We write for technical decision-makers.

## Tone & Voice
- Direct, honest, clear
- Person: second
- Voice: active
- Sentences: max 25 words
- Contractions: yes

## Vocabulary
**Always use:** Acme, Acme Platform
**Avoid:** leverage, utilize
**Forbidden:** simply, easy

## Visual Identity
- Primary color: #006EFA
- Secondary color: #0050C3
- Accent color: #FF9DFF
- Background color: #FFFFFF
- Text color: #282828
- Logo (light): https://cdn.acme.com/logo-light.svg
- Logo (dark): https://cdn.acme.com/logo-dark.svg
- Icon / mark: https://cdn.acme.com/icon.svg
- Heading font: Centra No.1
- Body font: Source Sans Pro

## On-Tone Examples
> Connect your data in minutes.

## Formatting Rules
- Heading style: sentence case
- Readability target: 8th grade

## Quick Reference
1. Active voice.
2. No forbidden terms.
`;

describe('parseGuidelines', () => {
  it('parses persona', () => {
    const g = parseGuidelines(FULL_GUIDELINES);
    expect(g.persona).toContain('technical decision-makers');
  });

  it('parses tone bullets', () => {
    const g = parseGuidelines(FULL_GUIDELINES);
    expect(g.tone).toContain('Direct, honest, clear');
  });

  it('parses voice config', () => {
    const g = parseGuidelines(FULL_GUIDELINES);
    expect(g.voice?.person).toBe('second');
    expect(g.voice?.activeVoice).toBe(true);
    expect(g.voice?.maxSentenceWords).toBe(25);
    expect(g.voice?.contractions).toBe(true);
  });

  it('parses vocabulary', () => {
    const g = parseGuidelines(FULL_GUIDELINES);
    expect(g.vocabulary?.alwaysUse).toContain('Acme');
    expect(g.vocabulary?.avoid).toContain('leverage');
    expect(g.vocabulary?.forbidden).toContain('simply');
  });

  it('parses visual identity colors', () => {
    const g = parseGuidelines(FULL_GUIDELINES);
    expect(g.visualIdentity?.primaryColor).toBe('#006EFA');
    expect(g.visualIdentity?.secondaryColor).toBe('#0050C3');
    expect(g.visualIdentity?.accentColor).toBe('#FF9DFF');
    expect(g.visualIdentity?.backgroundColor).toBe('#FFFFFF');
    expect(g.visualIdentity?.textColor).toBe('#282828');
  });

  it('parses visual identity logos', () => {
    const g = parseGuidelines(FULL_GUIDELINES);
    expect(g.visualIdentity?.logoLight).toBe('https://cdn.acme.com/logo-light.svg');
    expect(g.visualIdentity?.logoDark).toBe('https://cdn.acme.com/logo-dark.svg');
    expect(g.visualIdentity?.icon).toBe('https://cdn.acme.com/icon.svg');
  });

  it('parses visual identity fonts', () => {
    const g = parseGuidelines(FULL_GUIDELINES);
    expect(g.visualIdentity?.headingFont).toBe('Centra No.1');
    expect(g.visualIdentity?.bodyFont).toBe('Source Sans Pro');
  });

  it('parses on-tone examples', () => {
    const g = parseGuidelines(FULL_GUIDELINES);
    expect(g.onToneExamples?.[0]).toBe('Connect your data in minutes.');
  });

  it('parses formatting rules', () => {
    const g = parseGuidelines(FULL_GUIDELINES);
    expect(g.formatting?.headingStyle).toBe('sentence');
    expect(g.formatting?.readabilityTarget).toBe('8th grade');
  });

  it('accepts "On-Brand Examples" as alias for on-tone examples', () => {
    const g = parseGuidelines(
      '# Brand Guidelines\n\n## On-Brand Examples\n> Ship faster.\n',
    );
    expect(g.onToneExamples?.[0]).toBe('Ship faster.');
  });

  it('returns undefined visualIdentity when section is absent', () => {
    const g = parseGuidelines('# Brand Guidelines\n\n## Persona\nWe are a company.\n');
    expect(g.visualIdentity).toBeUndefined();
  });

  it('preserves rawMarkdown', () => {
    const g = parseGuidelines(FULL_GUIDELINES);
    expect(g.rawMarkdown).toBe(FULL_GUIDELINES);
  });
});
