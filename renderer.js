// Renderer that mirrors pi-tui's Markdown component exactly
// Uses `marked` as the parser (same as pi-tui)

import { marked, Lexer, Parser } from "marked";
import { createTheme } from "./theme.js";
import { extractUrls } from "./hyperlinks.js";
import cliHighlight from "cli-highlight";

function stripAnsi(input) {
  return input.replace(/\x1b\[[0-9;]*m/g, "");
}

function repeatChar(char, count) {
  return char.repeat(count);
}

// East Asian Width: characters that display as double-width in terminals
// Ambiguous-width chars (like Chinese) are treated as double-width when in
// an East Asian locale or when the terminal supports it.
function isEastAsianWide(char) {
  const code = char.codePointAt(0);
  if (code === undefined) return false;
  // CJK Unified Ideographs, Hiragana, Katakana, Hangul
  if (code >= 0x1100 && code <= 0x115F) return true;  // Hangul Jamo
  if (code >= 0x2E80 && code <= 0x303E) return true;  // CJK Radicals Supplement..CJK Symbols
  if (code >= 0x3040 && code <= 0xA4CF) return true;  // Hiragana..Yi
  if (code >= 0xAC00 && code <= 0xD7A3) return true;  // Hangul Syllables
  if (code >= 0xF900 && code <= 0xFAFF) return true;  // CJK Compatibility Ideographs
  if (code >= 0xFE10 && code <= 0xFE1F) return true;  // Vertical forms
  if (code >= 0xFE30 && code <= 0xFE6F) return true;  // CJK Compatibility Forms..Small Form Variants
  if (code >= 0xFF00 && code <= 0xFF60) return true;  // Fullwidth Forms
  if (code >= 0xFFE0 && code <= 0xFFE6) return true;  // Fullwidth Forms
  if (code >= 0x20000 && code <= 0x2FFFD) return true;  // CJK Unified Ideographs Extension B..
  if (code >= 0x30000 && code <= 0x3FFFD) return true;  // CJK Unified Ideographs Extension G..
  return false;
}

// Get visible column width of text (accounting for East Asian double-width and ANSI codes)
function textWidth(text) {
  const clean = stripAnsi(text);
  let width = 0;
  for (const char of clean) {
    width += isEastAsianWide(char) ? 2 : 1;
  }
  return width;
}

// Pad string to display width (not character count) — critical for East Asian chars
function padEndWidth(text, width) {
  const clean = stripAnsi(text);
  const currentWidth = textWidth(clean);
  return text + " ".repeat(Math.max(0, width - currentWidth));
}

function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

// Syntax highlighting theme — VS Code dark/light
function makeSyntaxTheme(light = false) {
  const hex = (h) => {
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return (text) => `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
  };

  if (light) {
    return {
      keyword: hex("#AF00DB"),
      built_in: hex("#267F99"),
      literal: hex("#0000FF"),
      number: hex("#098658"),
      string: hex("#A31515"),
      comment: hex("#008000"),
      function: hex("#795E26"),
      title: hex("#795E26"),
      params: hex("#001080"),
      attr: hex("#C50000"),
      variable: hex("#001080"),
      default: (text) => text,
    };
  }

  return {
    keyword: hex("#C586C0"),
    built_in: hex("#4EC9B0"),
    literal: hex("#569CD6"),
    number: hex("#B5CEA8"),
    string: hex("#CE9178"),
    comment: hex("#6A9955"),
    function: hex("#DCDCAA"),
    title: hex("#DCDCAA"),
    params: hex("#9CDCFE"),
    attr: hex("#9CDCFE"),
    variable: hex("#9CDCFE"),
    default: (text) => text,
  };
}

function highlightCode(code, lang, syntaxTheme) {
  try {
    return cliHighlight.highlight(code, {
      language: lang || undefined,
      theme: syntaxTheme,
    }).split("\n");
  } catch {
    return code.split("\n");
  }
}

// Detect if a code block looks like ASCII art (box drawing, no common code keywords)
function isAsciiArt(code) {
  const lines = code.split("\n");
  if (lines.length < 3) return false;
  const boxChars = /[┌┬┐├┼┤└┴┘─│■□▪▫●○◦]+/;
  let boxLineCount = 0;
  for (const line of lines) {
    if (boxChars.test(line)) boxLineCount++;
  }
  return boxLineCount >= lines.length * 0.3;
}

export function createMarkdownRenderer(options = {}) {
  const theme = createTheme(options.dark !== undefined ? options.dark : null);
  const dark = theme.dark;
  const syntaxTheme = makeSyntaxTheme(!dark);
  const CODE_INDENT = "  ";



  // ========================
  // INLINE RENDERER
  // Returns styled string (no newlines from block-level)
  // ========================
  function renderInline(tokens) {
    if (!tokens) return "";
    let result = "";

    for (const token of tokens) {
      switch (token.type) {
        case "text": {
          if (token.tokens && token.tokens.length > 0) {
            result += renderInline(token.tokens);
          } else {
            result += decodeEntities(token.text);
          }
          break;
        }
        case "strong":
        case "bold": {
          const raw = renderInlineRaw(token.tokens || []);
          result += theme.bold(raw);
          break;
        }
        case "em":
        case "italic": {
          const raw = renderInlineRaw(token.tokens || []);
          result += theme.italic(raw);
          break;
        }
        case "codespan": {
          result += theme.code(token.text);
          break;
        }
        case "link": {
          const text = renderInlineRaw(token.tokens || []);
          const href = token.href || "";
          // Decode HTML entities in href for display
          const displayHref = decodeEntities(href);
          if (!href || text === href || text === displayHref || text === displayHref.replace(/^mailto:/, "")) {
            result += theme.link(theme.underline(text));
          } else {
            result += theme.link(theme.underline(text)) + theme.linkUrl(` (${displayHref})`);
          }
          break;
        }
        case "br": {
          result += "\n";
          break;
        }
        case "del": {
          const raw = renderInlineRaw(token.tokens || []);
          result += theme.strikethrough(raw);
          break;
        }
        case "html": {
          // Inline HTML — decode entities and strip tags
          result += decodeEntities(token.raw || "");
          break;
        }
        default: {
          if (token.text) {
            result += token.text;
          }
        }
      }
    }
    return result;
  }

  // Render inline tokens but return plain text (no ANSI codes)
  // Used when we need to re-apply styling from scratch
  function renderInlineRaw(tokens) {
    if (!tokens) return "";
    let result = "";
    for (const token of tokens) {
      switch (token.type) {
        case "text": {
          if (token.tokens && token.tokens.length > 0) {
            result += renderInlineRaw(token.tokens);
          } else {
            result += decodeEntities(token.text);
          }
          break;
        }
        case "strong":
        case "bold":
        case "em":
        case "italic":
        case "del": {
          result += renderInlineRaw(token.tokens || []);
          break;
        }
        case "codespan": {
          // Include backticks in raw text so width calculation matches display
          result += "`" + token.text + "`";
          break;
        }
        case "link": {
          result += renderInlineRaw(token.tokens || []);
          break;
        }
        case "br": {
          result += "\n";
          break;
        }
        default: {
          if (token.text) result += decodeEntities(token.text);
        }
      }
    }
    return result;
  }

  // ========================
  // BLOCK TOKEN RENDERERS
  // ========================

  function renderHeading(token) {
    const depth = token.depth;
    // Get plain text without ANSI codes
    const text = renderInlineRaw(token.tokens);
    const prefix = "#".repeat(depth) + " ";

    let styled;
    if (depth === 1) {
      styled = theme.heading(theme.bold(theme.underline(text)));
    } else if (depth === 2) {
      // H2: prefix NOT shown, just the text
      styled = theme.heading(theme.bold(text));
    } else {
      // H3+: prefix shown
      styled = theme.heading(theme.bold(prefix) + theme.bold(text));
    }
    return styled + "\n";
  }

  function renderParagraph(token) {
    return renderInline(token.tokens) + "\n";
  }

  function renderCode(token) {
    const lang = token.lang || "";
    const raw = token.text.trimEnd();
    const isArt = isAsciiArt(raw);

    const lines = isArt
      ? raw.split("\n")
      : highlightCode(raw, lang, syntaxTheme);

    const fenceOpen = `\`\`\`${lang}`;

    // Code styling: just foreground color, no background (matches TUI)
    const codeStyle = (line) => theme.codeBlock(line);

    let result = theme.codeBlockBorder(fenceOpen) + "\n";
    for (const line of lines) {
      result += CODE_INDENT + codeStyle(line) + "\n";
    }
    result += theme.codeBlockBorder("```") + "\n";
    return result;
  }

  function renderBlockquote(token) {
    const lines = [];
    const quoteStyle = (text) => theme.quote(theme.italic(text));

    for (const childToken of token.tokens) {
      if (childToken.type === "paragraph") {
        const text = renderInline(childToken.tokens);
        // Strip HTML paragraph tags if present
        const clean = text.replace(/<\/?p>/g, "");
        for (const ln of clean.split("\n")) {
          if (ln.trim()) {
            lines.push(theme.quoteBorder("│ ") + quoteStyle(ln));
          }
        }
      } else if (childToken.type === "list") {
        // Nested list inside blockquote
        const listLines = renderListToken(childToken, 0);
        for (const ln of listLines) {
          lines.push(theme.quoteBorder("│ ") + quoteStyle(ln));
        }
      } else if (childToken.type === "code") {
        // Code block inside blockquote
        const codeResult = renderCode(childToken);
        for (const ln of codeResult.split("\n")) {
          if (ln.trim()) lines.push(theme.quoteBorder("│ ") + quoteStyle(ln));
        }
      }
    }

    // Remove trailing empty lines
    while (lines.length > 0 && !lines[lines.length - 1].trim()) {
      lines.pop();
    }
    return lines.join("\n") + "\n";
  }

  function renderListToken(token, depth) {
    const indent = "  ".repeat(depth);
    const result = [];
    const startNum = token.start ?? 1;

    for (let i = 0; i < (token.items || []).length; i++) {
      const item = token.items[i];
      const number = startNum + i;
      const bullet = token.ordered ? `${number}. ` : "- ";
      const itemLines = renderListItem(item, depth);

      for (let j = 0; j < itemLines.length; j++) {
        const line = itemLines[j];
        if (j === 0) {
          result.push(indent + theme.listBullet(bullet) + line);
        } else {
          result.push(indent + "  " + line);
        }
      }
    }
    return result;
  }

  function renderListItem(item, parentDepth) {
    const lines = [];
    const tokens = item.tokens || [];

    for (const tok of tokens) {
      if (tok.type === "text") {
        lines.push(renderInline(tok.tokens || []));
      } else if (tok.type === "paragraph") {
        lines.push(renderInline(tok.tokens || []));
      } else if (tok.type === "list") {
        const nested = renderListToken(tok, parentDepth + 1);
        lines.push(...nested);
      } else if (tok.type === "code") {
        lines.push(theme.codeBlockBorder("```" + (tok.lang || "")));
        for (const l of tok.text.split("\n")) {
          lines.push(CODE_INDENT + theme.codeBlock(l));
        }
        lines.push(theme.codeBlockBorder("```"));
      }
    }
    return lines;
  }

  function renderTable(token) {
    const header = token.header;
    const rows = token.rows;
    const numCols = header.length;
    if (numCols === 0) return "";

    // Use terminal width if available, default to 120 (matches TUI)
    const termWidth = process.stdout.columns || 120;
    const width = Math.min(termWidth, 200);
    const borderOverhead = 3 * numCols + 1;
    const available = Math.max(1, width - borderOverhead);

    // Compute natural widths from header and rows
    const naturalWidths = header.map((h) => textWidth(renderInlineRaw(h.tokens || [])));
    for (const row of rows) {
      for (let i = 0; i < row.length; i++) {
        naturalWidths[i] = Math.max(
          naturalWidths[i] || 0,
          textWidth(renderInlineRaw(row[i].tokens || []))
        );
      }
    }

    const totalNatural = naturalWidths.reduce((a, b) => a + b, 0);

    let colWidths;
    if (totalNatural <= available) {
      // Content fits — use natural widths, distribute remaining space proportionally
      colWidths = [...naturalWidths];
      const extra = available - totalNatural;
      if (extra > 0) {
        // Distribute extra space proportionally by natural width
        for (let i = 0; i < numCols; i++) {
          colWidths[i] += Math.round((naturalWidths[i] / totalNatural) * extra);
        }
        // Fix rounding errors
        const used = colWidths.reduce((a, b) => a + b, 0);
        let diff = available - used;
        for (let i = 0; diff !== 0 && i < numCols; i++) {
          colWidths[i] += diff > 0 ? 1 : -1;
          diff += diff > 0 ? -1 : 1;
        }
      }
    } else {
      // Content too wide — scale down proportionally, min width is 3
      colWidths = naturalWidths.map((w) =>
        Math.max(3, Math.floor((w / totalNatural) * available))
      );
    }

    // Pad a potentially ANSI-styled string to display width
    // Strategy: ANSI codes consume 0 visual width but add bytes. We need to
    // inject padding AFTER the styled content, before any trailing reset codes.
    // If there are trailing reset codes (like \x1b[39m), inject spaces before them.
    // Otherwise just append spaces at the end.
    const padStyledToWidth = (styled, targetWidth) => {
      const clean = stripAnsi(styled);
      const currentWidth = textWidth(clean);
      const padding = " ".repeat(Math.max(0, targetWidth - currentWidth));
      if (padding.length === 0) return styled;
      // Inject padding AFTER trailing reset codes (e.g. \x1b[39m at end)
      // so padding whitespace stays unstyled: "\x1b[38;5;130mtext\x1b[39m  "
      return styled.replace(/(\x1b\[[0-9;]*m)*$/, "$&" + padding);
    };

    // Build a row: │ content │ with leading space after │
    // Padding is injected after styled content (before trailing reset codes)
    const makeRow = (cells, boldFirst) =>
      "│ " +
      cells
        .map((c, i) => {
          const styled = boldFirst && i === 0 ? theme.bold(c) : c;
          return padStyledToWidth(styled, colWidths[i]);
        })
        .join(" │ ") +
      " │";

    // Borders: raw ─ chars (no ANSI color, matching TUI)
    const makeBorder = (joinChar) =>
      colWidths.map((w) => repeatChar("─", w)).join(joinChar);

    const top = "┌─" + makeBorder("─┬─") + "─┐";
    const sep = "├─" + makeBorder("─┼─") + "─┤";
    const bot = "└─" + makeBorder("─┴─") + "─┘";

    // Top border: raw (no color)
    let result = top + "\n";
    result += makeRow(header.map((h) => renderInline(h.tokens || [])), true) + "\n";
    result += sep + "\n";

    for (let ri = 0; ri < rows.length; ri++) {
      const rowTexts = rows[ri].map((r) => renderInline(r.tokens || []));
      result += makeRow(rowTexts, false) + "\n";
      if (ri < rows.length - 1) {
        result += sep + "\n";
      }
    }
    result += bot + "\n";
    return result;
  }

  function renderHr() {
    return theme.hr("─".repeat(80)) + "\n";
  }

  function renderHtml(token) {
    // Block HTML — decode entities and return as text
    return decodeEntities((token.raw || "").trim()) + "\n";
  }

  function renderSpace() {
    return "";
  }

  // ========================
  // TOKEN WALKER
  // ========================
  function walkTokens(tokens) {
    if (!tokens) return "";
    let result = "";

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const next = tokens[i + 1];

      switch (token.type) {
        case "heading":
          result += renderHeading(token);
          if (next && next.type !== "space") result += "\n";
          break;
        case "paragraph":
          result += renderParagraph(token);
          if (next && next.type !== "list" && next.type !== "space") result += "\n";
          break;
        case "code":
          result += renderCode(token);
          if (next && next.type !== "space") result += "\n";
          break;
        case "blockquote":
          result += renderBlockquote(token);
          if (next && next.type !== "space") result += "\n";
          break;
        case "list":
          result += renderListToken(token, 0).join("\n") + "\n";
          if (next && next.type !== "space") result += "\n";
          break;
        case "table":
          result += renderTable(token);
          if (next && next.type !== "space") result += "\n";
          break;
        case "hr":
          result += renderHr();
          if (next && next.type !== "space") result += "\n";
          break;
        case "html":
          result += renderHtml(token);
          break;
        case "space":
          result += "\n";
          break;
        case "text": {
          // Inlines only — but if we get a raw text token at block level, render it
          result += renderInline(token.tokens || [token]);
          break;
        }
        default:
          if (token.raw) {
            result += token.raw;
          }
      }
    }

    return result;
  }

  function renderMarkdownInner(markdown) {
    if (!markdown || !markdown.trim()) return "";

    // Normalize: replace <br> with newlines, tabs with spaces
    const normalized = markdown
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/\t/g, "   ")
      .replace(/\r\n/g, "\n");

    const tokens = Lexer.lex(normalized);
    return walkTokens(tokens);
  }

  return {
    md: { render: renderMarkdownInner },
    theme,
    render: renderMarkdownInner,
  };
}

export function renderMarkdown(markdown, options = {}) {
  const { render } = createMarkdownRenderer(options);
  return render(markdown);
}
