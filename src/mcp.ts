#!/usr/bin/env node
// Brand-voice MCP server — exposes analyze_readability and apply_suggestions tools.

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadGuidelines } from './core/load-guidelines.js';
import { analyzeText } from './core/analyzer.js';

// ---------------------------------------------------------------------------
// Known forbidden/avoid → simpler replacement map
// ---------------------------------------------------------------------------

const BUILTIN_REPLACEMENTS: Record<string, string | null> = {
  utilize: 'use',
  leverage: 'use',
  synergy: 'collaboration',
  simply: null,   // remove
  easy: null,     // remove or rephrase
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Apply safe word-level substitutions to text.
 * Returns { updated: string; changes: Array<{ term: string; replacement: string | null; count: number }> }.
 */
function applySubstitutions(
  text: string,
  replacements: Record<string, string | null>,
): {
  updated: string;
  changes: Array<{ term: string; replacement: string | null; count: number }>;
} {
  let updated = text;
  const changes: Array<{ term: string; replacement: string | null; count: number }> = [];

  for (const [term, replacement] of Object.entries(replacements)) {
    const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi');
    let count = 0;

    if (replacement === null) {
      // Remove the word (and a trailing space if present).
      updated = updated.replace(new RegExp(`\\b${escapeRegExp(term)}\\b\\s*`, 'gi'), () => {
        count++;
        return '';
      });
    } else {
      updated = updated.replace(regex, (match) => {
        count++;
        // Preserve original capitalisation.
        if (match[0] === match[0].toUpperCase()) {
          return replacement.charAt(0).toUpperCase() + replacement.slice(1);
        }
        return replacement;
      });
    }

    if (count > 0) {
      changes.push({ term, replacement, count });
    }
  }

  return { updated, changes };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a minimal unified diff between two strings (line-level).
 */
function buildDiff(original: string, updated: string, filePath: string): string {
  const origLines = original.split('\n');
  const newLines = updated.split('\n');
  const lines: string[] = [`--- ${filePath}`, `+++ ${filePath} (modified)`];

  const maxLen = Math.max(origLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i];
    const n = newLines[i];
    if (o === n) {
      lines.push(` ${o ?? ''}`);
    } else {
      if (o !== undefined) lines.push(`-${o}`);
      if (n !== undefined) lines.push(`+${n}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'brand-voice', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'analyze_readability',
      title: 'Analyze Brand Voice',
      description:
        'Check a Markdown file or inline text for brand-voice violations and readability scores. ' +
        'Returns a structured report with: each violation (line, severity, rule, message), ' +
        'readability metrics (Flesch Reading Ease, Flesch-Kincaid grade, sentence/word counts), ' +
        'and the visual identity palette (colors, fonts, logo URLs) from brand-guidelines.md. ' +
        'Use this before writing or editing any customer-facing Markdown to verify compliance.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      inputSchema: {
        type: 'object' as const,
        properties: {
          file: {
            type: 'string',
            description:
              'Absolute or cwd-relative path to a .md or .mdx file to analyze. ' +
              'Provide either "file" or "text", not both.',
          },
          text: {
            type: 'string',
            description:
              'Inline Markdown text to analyze. ' +
              'Provide either "text" or "file", not both.',
          },
          cwd: {
            type: 'string',
            description:
              'Absolute path to the working directory used to locate brand-guidelines.md. ' +
              'Defaults to the server process working directory.',
          },
        },
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object' as const,
        properties: {
          filePath: { type: 'string' },
          passed: { type: 'boolean' },
          violations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                line: { type: 'number' },
                column: { type: 'number' },
                message: { type: 'string' },
                rule: { type: 'string' },
                severity: { type: 'string', enum: ['error', 'warning'] },
              },
              required: ['line', 'message', 'rule', 'severity'],
            },
          },
          readabilityScores: {
            type: 'object',
            properties: {
              fleschReadingEase: { type: 'number' },
              fleschKincaidGrade: { type: 'number' },
              sentenceCount: { type: 'number' },
              wordCount: { type: 'number' },
              avgWordsPerSentence: { type: 'number' },
            },
          },
          visualIdentity: {
            type: ['object', 'null'],
            description: 'Brand colors, fonts, and logo URLs from brand-guidelines.md, or null if not configured.',
          },
        },
        required: ['filePath', 'passed', 'violations'],
      },
    },
    {
      name: 'apply_suggestions',
      title: 'Apply Brand Voice Fixes',
      description:
        'Apply safe word-level substitutions to a Markdown file to fix common brand-voice violations. ' +
        'Replaces forbidden and avoid terms with brand-approved alternatives ' +
        '(e.g. "utilize" → "use", "leverage" → "use", removes "simply"). ' +
        'Use dryRun: true first to preview changes as a diff, then re-run without dryRun to apply. ' +
        'Does not fix sentence length, passive voice, or readability — those require manual editing.',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      inputSchema: {
        type: 'object' as const,
        properties: {
          file: {
            type: 'string',
            description:
              'Absolute or cwd-relative path to the .md or .mdx file to fix.',
          },
          dryRun: {
            type: 'boolean',
            description:
              'When true, return a unified diff of proposed changes without writing the file. ' +
              'Defaults to false (writes changes immediately).',
          },
        },
        required: ['file'],
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object' as const,
        properties: {
          dryRun: { type: 'boolean' },
          diff: { type: 'string', description: 'Unified diff (only present when dryRun is true).' },
          filePath: { type: 'string', description: 'Absolute path of the modified file (only present when dryRun is false).' },
          changes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                term: { type: 'string' },
                replacement: { type: ['string', 'null'] },
                count: { type: 'number' },
              },
              required: ['term', 'replacement', 'count'],
            },
          },
          message: { type: 'string' },
        },
        required: ['changes'],
      },
    },
  ],
}));

// ---------------------------------------------------------------------------
// Tool call handler
// ---------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // -------------------------------------------------------------------------
  // analyze_readability
  // -------------------------------------------------------------------------
  if (name === 'analyze_readability') {
    const { file, text, cwd } = (args ?? {}) as {
      file?: string;
      text?: string;
      cwd?: string;
    };

    if (!file && !text) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'At least one of "file" or "text" must be provided.',
            }),
          },
        ],
        isError: true,
      };
    }

    const workDir = cwd ? resolve(cwd) : process.cwd();
    const guidelines = loadGuidelines(workDir);

    if (!guidelines) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error:
                'No brand-guidelines.md found. Run `brand-voice setup` to create one.',
            }),
          },
        ],
        isError: true,
      };
    }

    let content: string;
    let filePath: string;

    if (file) {
      const absPath = resolve(workDir, file);
      try {
        content = readFileSync(absPath, 'utf-8');
        filePath = absPath;
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Cannot read file: ${absPath}. ${String(err)}`,
              }),
            },
          ],
          isError: true,
        };
      }
    } else {
      content = text!;
      filePath = 'inline';
    }

    const result = analyzeText(content, filePath, guidelines);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            filePath: result.filePath,
            passed: result.passed,
            violations: result.violations,
            readabilityScores: result.readabilityScores,
            visualIdentity: guidelines.visualIdentity ?? null,
          }),
        },
      ],
    };
  }

  // -------------------------------------------------------------------------
  // apply_suggestions
  // -------------------------------------------------------------------------
  if (name === 'apply_suggestions') {
    const { file, dryRun = false } = (args ?? {}) as {
      file: string;
      dryRun?: boolean;
    };

    const absPath = resolve(process.cwd(), file);

    let original: string;
    try {
      original = readFileSync(absPath, 'utf-8');
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: `Cannot read file: ${absPath}. ${String(err)}`,
            }),
          },
        ],
        isError: true,
      };
    }

    // Merge built-in replacements with any vocabulary.avoid terms from guidelines.
    // Guidelines are loaded from the file's directory so replacements are context-aware.
    const guidelines = loadGuidelines(dirname(absPath));
    const replacements: Record<string, string | null> = { ...BUILTIN_REPLACEMENTS };

    if (guidelines?.vocabulary?.avoid) {
      for (const term of guidelines.vocabulary.avoid) {
        if (!(term in replacements)) {
          // No inferred replacement available for generic avoid terms.
          replacements[term] = null;
        }
      }
    }

    const { updated, changes } = applySubstitutions(original, replacements);

    if (dryRun) {
      const diff = buildDiff(original, updated, absPath);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ dryRun: true, diff, changes }),
          },
        ],
      };
    }

    if (changes.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              filePath: absPath,
              changes: [],
              message: 'No substitutions needed.',
            }),
          },
        ],
      };
    }

    try {
      writeFileSync(absPath, updated, 'utf-8');
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: `Cannot write file: ${absPath}. ${String(err)}`,
            }),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            filePath: absPath,
            changes,
            message: `Applied ${changes.length} substitution(s).`,
          }),
        },
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Unknown tool
  // -------------------------------------------------------------------------
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: `Unknown tool: ${name}` }),
      },
    ],
    isError: true,
  };
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
