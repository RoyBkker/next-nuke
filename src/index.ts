#!/usr/bin/env node
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { parseCliArgs, getVersion, HELP } from "./cli.js";
import { assertScanRootAllowed, SafetyError } from "./safety.js";
import {
  scan,
  isNextProject,
  toNextApp,
  dirSize,
  detectInstallRoot,
  type InstallRootResult,
} from "./discover.js";
import { selectTargetPaths, measureTargets, filterExcluded } from "./plan.js";
import {
  deleteTargets,
  installCommand,
  buildCommand,
  hasBuildScript,
  runCommand,
  type DeleteOutcome,
} from "./execute.js";
import { renderPlan, renderOutcomes, totalSize } from "./ui.js";
import { formatBytes, plural } from "./format.js";
import type { NextApp, Options } from "./types.js";

function fail(message: string): never {
  console.error(pc.red(`\n${message}\n`));
  process.exit(1);
}

async function main(): Promise<void> {
  let parsed;
  try {
    parsed = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(pc.red(`\n${err instanceof Error ? err.message : String(err)}`));
    console.log(HELP);
    process.exit(1);
  }

  if (parsed.help) {
    console.log(HELP);
    return;
  }
  if (parsed.version) {
    console.log(getVersion());
    return;
  }

  if (parsed.cache && parsed.full) {
    fail(
      "--cache and --full can't be combined: one keeps the build, the other wipes and reinstalls everything.",
    );
  }

  const scanRoot = path.resolve(parsed.positional ?? process.cwd());

  // INVARIANT #1 — refuse dangerous roots (/, $HOME, ancestors of $HOME).
  try {
    assertScanRootAllowed(scanRoot);
  } catch (err) {
    if (err instanceof SafetyError) fail(err.message);
    throw err;
  }

  const options: Options = {
    scanRoot,
    full: parsed.full,
    cache: parsed.cache,
    turbo: parsed.turbo,
    build: parsed.build,
    dryRun: parsed.dryRun,
    yes: parsed.yes,
    exclude: parsed.exclude,
  };

  p.intro(pc.bgCyan(pc.black(" next-nuke ")));

  // --- Scan ---
  const scanSpin = p.spinner();
  scanSpin.start(`Scanning ${pc.dim(scanRoot)}`);
  const scanResult = scan(scanRoot);

  let apps: NextApp[] = scanResult.nextDirs
    .filter((nextDir) => isNextProject(path.dirname(nextDir)))
    .map((nextDir) => toNextApp(nextDir, scanRoot));

  // --cache only makes sense for apps that actually have a cache folder
  // (.next/cache and/or, on Next.js 16+, .next/dev/cache).
  if (options.cache) apps = apps.filter((a) => a.cacheDirs.length > 0);

  // Apply --exclude before selection so it governs both the checklist and --yes.
  const beforeExclude = apps.length;
  if (options.exclude.length > 0) apps = filterExcluded(apps, options.exclude);
  const excludedCount = beforeExclude - apps.length;

  // Size each app's target for display in the picker.
  const appSize = new Map<string, number>();
  for (const app of apps) {
    const size = options.cache
      ? app.cacheDirs.reduce((sum, d) => sum + dirSize(d), 0)
      : dirSize(app.nextDir);
    appSize.set(app.dir, size);
  }
  scanSpin.stop(
    `Found ${plural(apps.length, "Next.js app")} under ${pc.dim(scanRoot)}`,
  );
  if (excludedCount > 0) {
    p.log.info(pc.dim(`Excluded ${plural(excludedCount, "app")} via --exclude.`));
  }

  if (apps.length === 0) {
    if (excludedCount > 0) {
      p.outro(
        pc.dim(
          `All ${plural(excludedCount, "Next.js app")} were excluded by --exclude. Nothing to do.`,
        ),
      );
    } else {
      const what = options.cache ? ".next/cache" : ".next";
      p.outro(pc.dim(`No ${what} to clean in any Next.js project here.`));
    }
    return;
  }

  // --- Locate the install root up front (needed by --full / --build) ---
  let installRootResult: InstallRootResult | null = null;
  if (options.full || options.build) {
    installRootResult = detectInstallRoot(scanRoot);
  }
  // For --full a reinstall MUST be possible — bail before deleting anything.
  if (options.full && installRootResult && !installRootResult.ok) {
    if (installRootResult.reason === "ambiguous") {
      fail(
        `--full needs exactly one package manager, but ${installRootResult.dir} has multiple lockfiles (${installRootResult.found.join(", ")}). Remove the extras and retry.`,
      );
    }
    fail(
      `--full can't reinstall: no lockfile found at or above ${scanRoot}. Run from a project that has one.`,
    );
  }

  // --- Select apps (hybrid: auto for 1 / --yes, checklist for many) ---
  let selected: NextApp[];
  if (apps.length === 1 || options.yes) {
    selected = apps;
  } else {
    const answer = await p.multiselect({
      message: `Select which to reset (${options.cache ? ".next/cache" : ".next"}):`,
      options: apps.map((a) => ({
        value: a.dir,
        label: a.label,
        hint: formatBytes(appSize.get(a.dir) ?? 0),
      })),
      initialValues: apps.map((a) => a.dir),
      required: true,
    });
    if (p.isCancel(answer)) {
      p.cancel("Cancelled. Nothing deleted.");
      return;
    }
    const chosen = new Set(answer);
    selected = apps.filter((a) => chosen.has(a.dir));
  }

  // --- Build + measure the deletion plan ---
  const planned = selectTargetPaths(selected, scanResult, options);
  const measureSpin = p.spinner();
  measureSpin.start("Measuring folders");
  const targets = measureTargets(planned);
  const total = totalSize(targets);
  measureSpin.stop("Measured folders");

  p.note(
    renderPlan(targets, scanRoot),
    `Plan — ${plural(targets.length, "folder")}, ${pc.bold(formatBytes(total))}`,
  );

  // Turbo honesty: warn even when --turbo wasn't passed.
  if (!options.turbo && scanResult.turboDirs.length > 0) {
    p.log.warn(
      pc.yellow(
        `Found ${plural(scanResult.turboDirs.length, ".turbo cache")}. Turbo can restore a stale .next from cache — for a truly fresh rebuild add ${pc.bold("--turbo")} (or run ${pc.bold("turbo build --force")}).`,
      ),
    );
  }

  // Reinstall preview + workspace-root caveat.
  if (options.full && installRootResult?.ok) {
    const root = installRootResult.root;
    const where = root.aboveScanRoot
      ? pc.yellow(`${root.dir} (workspace root, above current dir)`)
      : root.dir;
    p.log.info(`Will reinstall with ${pc.bold(root.pm)} at ${where}.`);
    if (root.aboveScanRoot) {
      p.log.warn(
        pc.yellow(
          `The root node_modules is outside this scan and won't be deleted. Run from ${root.dir} for a full clean reinstall.`,
        ),
      );
    }
  }

  // --- Dry run stops here ---
  if (options.dryRun) {
    p.outro(
      pc.dim(`Dry run — nothing deleted. Would free ~${formatBytes(total)}.`),
    );
    return;
  }

  // --- Confirm ---
  if (!options.yes) {
    const ok = await p.confirm({
      message: `Delete ${plural(targets.length, "folder")} and free ${pc.bold(formatBytes(total))}?`,
    });
    if (p.isCancel(ok) || !ok) {
      p.cancel("Cancelled. Nothing deleted.");
      return;
    }
  }

  // --- Delete ---
  const delSpin = p.spinner();
  delSpin.start("Deleting");
  let done = 0;
  let outcomes: DeleteOutcome[];
  try {
    outcomes = await deleteTargets(targets, scanRoot, () => {
      done += 1;
      delSpin.message(`Deleting ${done}/${targets.length}`);
    });
  } catch (err) {
    // SafetyError from pre-validation → nothing was deleted.
    delSpin.stop("Aborted.");
    fail(err instanceof Error ? err.message : String(err));
  }

  const freed = outcomes
    .filter((o) => o.status === "deleted")
    .reduce((sum, o) => sum + o.size, 0);
  delSpin.stop(`Deleted — freed ${pc.green(formatBytes(freed))}`);
  p.note(renderOutcomes(outcomes, scanRoot), "Result");

  let hadError = outcomes.some((o) => o.status === "error");

  // --- Reinstall (--full) ---
  if (options.full && installRootResult?.ok) {
    const root = installRootResult.root;
    const { cmd, args } = installCommand(root.pm);
    p.log.step(`Reinstalling: ${pc.bold(`${cmd} ${args.join(" ")}`)} in ${root.dir}`);
    try {
      const { code } = await runCommand(cmd, args, root.dir);
      if (code !== 0) {
        hadError = true;
        p.log.error(pc.red(`${cmd} install exited with code ${code}.`));
      } else {
        p.log.success("Dependencies reinstalled.");
      }
    } catch (err) {
      hadError = true;
      p.log.error(
        pc.red(
          `Could not run ${cmd}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  }

  // --- Build (--build) ---
  if (options.build) {
    if (installRootResult?.ok && hasBuildScript(installRootResult.root.dir)) {
      const root = installRootResult.root;
      const { cmd, args } = buildCommand(root.pm);
      p.log.step(`Building: ${pc.bold(`${cmd} ${args.join(" ")}`)} in ${root.dir}`);
      try {
        const { code } = await runCommand(cmd, args, root.dir);
        if (code !== 0) {
          hadError = true;
          p.log.error(pc.red(`Build exited with code ${code}.`));
        } else {
          p.log.success("Build complete.");
        }
      } catch (err) {
        hadError = true;
        p.log.error(
          pc.red(
            `Could not build: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
    } else {
      p.log.warn(
        pc.yellow(
          "Skipped --build: no build script found at the install root. Build manually if needed.",
        ),
      );
    }
  }

  p.outro(
    hadError
      ? pc.yellow(`Done with some errors — freed ${formatBytes(freed)}.`)
      : pc.green(`Done — freed ${formatBytes(freed)}.`),
  );
  if (hadError) process.exitCode = 1;
}

main().catch((err) => {
  console.error(pc.red(`\nUnexpected error: ${err instanceof Error ? err.stack ?? err.message : String(err)}`));
  process.exit(1);
});
