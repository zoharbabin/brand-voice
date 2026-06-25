---
name: brand-voice-setup
description: Set up brand voice enforcement in Claude Code. Reads an existing brand guidelines file or asks 4 questions to create one, then configures CLAUDE.md injection + PostToolUse hook + MCP server.
---

# Brand Voice Setup

You are helping the user set up brand voice enforcement. Follow this exact flow:

## Step 1: Check for existing guidelines

Look for a brand guidelines file in this order:
1. If the user provided a path as an argument (e.g., `/brand-voice-setup /path/to/file.md`): use that file
2. Check for `brand-guidelines.md` in the current directory
3. Check for `brand-guidelines.md` in `~/.claude/`
4. Ask the user: "Do you have a brand guidelines document I can read? If so, provide the path. Otherwise, I'll ask you 4 quick questions."

## Step 2A: If file found — extract and confirm

Read the file. Extract all brand-relevant sections: tone, vocabulary, voice, examples, **and** any colors, fonts, or logo URLs.

Show the user a summary:
```
I found these brand rules:
- Voice: [extracted tone adjectives]
- Avoid: [extracted forbidden/avoid terms]
- Brand terms: [extracted canonical names]
- Visual identity: [colors / fonts / logos found, or "not found"]
- Examples: [found / not found]

Missing: [list what's absent from the recommended schema]

Shall I generate a complete brand-guidelines.md from what I found? [yes / skip missing pieces]
```

If user says yes to missing pieces, ask only for the gaps (max 2 follow-up questions).

## Step 2B: If no file — interview or auto-research

Ask: "Do you have a company website or domain I can research? (e.g., acme.com) Or I can ask you 4 quick questions instead."

**If user provides a domain and the `brand_research` MCP tool is available:**

**Phase 1 — structured extraction:**
Call `brand_research` with `url: <domain>`, `depth: "full"`. From the response, map:
- `colors.primary`, `.secondary`, `.accent`, `.background`, `.text` → Visual Identity colors (hex strings)
- `logos.primary.url`, `logos.dark.url`, `logos.icon.url` → Visual Identity logo URLs
- `typography.heading.family`, `typography.body.family` → Visual Identity fonts
- `identity.name` → canonical brand-name spelling (add to Vocabulary Always use)

**Phase 2 — brand portal deep-read (if available):**
If the response includes a `brand_portal_resource` field (a `research://artifact/<hash>` URI):
1. Call `ReadMcpResourceTool` with `server: "web-researcher"` and `uri: <brand_portal_resource>` to read the brand portal index
2. Scan the returned content for navigation links whose labels suggest voice/tone/writing content — look for headings or links containing words like: "voice", "tone", "sound", "writing", "language", "style", "words", "grammar", "clarity", "warmth", "energy"
3. For each discovered sub-page URL (up to 6), call `scrape_page` with that URL and extract: tone descriptors, dos/don'ts, word choices, example sentences, and any explicit grammar or style rules
4. Synthesise all scraped sub-page content as the primary source for tone_of_voice — this is richer than the top-level response fields

**Phase 3 — fallback mapping (when no brand portal or sub-pages are found):**
Use top-level response fields:
- `tone_of_voice.summary` + `tone_of_voice.attributes` → Tone & Voice bullets
- `tone_of_voice.dos_and_donts.dos` → Vocabulary Always use; `dos_and_donts.donts` → Vocabulary Avoid

Show a summary of what was found and ask: "Does this look right? Any corrections or additions?"

**If no domain or `brand_research` is unavailable — 4-question interview:**

Ask these questions ONE AT A TIME, waiting for each answer:

1. "Who are you writing for? (e.g., customers, internal teams, executives, prospects)"
2. "Three words that describe your ideal writing voice?"
3. "Any words or phrases to avoid? (paste a list, or common ones like: leverage, synergy, utilize, simply, easy)"
4. "Optional: Paste a sentence that perfectly represents your voice. (Skip by pressing Enter)"

## Step 3: Determine scope

Ask: "Should this apply to:
1. This project only (writes to ./.claude/settings.json and ./CLAUDE.md)
2. All your Claude Code sessions (writes to ~/.claude/settings.json and ~/.claude/CLAUDE.md)"

Default: project scope if a git repo is detected, user scope otherwise.

## Step 4: Generate files

Generate and write these files:

### brand-guidelines.md
Write to ./brand-guidelines.md (project) or ~/.claude/brand-guidelines.md (user).
Use the recommended schema from the design brief. Keep under 600 words.
Include Quick Reference section at the end repeating the top 5 rules.

### CLAUDE.md injection
Inject the brand voice section into CLAUDE.md using delimiters:
`<!-- brand-voice:start — generated from brand-guidelines.md -->`
`<!-- brand-voice:end -->`

Format:
```markdown
<!-- brand-voice:start — generated from brand-guidelines.md -->
## Brand Voice
- Tone: [adjectives] — second person ("you"), active voice
- NEVER write: [forbidden terms as quoted comma-separated list]
- Sentences: under [N] words. Contractions [OK/avoid].
- Brand terms: [canonical spellings]
- Voice sample: "[best on-tone example sentence]"
- Brand colors: primary: [hex] · secondary: [hex] · accent: [hex]  ← omit if not set
- Fonts: headings: [name] · body: [name]  ← omit if not set
- Logo (light): [URL]  ← omit if not set
- Logo (dark): [URL]   ← omit if not set
<!-- brand-voice:end -->
```

### .claude/settings.json (PostToolUse hook)
Add the PostToolUse hook entry. Merge with existing settings — do not overwrite other hooks.
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{ "type": "command", "command": "brand-voice-check \"$CLAUDE_TOOL_OUTPUT_FILE\"", "timeout": 10000 }]
      }
    ]
  }
}
```

### .mcp.json (MCP server)
Add the brand-voice MCP server entry. Merge with existing .mcp.json.
```json
{
  "mcpServers": {
    "brand-voice": {
      "command": "npx",
      "args": ["brand-voice-mcp"]
    }
  }
}
```

## Step 5: Confirm and summarize

Show a final summary:
```
Brand voice setup complete.

Files written:
- brand-guidelines.md (your brand profile — edit this to update enforcement)
- CLAUDE.md (brand voice section injected)
- .claude/settings.json (PostToolUse hook registered)
- .mcp.json (MCP server added)

How it works:
- Every time I write or edit a .md file, the hook runs automatically and I correct any violations before saving.
- Use analyze_readability tool to check any text on demand.
- Run /brand-voice-setup again to update if your guidelines change.

To disable: remove the brand-voice-check entry from .claude/settings.json
```

## Claude Projects paste block

If the user mentions they use claude.ai (not Claude Code CLI), output this instead of writing files:

```
Paste this into your Claude Project instructions:

---
[Brand Voice]
Tone: [adjectives] — second person ("you"), active voice, sentences under [N] words
NEVER write: [forbidden terms]
Brand terms: [canonical spellings]  
Voice sample: "[on-tone example]"
---
```

## Important rules for this skill

- Ask questions one at a time. Don't dump all 4 questions at once.
- Extract all brand-relevant content from existing files — including colors, fonts, and logo URLs. Ignore grid specs, spacing values, and print production settings.
- The brand-guidelines.md MUST include a ## Quick Reference section at the end.
- Keep brand-guidelines.md under 600 words.
- Always merge settings.json and .mcp.json — never overwrite unrelated entries.
- If brand-voice is not installed globally, the user can install it with: npm install -g brand-voice (or use npx brand-voice@latest check to run without installing)
- For user-scope setup (no git repo), use ~/.claude/ for all files.
