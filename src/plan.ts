import { dirSize } from "./discover.js";
import type {
  DeleteTarget,
  NextApp,
  Options,
  ScanResult,
  TargetKind,
} from "./types.js";

export interface PlannedPath {
  readonly path: string;
  readonly kind: TargetKind;
}

/**
 * Decide which paths to delete from the selected apps + scan result + flags.
 * Pure and deterministic (no filesystem sizing), so it can be unit-tested.
 *
 * - default        → each selected app's whole `.next`
 * - `--cache`       → each selected app's `.next/cache` (apps without one are skipped)
 * - `--full`        → additionally every `node_modules` in scope (workspace-wide)
 * - `--turbo`       → additionally every `.turbo` in scope (workspace-wide)
 *
 * node_modules and .turbo are workspace-wide (not tied to app selection) because
 * a `--full` reinstall and Turbo's cache are shared across the whole workspace.
 */
export function selectTargetPaths(
  apps: readonly NextApp[],
  scan: ScanResult,
  options: Pick<Options, "cache" | "full" | "turbo">,
): PlannedPath[] {
  const planned: PlannedPath[] = [];

  for (const app of apps) {
    if (options.cache) {
      if (app.cacheDir) planned.push({ path: app.cacheDir, kind: "next-cache" });
    } else {
      planned.push({ path: app.nextDir, kind: "next" });
    }
  }

  if (options.full) {
    for (const nm of scan.nodeModulesDirs) {
      planned.push({ path: nm, kind: "node_modules" });
    }
  }

  if (options.turbo) {
    for (const t of scan.turboDirs) {
      planned.push({ path: t, kind: "turbo" });
    }
  }

  // Defensive de-dupe by path, preserving first-seen order.
  const seen = new Set<string>();
  return planned.filter((p) => {
    if (seen.has(p.path)) return false;
    seen.add(p.path);
    return true;
  });
}

/** Attach a measured on-disk size to each planned path. */
export function measureTargets(planned: readonly PlannedPath[]): DeleteTarget[] {
  return planned.map((p) => ({ ...p, size: dirSize(p.path) }));
}
