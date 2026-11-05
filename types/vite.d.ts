import type { UserConfig } from "vite";

export interface ArcadeOptions extends UserConfig {
  /** Inline everything into one HTML file. Default true. */
  singlefile?: boolean;
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
