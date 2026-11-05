#!/usr/bin/env node
/*! @codemaku/arcade/tools — post-build obfuscation. © 2026 Codemaku. */

// Post-build pass: take the built single-file HTML (already minified by
// terser) and obfuscate its inline scripts.
//
// Usage:
//   arcade-obfuscate [file] [--banner=src/main.js] [--no-banner]
//
// Defaults: file = dist/index.html, banner = src/main.js when it exists.

import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import JavaScriptObfuscator from "javascript-obfuscator";

const OBFUSCATOR_OPTIONS = {
  compact: true,
  target: "browser",
  sourceType: "module",

  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  renameProperties: false, // breaks DOM props and localStorage keys

  stringArray: true,
  stringArrayThreshold: 0.85,
  stringArrayEncoding: ["base64"],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayIndexShift: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersType: "variable",
  splitStrings: true,
  splitStringsChunkLength: 6,

  numbersToExpressions: true,
  simplify: true,
  selfDefending: true,

  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,

  disableConsoleOutput: false,
  unicodeEscapeSequence: false,
};

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("-")) || "dist/index.html";
const bannerArg = args.find((a) => a.startsWith("--banner="));
const noBanner = args.includes("--no-banner");
const bannerFile = bannerArg
  ? bannerArg.slice("--banner=".length)
  : "src/main.js";

if (!existsSync(file)) {
  console.error(`arcade-obfuscate: ${file} not found — run the build first.`);
  process.exit(1);
}

const html = readFileSync(file, "utf8");

// The obfuscator drops comments, so restore the copyright banner afterwards.
const BANNER =
  !noBanner && existsSync(bannerFile)
    ? (readFileSync(bannerFile, "utf8").match(/^\/\*![\s\S]*?\*\//) || [""])[0]
    : "";

let count = 0;
const out = html.replace(
  /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g,
  (match, open, body, close) => {
    if (!body.trim() || /\bsrc=/.test(open)) return match;
    const result = JavaScriptObfuscator.obfuscate(
      body,
      OBFUSCATOR_OPTIONS,
    ).getObfuscatedCode();
    count += 1;
    return (BANNER ? open + BANNER + "\n" : open) + result + close;
  },
);

if (!count) {
  console.error(
    "arcade-obfuscate: no inline script found — did vite-plugin-singlefile run?",
  );
  process.exit(1);
}

writeFileSync(file, out);

// A source map in dist would undo the obfuscation.
const distDir = file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : ".";
try {
  for (const f of readdirSync(distDir)) {
    if (f.endsWith(".map")) {
      console.warn(
        `WARNING: ${f} present in ${distDir} — remove it before publishing.`,
      );
    }
  }
} catch {
  /* ignore */
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
console.log(`obfuscated ${count} script block(s)`);
console.log(`  html: ${kb(html.length)} -> ${kb(out.length)}`);
