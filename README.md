# omd

Render markdown files with ANSI terminal styling — syntax-highlighted code blocks, tables, and OSC 8 clickable hyperlinks.

## Installation

```bash
npm install -g omd
```

Or install from source:

```bash
npm install -g .
```

## Usage

```bash
# Render a file
omd README.md

# Render from stdin
cat README.md | omd

# Force dark/light theme
omd --dark README.md
omd --light README.md

# Disable hyperlinks
omd --no-hyperlinks README.md
```

## Features

- **Syntax-highlighted code blocks** — Uses `cli-highlight` with a VS Code-inspired dark theme
- **OSC 8 terminal hyperlinks** — Clickable URLs in supporting terminals (iTerm2, Windows Terminal, etc.)
- **ANSI colors** — Auto-detects terminal light/dark mode; color palette inspired by [openclaw-tui](https://github.com/openclaw/openclaw)
- **Tables** — Properly aligned columns with East Asian character support
- **GFM support** — Tables, task lists, strikethrough

## Requirements

- Node.js 18+
- A terminal with 24-bit color support (most modern terminals)
- OSC 8 hyperlink support for clickable links (iTerm2, Windows Terminal, etc.)

## Architecture

```
omd/
├── omd.js          # CLI entry point
├── renderer.js     # Core rendering engine
├── theme.js        # Color themes (light/dark auto-detect)
└── hyperlinks.js   # OSC 8 terminal hyperlink extraction
```

**Data flow:**

```
Markdown file → marked (parser) → Lexer.lex() → renderer.js
  → theme.js (ANSI colors) → terminal output
```

**Dependencies:**
- `marked` — Markdown parser
- `cli-highlight` — Syntax highlighting for code blocks
