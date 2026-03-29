// OSC 8 hyperlink support — mirrors OpenClaw TUI algorithm

const SGR_PATTERN = "\\x1b\\[[0-9;]*m";
const OSC8_PATTERN = "\\x1b\\]8;;.*?(?:\\x07|\\x1b\\\\)";
const ANSI_RE = new RegExp(`${SGR_PATTERN}|${OSC8_PATTERN}`, "g");
const SGR_START_RE = new RegExp(`^${SGR_PATTERN}`);
const OSC8_START = "\\x1b\\]8;;";
const OSC8_END = "\\x07";

// Extract all unique URLs from raw markdown text
export function extractUrls(markdown) {
  const urls = new Set();

  // Markdown links [text](url)
  const mdLinkRe = /\[(?:[^\]]*)\]\(\s*<?(https?:\/\/[^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
  let m;
  while ((m = mdLinkRe.exec(markdown)) !== null) {
    urls.add(m[1]);
  }

  // Bare URLs
  const stripped = markdown.replace(
    /\[(?:[^\]]*)\]\(\s*<?https?:\/\/[^)\s>]+>?(?:\s+["'][^"']*["'])?\s*\)/g,
    ""
  );
  const bareRe = /https?:\/\/[^\s)\]>]+/g;
  while ((m = bareRe.exec(stripped)) !== null) {
    urls.add(m[0]);
  }

  return [...urls];
}

// Strip ANSI sequences to get visible text
function stripAnsi(input) {
  return input.replace(ANSI_RE, "");
}

// Find URL ranges in a line's visible text
function findUrlRanges(visibleText, knownUrls, pending = null) {
  const ranges = [];
  let newPending = null;
  let searchFrom = 0;

  if (pending) {
    // Check if a pending URL continues on this line
    const trimmed = visibleText.trimStart();
    const leadSpaces = visibleText.length - trimmed.length;
    // URL is considered broken across lines if it ends mid-word
    if (pending.url && visibleText[leadSpaces] && !/[\s]/.test(visibleText[leadSpaces])) {
      // It continues
      ranges.push({
        start: leadSpaces,
        end: leadSpaces + pending.url.length,
        url: pending.url,
      });
      searchFrom = leadSpaces + pending.url.length;
    }
  }

  // Find bare URLs
  const bareRe = /https?:\/\/[^\s)\]>]+/g;
  bareRe.lastIndex = searchFrom;
  let match;
  while ((match = bareRe.exec(visibleText)) !== null) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length,
      url: match[0],
    });
  }

  return { ranges, pending: newPending };
}

// Apply OSC 8 hyperlinks to a line
function applyOsc8Ranges(line, ranges, activeUrl = null) {
  if (ranges.length === 0) return { line, activeUrl };

  // Build sorted list of positions
  const positions = new Set();
  positions.add(0);
  positions.add(line.length);

  for (const r of ranges) {
    positions.add(r.start);
    positions.add(r.end);
  }

  const points = [...positions].sort((a, b) => a - b);

  let result = "";
  let pos = 0;
  let currentUrl = activeUrl;

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];

    // Check what starts at this position
    const opening = ranges.filter((r) => r.start === start);
    const closing = ranges.filter((r) => r.end === start);

    for (const r of closing) {
      if (currentUrl !== null) {
        result += "\x1B]8;;\x07";
        currentUrl = null;
      }
    }

    for (const r of opening) {
      result += `\x1b]8;;${r.url}\x07`;
      currentUrl = r.url;
    }

    result += line.slice(start, end);
  }

  // Close any remaining open hyperlink
  if (currentUrl !== null) {
    result += "\x1B]8;;\x07";
  }

  return { line: result, activeUrl: currentUrl };
}

// Add OSC 8 hyperlinks to rendered lines
export function addOsc8Hyperlinks(lines, urls, theme) {
  if (urls.length === 0) return lines;
  if (!process.stdout.isTTY) return lines; // Skip if not a TTY

  const visibleLines = lines.map(stripAnsi);
  let activeUrl = null;
  let pending = null;

  return lines.map((line, idx) => {
    const visible = visibleLines[idx];
    const { ranges } = findUrlRanges(visible, urls, pending);
    const { line: result } = applyOsc8Ranges(line, ranges, activeUrl);
    activeUrl = null; // Reset per line for simple approach
    return result;
  });
}

// Simple version: wrap URLs with OSC 8
export function addHyperlinksSimple(line, urls) {
  if (!process.stdout.isTTY || urls.length === 0) return line;

  let result = line;
  for (const url of urls) {
    // Only link bare URLs, not those already in markdown link format
    const bareRe = new RegExp(`(https?://[^\\s)\\]>]+)`, "g");
    result = result.replace(bareRe, `\x1b]8;;$1\x07$1\x1b]8;;\x07`);
  }
  return result;
}
