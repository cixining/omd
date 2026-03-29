// Theme detection and palette — mirrors OpenClaw TUI behavior

const DARK_TEXT = "#E8E3D5";
const LIGHT_TEXT = "#1E1E1E";

const XTERM_LEVELS = [0, 95, 135, 175, 215, 255];

function channelToSrgb(value) {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminanceRgb(r, g, b) {
  return 0.2126 * channelToSrgb(r) + 0.7152 * channelToSrgb(g) + 0.0722 * channelToSrgb(b);
}

function relativeLuminanceHex(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return relativeLuminanceRgb(r, g, b);
}

function contrastRatio(background, foregroundHex) {
  const foreground = relativeLuminanceHex(foregroundHex);
  const lighter = Math.max(background, foreground);
  const darker = Math.min(background, foreground);
  return (lighter + 0.05) / (darker + 0.05);
}

function pickHigherContrastText(r, g, b) {
  const background = relativeLuminanceRgb(r, g, b);
  return (
    contrastRatio(background, LIGHT_TEXT) >= contrastRatio(background, DARK_TEXT)
  );
}

function isLightBackground() {
  const explicit = process.env.OPENCLAW_THEME?.toLowerCase();
  if (explicit === "light") return true;
  if (explicit === "dark") return false;

  const colorfgbg = process.env.COLORFGBG;
  if (colorfgbg && colorfgbg.length <= 64) {
    const sep = colorfgbg.lastIndexOf(";");
    const bg = parseInt(sep >= 0 ? colorfgbg.slice(sep + 1) : colorfgbg, 10);
    if (bg >= 0 && bg <= 255) {
      if (bg <= 15) return bg === 7 || bg === 15;
      if (bg >= 232) return bg >= 244;
      const cubeIndex = bg - 16;
      const bVal = XTERM_LEVELS[cubeIndex % 6];
      const gVal = XTERM_LEVELS[Math.floor(cubeIndex / 6) % 6];
      const rVal = XTERM_LEVELS[Math.floor(cubeIndex / 36)];
      return pickHigherContrastText(rVal, gVal, bVal);
    }
  }
  return false;
}

function fg(hex) {
  return (text) => `\x1b[38;2;${parseInt(hex.slice(1, 3), 16)};${parseInt(hex.slice(3, 5), 16)};${parseInt(hex.slice(5, 7), 16)}m${text}\x1b[39m`;
}

function hexToAnsi256(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Convert to ANSI 256 color
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round((r - 8) / 247 * 24) + 232;
  }
  return (
    16 +
    36 * Math.round(r / 51) +
    6 * Math.round(g / 51) +
    Math.round(b / 51)
  );
}

function fg256(hex) {
  const code = hexToAnsi256(hex);
  return (text) => `\x1b[38;5;${code}m${text}\x1b[39m`;
}

// Use 24-bit color if supported, fall back to 256-color
function makeFg(hex) {
  return (text) => `\x1b[38;2;${parseInt(hex.slice(1, 3), 16)};${parseInt(hex.slice(3, 5), 16)};${parseInt(hex.slice(5, 7), 16)}m${text}\x1b[39m`;
}

function makeBg(hex) {
  return (text) => `\x1b[48;2;${parseInt(hex.slice(1, 3), 16)};${parseInt(hex.slice(3, 5), 16)};${parseInt(hex.slice(5, 7), 16)}m${text}\x1b[49m`;
}

const lightPalette = {
  text: "#1E1E1E",
  dim: "#5B6472",
  accent: "#B45309",
  accentSoft: "#C2410C",
  border: "#5B6472",
  userBg: "#F3F0E8",
  userText: "#1E1E1E",
  systemText: "#4B5563",
  toolPendingBg: "#EFF6FF",
  toolSuccessBg: "#ECFDF5",
  toolErrorBg: "#FEF2F2",
  toolTitle: "#B45309",
  toolOutput: "#374151",
  quote: "#1D4ED8",
  quoteBorder: "#2563EB",
  code: "#92400E",
  codeBlock: "#1E1E1E",       // foreground text in code blocks
  codeBlockBg: "#F3F0E8",     // background for code blocks
  codeBorder: "#92400E",
  link: "#047857",
  error: "#DC2626",
  success: "#047857",
};

const darkPalette = {
  text: "#E8E3D5",
  dim: "#7B7F87",
  accent: "#F6C453",
  accentSoft: "#F2A65A",
  border: "#3C414B",
  userBg: "#2B2F36",
  userText: "#F3EEE0",
  systemText: "#9BA3B2",
  toolPendingBg: "#1F2A2F",
  toolSuccessBg: "#1E2D23",
  toolErrorBg: "#2F1F1F",
  toolTitle: "#F6C453",
  toolOutput: "#E1DACB",
  quote: "#8CC8FF",
  quoteBorder: "#3B4D6B",
  code: "#F0C987",
  codeBlock: "#E8E3D5",       // foreground text in code blocks (same as body text)
  codeBlockBg: "#1E232A",     // background for code blocks
  codeBorder: "#343A45",
  link: "#7DD3A5",
  error: "#DC2626",
  success: "#047857",
};

export function createTheme(forceDark = null) {
  const dark = forceDark === null ? !isLightBackground() : forceDark;
  const palette = dark ? darkPalette : lightPalette;
  const fg = makeFg(palette.text);

  return {
    heading: (text) => `\x1b[1m${makeFg(palette.accent)(text)}\x1b[22m`,
    link: (text) => makeFg(palette.link)(text),
    linkUrl: (text) => makeFg(palette.dim)(text),
    code: (text) => makeFg(palette.code)(text),
    codeBlock: (text) => makeFg(palette.codeBlock)(text),
    codeBlockBorder: (text) => makeFg(palette.codeBorder)(text),
    codeBlockBg: (text) => makeBg(palette.codeBlockBg)(text),
    quote: (text) => makeFg(palette.quote)(text),
    quoteBorder: (text) => makeFg(palette.quoteBorder)(text),
    quoteBg: (text) => makeBg(dark ? "#1a2332" : "#EFF6FF")(text),
    hr: (text) => makeFg(palette.border)(text),
    listBullet: (text) => makeFg(palette.accentSoft)(text),
    bold: (text) => `\x1b[1m${text}\x1b[22m`,
    italic: (text) => `\x1b[3m${text}\x1b[23m`,
    strikethrough: (text) => `\x1b[9m${text}\x1b[29m`,
    underline: (text) => `\x1b[4m${text}\x1b[24m`,
    dim: (text) => makeFg(palette.dim)(text),
    palette,
    dark,
  };
}

export { makeFg, makeBg };
