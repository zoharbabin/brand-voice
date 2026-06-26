---
name: Feature request
about: Suggest a new rule, capability, or workflow improvement
title: ''
labels: enhancement
assignees: ''
---

**What problem does this solve?**
Describe the use case. What are you trying to enforce or prevent that brand-voice doesn't handle today?

**Proposed behavior**
What should brand-voice do? Be as specific as possible — include example input and the output you'd expect.

**Example**

Input:
```markdown
<!-- the Markdown that should trigger or be affected -->
```

Expected output / behavior:
```
```

**Alternatives considered**
Any workarounds you've tried (e.g. `.brand-voice-ignore`, `<!-- brand-voice-disable-line -->`, custom guidelines rules)?

**Which entry point(s) would this affect?**
- [ ] PostToolUse hook (`brand-voice-check`)
- [ ] MCP server (`analyze_readability` / `apply_suggestions`)
- [ ] CLI (`brand-voice check`)
- [ ] Setup skill (`/brand-voice-setup`)
- [ ] `brand-guidelines.md` schema / parser
