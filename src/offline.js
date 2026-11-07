/*! @codemaku/arcade/vite — offline service worker plugin. © 2026 Codemaku. */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const TEMPLATE = new URL("./offline-sw.js", import.meta.url);
const KIT_VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const toRegExps = (list) => [].concat(list || []).map((p) => (p instanceof RegExp ? p : globToRegExp(p)));

function globToRegExp(glob) {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\/?/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${re}$`);
}

/**
 * Vite plugin: after `vite build`, write `sw.js` into the output folder. The
 * worker precaches every built file (and the Google Fonts the HTML links to),
 * so the site works offline after one online visit. A registration script is
 * added to each built HTML page unless `register: false`.
 */
export function offline(options = {}) {
  const {
    filename = "sw.js",
    register = true,
    exclude = [],
    urls = [],
    fallback = "index.html",
    timeout = 3000,
    maxFileSize = 10 * 1024 * 1024,
  } = options;
  const skip = [/\.map$/, /(^|\/)\.[^/]+$/, globToRegExp(filename), ...toRegExps(exclude)];
  let outDir = "dist";

  return {
    name: "codemaku-arcade:offline",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    transformIndexHtml: {
      order: "post",
      handler() {
        if (!register) return;
        const src = JSON.stringify(`./${filename}`);
        return [
          {
            tag: "script",
            injectTo: "head",
            children:
              `if("serviceWorker"in navigator)addEventListener("load",function(){` +
              `navigator.serviceWorker.register(${src}).catch(function(){})})`,
          },
        ];
      },
    },
    writeBundle: {
      order: "post",
      sequential: true,
      handler() {
        const files = [];
        const hash = createHash("sha256").update(KIT_VERSION);
        const stylesheets = new Set();
        for (const full of walk(outDir).sort()) {
          const rel = relative(outDir, full).split(sep).join("/");
          if (skip.some((re) => re.test(rel))) continue;
          const body = readFileSync(full);
          if (body.length > maxFileSize) continue;
          files.push(rel);
          hash.update(rel).update(body);
          if (rel.endsWith(".html")) {
            const html = body.toString("utf8");
            for (const m of html.matchAll(/href=["']?(https:\/\/fonts\.googleapis\.com\/[^"'\s>]+)/g))
              stylesheets.add(m[1].replace(/&amp;/g, "&"));
          }
        }
        hash.update(JSON.stringify([urls, fallback, timeout]));
        const config = {
          version: hash.digest("hex").slice(0, 12),
          files,
          stylesheets: [...stylesheets],
          urls,
          fallback,
          timeout,
        };
        const sw = readFileSync(TEMPLATE, "utf8").replace(
          "const CFG = self.__ARCADE_OFFLINE__;",
          `const CFG = ${JSON.stringify(config, null, 1)};`,
        );
        writeFileSync(join(outDir, filename), sw);
      },
    },
  };
}
