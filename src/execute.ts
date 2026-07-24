import { rm, lstat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { assertSafeToDelete } from "./safety.js";
import type { DeleteTarget, PackageManager } from "./types.js";

export type DeleteStatus =
  | "deleted"
  | "skipped-symlink"
  | "missing"
  | "error";

export interface DeleteOutcome extends DeleteTarget {
  readonly status: DeleteStatus;
  readonly error?: string;
}

/**
 * Delete each target. Every path is re-validated against the safety invariants
 * up front — if ANY target is illegal we abort before deleting anything, so a
 * single bad path can never leave the project half-wiped. Symlinked targets are
 * skipped (we unlink build folders, never chase a symlink to its real content).
 */
export async function deleteTargets(
  targets: readonly DeleteTarget[],
  scanRoot: string,
  onProgress?: (target: DeleteTarget) => void,
): Promise<DeleteOutcome[]> {
  // Pass 1: validate everything (throws SafetyError → caller aborts cleanly).
  for (const target of targets) {
    assertSafeToDelete(target.path, scanRoot);
  }

  // Pass 2: delete.
  const outcomes: DeleteOutcome[] = [];
  for (const target of targets) {
    let stat;
    try {
      stat = await lstat(target.path);
    } catch {
      outcomes.push({ ...target, status: "missing" });
      onProgress?.(target);
      continue;
    }
    if (stat.isSymbolicLink()) {
      outcomes.push({ ...target, status: "skipped-symlink" });
      onProgress?.(target);
      continue;
    }
    try {
      await rm(target.path, { recursive: true, force: true });
      outcomes.push({ ...target, status: "deleted" });
    } catch (err) {
      outcomes.push({
        ...target,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    onProgress?.(target);
  }
  return outcomes;
}

/** The install invocation for a package manager. */
export function installCommand(pm: PackageManager): {
  cmd: string;
  args: string[];
} {
  // `<pm> install` is valid for all four managers.
  return { cmd: pm, args: ["install"] };
}

/** The build-script invocation for a package manager. */
export function buildCommand(pm: PackageManager): {
  cmd: string;
  args: string[];
} {
  // npm requires `run`; pnpm/yarn/bun all accept `run build` too.
  return { cmd: pm, args: ["run", "build"] };
}

/** Does `dir`'s package.json declare a `build` script? */
export function hasBuildScript(dir: string): boolean {
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(dir, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    return Boolean(pkg.scripts?.["build"]);
  } catch {
    return false;
  }
}

/**
 * Run a command with inherited stdio so the user sees the package manager's own
 * output. Resolves with the exit code; rejects only if the binary can't be
 * spawned at all (e.g. package manager not installed).
 */
export function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<{ code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      // On Windows the managers are `.cmd` shims; a shell resolves them.
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1 }));
  });
}
