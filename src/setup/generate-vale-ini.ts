import type { BrandGuidelines } from '../types.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export function generateValeIni(projectRoot: string, guidelines: BrandGuidelines): void {
  const ini = `StylesPath = .vale/styles
MinAlertLevel = warning

[*.{md,mdx,txt}]
BasedOnStyles = Vale, BrandVoice
`;
  writeFileSync(join(projectRoot, '.vale.ini'), ini, 'utf8');
}

export function generateBrandVoiceStyle(projectRoot: string, guidelines: BrandGuidelines): void {
  const stylesDir = join(projectRoot, '.vale', 'styles', 'BrandVoice');
  if (!existsSync(stylesDir)) {
    mkdirSync(stylesDir, { recursive: true });
  }

  const avoidTerms = guidelines.vocabulary?.avoid ?? [];
  if (avoidTerms.length > 0) {
    const tokens = avoidTerms.map((t) => `  - ${t}`).join('\n');
    const yml = `extends: existence
message: 'Brand voice: avoid "%s" — rephrase'
level: warning
tokens:
${tokens}
`;
    writeFileSync(join(stylesDir, 'Avoid.yml'), yml, 'utf8');
  }

  const forbiddenTerms = guidelines.vocabulary?.forbidden ?? [];
  if (forbiddenTerms.length > 0) {
    const tokens = forbiddenTerms.map((t) => `  - ${t}`).join('\n');
    const yml = `extends: existence
message: 'Brand voice: avoid "%s" — rephrase'
level: error
tokens:
${tokens}
`;
    writeFileSync(join(stylesDir, 'Forbidden.yml'), yml, 'utf8');
  }
}
