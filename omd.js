#!/usr/bin/env node

// omd — Render markdown files with ANSI terminal styling

import { readFileSync } from "fs";
import { resolve, extname } from "path";
import { renderMarkdown } from "./renderer.js";
import { createTheme } from "./theme.js";

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const files = args.filter((a) => !a.startsWith("--"));

// Use null for auto, true/false for explicit mode
const dark = flags.includes("--dark") ? true : flags.includes("--light") ? false : null;
const noLinks = flags.includes("--no-hyperlinks");

async function main() {
  let markdown;

  if (files.length > 0) {
    const filePath = resolve(files[0]);
    try {
      markdown = readFileSync(filePath, "utf-8");
    } catch (err) {
      console.error(`Error: Could not read file "${filePath}"`);
      process.exit(1);
    }

    const theme = createTheme(dark);
    const width = process.stdout.columns || 80;
    const label = filePath;
    const pad = width - label.length - 6;

    console.log(
      theme.codeBlockBorder("┌") +
        "─".repeat(Math.floor(pad / 2)) +
        " " +
        label +
        " " +
        "─".repeat(Math.ceil(pad / 2)) +
        "┐"
    );

    const result = renderMarkdown(markdown, {
      dark,
      hyperlinks: !noLinks,
    });
    process.stdout.write(result);

    console.log(theme.codeBlockBorder("└" + "─".repeat(width - 2) + "┘"));
  } else {
    // Read from stdin
    process.stdin.setEncoding("utf-8");
    let data = "";
    for await (const chunk of process.stdin) {
      data += chunk;
    }
    if (!data.trim()) process.exit(0);
    markdown = data;

    const result = renderMarkdown(markdown, {
      dark,
      hyperlinks: !noLinks,
    });
    process.stdout.write(result);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
