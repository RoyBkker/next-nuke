import path from "node:path";
import pc from "picocolors";
import { formatBytes } from "./format.js";
import type { DeleteOutcome, DeleteStatus } from "./execute.js";
import type { DeleteTarget, TargetKind } from "./types.js";

const KIND_LABEL: Record<TargetKind, string> = {
  next: ".next",
  "next-cache": ".next/cache",
  node_modules: "node_modules",
  turbo: ".turbo",
};

const KIND_COLOR: Record<TargetKind, (s: string) => string> = {
  next: pc.cyan,
  "next-cache": pc.cyan,
  node_modules: pc.yellow,
  turbo: pc.magenta,
};

export function kindLabel(kind: TargetKind): string {
  return KIND_LABEL[kind];
}

/** Render the deletion plan as a colored, aligned, multi-line block. */
export function renderPlan(targets: readonly DeleteTarget[], scanRoot: string): string {
  const lines = targets.map((t) => {
    const rel = path.relative(scanRoot, t.path) || path.basename(t.path);
    const color = KIND_COLOR[t.kind];
    const size = pc.dim(formatBytes(t.size).padStart(9));
    return `  ${size}  ${color(rel)}`;
  });
  return lines.join("\n");
}

/** Sum the sizes of a set of targets. */
export function totalSize(targets: readonly DeleteTarget[]): number {
  return targets.reduce((sum, t) => sum + t.size, 0);
}

const STATUS_MARK: Record<DeleteStatus, string> = {
  deleted: pc.green("✓"),
  "skipped-symlink": pc.yellow("→ symlink, skipped"),
  missing: pc.dim("· already gone"),
  error: pc.red("✗ error"),
};

/** Render the outcome summary after deletion. */
export function renderOutcomes(
  outcomes: readonly DeleteOutcome[],
  scanRoot: string,
): string {
  return outcomes
    .map((o) => {
      const rel = path.relative(scanRoot, o.path) || path.basename(o.path);
      const mark = STATUS_MARK[o.status];
      const detail = o.status === "error" && o.error ? pc.dim(` (${o.error})`) : "";
      return `  ${mark}  ${rel}${detail}`;
    })
    .join("\n");
}
