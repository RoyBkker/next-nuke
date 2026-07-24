import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import pc from "picocolors";

export interface ParsedCli {
  readonly help: boolean;
  readonly version: boolean;
  readonly positional: string | undefined;
  readonly full: boolean;
  readonly cache: boolean;
  readonly turbo: boolean;
  readonly build: boolean;
  readonly dryRun: boolean;
  readonly yes: boolean;
  readonly exclude: string[];
}

/**
 * Parse argv (excluding `node` and the script path). Throws on unknown flags
 * (strict mode) — the caller turns that into a friendly error + usage.
 */
export function parseCliArgs(argv: string[]): ParsedCli {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      full: { type: "boolean", default: false },
      cache: { type: "boolean", default: false },
      turbo: { type: "boolean", default: false },
      build: { type: "boolean", default: false },
      exclude: { type: "string", multiple: true },
      "dry-run": { type: "boolean", default: false },
      yes: { type: "boolean", short: "y", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });

  return {
    help: values.help ?? false,
    version: values.version ?? false,
    positional: positionals[0],
    full: values.full ?? false,
    cache: values.cache ?? false,
    turbo: values.turbo ?? false,
    build: values.build ?? false,
    dryRun: values["dry-run"] ?? false,
    yes: values.yes ?? false,
    exclude: values.exclude ?? [],
  };
}

/** Read the package version from the shipped package.json. */
export function getVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const HELP = `
${pc.bold("next-nuke")} — npkill for Next.js. Nuke bloated ${pc.cyan(".next")} folders, then reinstall fresh.

${pc.bold("USAGE")}
  npx next-nuke [path] [options]

${pc.bold("ARGUMENTS")}
  path            Directory to scan (default: current directory)

${pc.bold("OPTIONS")}
  --cache         Delete only ${pc.cyan(".next/cache")} (keep the compiled build)
  --full          Also delete ${pc.cyan("node_modules")} and reinstall dependencies
  --turbo         Also clear ${pc.cyan(".turbo")} caches (Turborepo)
  --build         Run the project's build after cleaning
  --exclude <p>   Skip apps whose path contains <p> (repeatable)
  --dry-run       Show what would be deleted, delete nothing
  -y, --yes       Skip the confirmation prompt (for scripts / CI)
  -h, --help      Show this help
  -v, --version   Show version

${pc.bold("EXAMPLES")}
  npx next-nuke                 ${pc.dim("# reset .next in the current project/monorepo")}
  npx next-nuke --cache         ${pc.dim("# reclaim disk, keep the build")}
  npx next-nuke --full          ${pc.dim("# nuke .next + node_modules, then reinstall")}
  npx next-nuke --yes --exclude apps/legacy   ${pc.dim("# reset every app except apps/legacy")}
  npx next-nuke --full --turbo --build
`;
