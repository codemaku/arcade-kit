/*! @codemaku/arcade/vite — shared Vite preset. © 2026 Codemaku. */

import { viteSingleFile } from "vite-plugin-singlefile";
import { offline as offlinePlugin } from "./offline.js";

export { offlinePlugin as offline };

/**
 * Build a Vite config with the house defaults:
 * single-file output, terser, no source maps, CSS inlined.
 *
 * Usage:
 *   import { defineConfig } from "vite";
 *   import { arcade } from "@codemaku/arcade/vite";
 *   export default defineConfig(arcade());
 *
 * Pass any normal Vite options through the same object. `offline: true` (or
 * an options object, see `offline()`) adds a precaching service worker.
 */
export function arcade(options = {}) {
  const {
    singlefile = true,
    offline = false,
    plugins = [],
    build = {},
    ...config
  } = options;

  const { rollupOptions = {}, ...buildRest } = build;

  return {
    base: "./",
    ...config,
    plugins: [
      ...(singlefile
        ? [viteSingleFile({ removeViteModuleLoader: true })]
        : []),
      ...plugins,
      ...(offline ? [offlinePlugin(offline === true ? {} : offline)] : []),
    ],
    build: {
      target: "es2020",
      outDir: "dist",
      sourcemap: false,
      minify: "terser",
      cssCodeSplit: false,
      cssMinify: true,
      assetsInlineLimit: 100_000_000,
      reportCompressedSize: false,
      terserOptions: {
        compress: {
          passes: 3,
          drop_console: true,
          drop_debugger: true,
          pure_getters: true,
          unsafe_arrows: true,
        },
        mangle: {
          toplevel: true,
        },
        format: {
          comments: /^!/,
        },
      },
      ...buildRest,
      rollupOptions: {
        output: { inlineDynamicImports: true, ...(rollupOptions.output || {}) },
        ...rollupOptions,
      },
    },
  };
}
