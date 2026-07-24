import { homedir } from "node:os";
import { statSync } from "node:fs";
import path from "node:path";

/**
 * Thrown for expected, user-facing safety violations (bad scan root, illegal
 * delete target). Distinct from unexpected runtime errors so the CLI can print
 * a clean message instead of a stack trace.
 */
export class SafetyError extends Error {
  override readonly name = "SafetyError";
}

/** Directory basenames next-nuke is ever allowed to delete. */
const ALLOWED_BASENAMES = new Set([".next", "node_modules", ".turbo"]);

/** Is `child` strictly inside `parent`? (Not equal, not an escape via `..`.) */
export function isWithin(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return (
    rel.length > 0 &&
    !rel.startsWith("..") &&
    !path.isAbsolute(rel)
  );
}

/**
 * INVARIANT #1 — where we are allowed to operate.
 *
 * Refuse to run against the filesystem root, the user's home directory, or any
 * ancestor of home (e.g. `/Users`). Running there would let a single confirm
 * wipe build artifacts across every project on the machine — far outside the
 * "reset the project I'm standing in" contract.
 */
export function assertScanRootAllowed(scanRoot: string): void {
  const resolved = path.resolve(scanRoot);

  let stat;
  try {
    stat = statSync(resolved);
  } catch {
    throw new SafetyError(`Path does not exist: ${resolved}`);
  }
  if (!stat.isDirectory()) {
    throw new SafetyError(`Not a directory: ${resolved}`);
  }

  const home = homedir();
  const fsRoot = path.parse(resolved).root;

  if (resolved === fsRoot) {
    throw new SafetyError(
      "Refusing to run at the filesystem root. Run inside a project.",
    );
  }
  if (resolved === home) {
    throw new SafetyError(
      "Refusing to run at your home directory. Run inside a project.",
    );
  }
  if (isWithin(home, resolved)) {
    throw new SafetyError(
      `Refusing to run at ${resolved} — it contains your home directory. Run inside a project.`,
    );
  }
}

/**
 * INVARIANT #2 — what we are allowed to delete.
 *
 * A path may be deleted only if it is absolute, strictly inside the scan root,
 * and is either an allowed build/deps folder (`.next`, `node_modules`,
 * `.turbo`) or a `.next/cache` folder. Any other path — a source file, a
 * document, an unexpected name — is rejected before `rm` is ever called.
 *
 * Throws SafetyError on violation; this is the last line of defense and is
 * checked immediately before every deletion.
 */
export function assertSafeToDelete(targetPath: string, scanRoot: string): void {
  const resolved = path.resolve(targetPath);

  if (!path.isAbsolute(resolved)) {
    throw new SafetyError(`Refusing non-absolute target: ${targetPath}`);
  }
  if (resolved === path.resolve(scanRoot)) {
    throw new SafetyError(`Refusing to delete the scan root itself: ${resolved}`);
  }
  if (!isWithin(resolved, path.resolve(scanRoot))) {
    throw new SafetyError(
      `Refusing target outside scan root: ${resolved} (scan root: ${scanRoot})`,
    );
  }

  const base = path.basename(resolved);
  const parentBase = path.basename(path.dirname(resolved));
  const isAllowedFolder = ALLOWED_BASENAMES.has(base);
  const isNextCache = base === "cache" && parentBase === ".next";

  if (!isAllowedFolder && !isNextCache) {
    throw new SafetyError(
      `Refusing to delete unexpected path (not .next / node_modules / .turbo / .next/cache): ${resolved}`,
    );
  }
}
