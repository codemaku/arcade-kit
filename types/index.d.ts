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
  /** Preference used when nothing valid is stored. Default `"light"`. */
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

/* ---- brand ---- */

/** Where the Codemaku link points. */
export const HUB_URL: string;
/** The sprite wrench-C as an inline SVG string (`.arcade-logo`). */
export function logoSVG(variant?: "word" | "mark"): string;
/** Draw the sprite onto a square canvas of `size` px. Colours are fixed hex. */
export function drawLogo(
  ctx: CanvasRenderingContext2D,
  size: number,
  colors?: Partial<Record<"b" | "f" | "m", string>>,
): void;
export interface BrandOptions {
  /** Game name shown before "by". Omit for the bare wordmark. */
  title?: string;
  /** Link target. Default `HUB_URL`. */
  hub?: string;
  /** Open the hub in a new tab. Default false. */
  newTab?: boolean;
}
export function brandHTML(options?: BrandOptions): string;
export function mountBrand(
  target: string | HTMLElement,
  options?: BrandOptions,
): HTMLElement | null;

/* ---- header ---- */

/** True when the game is running inside the hub's in-app game view. */
export function inHub(): boolean;
/** True when this page was opened from the hub. */
export function cameFromHub(hub?: string): boolean;
/** Close the hub's game view, or open the hub (in a new tab when `newTab`). */
export function backToHub(options?: { hub?: string; newTab?: boolean }): void;

/** True when running as an installed home-screen app. */
export function isInstalled(): boolean;
/** Not installed, not in the hub, and the browser can install. */
export function canInstall(): boolean;
/** Show the browser's install prompt, or the iOS Add to Home Screen steps. */
export function promptInstall(): Promise<void>;

export interface HeaderAction {
  label: string;
  onClick: (e: MouseEvent) => void;
  ariaLabel?: string;
  /** Use the hot (accent red) button style. */
  hot?: boolean;
}
export interface HeaderOptions {
  /** Game name shown next to the CODEMAKU badge. */
  title?: string;
  /** Theme controller from `createTheme`. Omit to hide the theme button. */
  theme?: ThemeController;
  /** Button labels per theme preference. Default: the preference itself. */
  themeLabels?: Record<string, string>;
  /** Sound toggle. Omit to hide the sound button. */
  sound?: { get(): boolean; set(on: boolean): void };
  /** Extra game buttons, shown before sound and theme. */
  actions?: HeaderAction[];
  /** Show INSTALL when installable. Default true. */
  install?: boolean;
  /** Hub URL. Default `HUB_URL`. */
  hub?: string;
  /** Outside the hub's game view, open the hub in a new tab. Default true. */
  newTab?: boolean;
}
export interface HeaderController {
  readonly el: HTMLElement;
  /** Redraw, optionally with new options merged in. */
  update(options?: HeaderOptions): void;
  destroy(): void;
}
export function mountHeader(
  target: string | HTMLElement,
  options?: HeaderOptions,
): HeaderController | null;
