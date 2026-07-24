import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type {
  InstallRoot,
  NextApp,
  PackageManager,
  ScanResult,
} from "./types.js";

/**
 * Walk `scanRoot` downward, collecting `.next`, `node_modules`, and `.turbo`
 * directories. Target folders are recorded but never descended into, and
 * symlinked directories are never followed (`Dirent.isDirectory()` is false for
 * symlinks). `.git` is skipped for speed and safety.
 */
export function scan(scanRoot: string): ScanResult {
  const nextDirs: string[] = [];
  const nodeModulesDirs: string[] = [];
  const turboDirs: string[] = [];

  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable dir (permissions, race) — skip silently
    }
    for (const entry of entries) {
      // Only real directories are candidates; this skips files AND symlinks.
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      switch (entry.name) {
        case "node_modules":
          nodeModulesDirs.push(full);
          continue; // record, never descend
        case ".next":
          nextDirs.push(full);
          continue;
        case ".turbo":
          turboDirs.push(full);
          continue;
        case ".git":
          continue; // never descend into VCS internals
        default:
          walk(full);
      }
    }
  };

  walk(path.resolve(scanRoot));
  return { nextDirs, nodeModulesDirs, turboDirs };
}

const NEXT_CONFIGS = [
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "next.config.cjs",
];

/**
 * A `.next` folder only counts if it sits beside a real Next.js project: a
 * `next.config.*`, or a `package.json` that depends on `next`. Prevents nuking
 * some unrelated folder that merely happens to be named `.next`.
 */
export function isNextProject(dir: string): boolean {
  for (const config of NEXT_CONFIGS) {
    if (existsSync(path.join(dir, config))) return true;
  }
  const pkgPath = path.join(dir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      if (pkg.dependencies?.["next"] || pkg.devDependencies?.["next"]) {
        return true;
      }
    } catch {
      /* malformed package.json — treat as not-a-project */
    }
  }
  return false;
}

/** Recursively sum the size of real files under `dir` (symlinks not followed). */
export function dirSize(dir: string): number {
  let total = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += dirSize(full);
    } else if (entry.isFile()) {
      try {
        total += statSync(full).size;
      } catch {
        /* vanished between readdir and stat — ignore */
      }
    }
    // symlinks and other entry types contribute 0 (not followed)
  }
  return total;
}

/** Build a NextApp descriptor from a discovered `.next` directory. */
export function toNextApp(nextDir: string, scanRoot: string): NextApp {
  const dir = path.dirname(nextDir);
  const cacheDir = path.join(nextDir, "cache");
  const rel = path.relative(path.resolve(scanRoot), dir);
  return {
    dir,
    nextDir,
    cacheDir: existsSync(cacheDir) ? cacheDir : null,
    label: rel === "" ? path.basename(dir) : rel,
  };
}

/** Lockfile name → package manager. */
const LOCKFILES: ReadonlyArray<readonly [string, PackageManager]> = [
  ["pnpm-lock.yaml", "pnpm"],
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
  ["yarn.lock", "yarn"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
];

function packageManagersIn(dir: string): PackageManager[] {
  const found = new Set<PackageManager>();
  for (const [file, pm] of LOCKFILES) {
    if (existsSync(path.join(dir, file))) found.add(pm);
  }
  return [...found];
}

/** Discriminated outcome of locating the install root / package manager. */
export type InstallRootResult =
  | { ok: true; root: InstallRoot }
  | { ok: false; reason: "none" }
  | { ok: false; reason: "ambiguous"; dir: string; found: PackageManager[] };

/**
 * Find the nearest install root by walking UP from the scan root until a
 * lockfile is found. Read-only: this only decides *where* a reinstall would
 * run, never what gets deleted. The nearest lockfile-bearing directory wins; if
 * that directory has conflicting lockfiles, the result is `ambiguous` and the
 * caller must refuse to reinstall rather than guess.
 */
export function detectInstallRoot(scanRoot: string): InstallRootResult {
  const start = path.resolve(scanRoot);
  const fsRoot = path.parse(start).root;
  let dir = start;
  for (;;) {
    const pms = packageManagersIn(dir);
    if (pms.length === 1) {
      return {
        ok: true,
        root: { dir, pm: pms[0]!, aboveScanRoot: dir !== start },
      };
    }
    if (pms.length > 1) {
      return { ok: false, reason: "ambiguous", dir, found: pms };
    }
    if (dir === fsRoot) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { ok: false, reason: "none" };
}
