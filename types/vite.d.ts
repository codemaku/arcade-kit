import type { Plugin, UserConfig } from "vite";

export interface OfflineOptions {
  /** Worker file written to the output folder. Default `"sw.js"`. */
  filename?: string;
  /** Add a registration script to each built HTML page. Default true. */
  register?: boolean;
  /** Built files (globs relative to outDir, or RegExps) not to precache. */
  exclude?: Array<string | RegExp>;
  /** Extra absolute URLs (e.g. on a CDN) to cache at install, best effort. */
  urls?: string[];
  /** Page served for offline navigations that aren't cached. Default `"index.html"`. */
  fallback?: string;
  /** Milliseconds to wait for the network on page loads before using the cache. Default 3000. */
  timeout?: number;
  /** Files larger than this many bytes are not precached. Default 10 MB. */
  maxFileSize?: number;
}

export interface ArcadeOptions extends UserConfig {
  /** Inline everything into one HTML file. Default true. */
  singlefile?: boolean;
  /** Build a precaching service worker so the game works offline. Default false. */
  offline?: boolean | OfflineOptions;
  /** Extra Vite plugins, appended after the single-file plugin. */
  plugins?: UserConfig["plugins"];
  /** Merged into the generated `build` block. */
  build?: UserConfig["build"];
}

/**
 * Return a Vite config with the Codemaku defaults. Wrap it yourself:
 * `defineConfig(arcade())`.
 */
export function arcade(options?: ArcadeOptions): UserConfig;

/**
 * The offline service worker plugin on its own, for projects that don't use
 * the `arcade()` preset: `plugins: [react(), offline()]`.
 */
export function offline(options?: OfflineOptions): Plugin;
