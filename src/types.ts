/** Supported Node package managers, detected from their lockfile. */
export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

/** The kind of folder a deletion target represents. */
export type TargetKind = "next" | "next-cache" | "node_modules" | "turbo";

/** A single Next.js app discovered on disk, with its build output. */
export interface NextApp {
  /** Absolute path to the project root (the dir that owns the `.next`). */
  readonly dir: string;
  /** Absolute path to the `.next` folder. */
  readonly nextDir: string;
  /** Absolute path to `.next/cache`, if it exists. */
  readonly cacheDir: string | null;
  /** Human-friendly label for prompts (relative to the scan root). */
  readonly label: string;
}

/** A concrete folder scheduled for deletion. */
export interface DeleteTarget {
  readonly path: string;
  readonly kind: TargetKind;
  /** Size in bytes (best-effort; symlinked/unreadable entries counted as 0). */
  readonly size: number;
}

/** Where and how a `--full` reinstall would run. */
export interface InstallRoot {
  readonly dir: string;
  readonly pm: PackageManager;
  /** True when `dir` sits above the scan root (i.e. a parent workspace). */
  readonly aboveScanRoot: boolean;
}

/** Raw result of walking the filesystem below the scan root. */
export interface ScanResult {
  readonly nextDirs: string[];
  readonly nodeModulesDirs: string[];
  readonly turboDirs: string[];
}

/** Parsed + validated command-line options. */
export interface Options {
  readonly scanRoot: string;
  readonly full: boolean;
  readonly cache: boolean;
  readonly turbo: boolean;
  readonly build: boolean;
  readonly dryRun: boolean;
  readonly yes: boolean;
}
