/** @codemaku/arcade — public runtime API. */

export function $(id: string): HTMLElement | null;
export function clamp(v: number, min: number, max: number): number;
export function esc(s: unknown): string;

export function readJSON<T = unknown>(key: string, fallback?: T): T;
export function writeJSON(key: string, value: unknown): boolean;
export function removeStored(key: string): void;

export function haptic(pattern: number | number[]): void;

export interface CreateThemeOptions {
  /** localStorage key. Default `"arcade_theme"`. */
  storageKey?: string;
  /** Options in cycle order. Default `["auto", "light", "dark"]`. */
  themes?: string[];
  /** Preference used when nothing valid is stored. Default `"auto"`. */
  defaultTheme?: string;
  /** Map resolved theme → `<meta name="theme-color">` value. */
  colors?: Record<string, string>;
  /** Called with the resolved theme and the stored preference. */
  onChange?: (theme: string, pref: string) => void;
}

export interface ThemeController {
  readonly pref: string;
  readonly theme: string;
  readonly themes: string[];
  apply(): string;
  cycle(): string;
  set(pref: string): string;
  destroy(): void;
}

export function createTheme(options?: CreateThemeOptions): ThemeController;

export interface InstallPWAOptions {
  name?: string;
  shortName?: string;
  background?: string;
  theme?: string;
  startUrl?: string;
  size?: number;
  /** Draw the icon onto a `size × size` canvas context. */
  icon?: (ctx: CanvasRenderingContext2D, size: number) => void;
}

export function installPWA(options?: InstallPWAOptions): boolean;
