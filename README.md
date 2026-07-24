# next-nuke

[![npm version](https://img.shields.io/npm/v/next-nuke?color=cb3837&logo=npm)](https://www.npmjs.com/package/next-nuke)
[![npm downloads](https://img.shields.io/npm/dm/next-nuke?color=cb3837&logo=npm)](https://www.npmjs.com/package/next-nuke)
[![install size](https://packagephobia.com/badge?p=next-nuke)](https://packagephobia.com/result?p=next-nuke)
[![CI](https://github.com/RoyBkker/next-nuke/actions/workflows/ci.yml/badge.svg)](https://github.com/RoyBkker/next-nuke/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/next-nuke)](https://www.npmjs.com/package/next-nuke)
[![license](https://img.shields.io/npm/l/next-nuke)](./LICENSE)

**npkill, but for Next.js.** Find and nuke bloated `.next` build folders — and, when you want a truly clean slate, `node_modules` and `.turbo` too — then reinstall a fresh instance. Monorepo- and pnpm-aware.

```bash
npx next-nuke
```

A `.next` folder quietly growing to tens of gigabytes (mostly `.next/cache`) is a common Next.js annoyance. `next-nuke` is the one command that resets it — safely, and with the *reinstall* step that plain deletion tools skip.

---

## Why not just `npkill -t .next`?

[npkill](https://npkill.js.org) already finds and deletes `.next` folders, and it's great at that. `next-nuke` is narrower and does two things npkill doesn't:

- **Delete _and_ reinstall** (`--full`) — the "fresh instance" flow: wipe `node_modules` + `.next`, then run the right `install` for you.
- **Turbo-cache honesty** — in a Turborepo, deleting `.next` alone can be undone by `.turbo` restoring a stale build from cache. `next-nuke` warns you, and `--turbo` clears it.

If you only ever want to reclaim disk across many projects, `npkill -t .next` is the right tool. If you want to *reset the project you're working in*, this is.

---

## Usage

```bash
npx next-nuke [path] [options]
# or: pnpm dlx next-nuke
```

| Command | What it does |
| --- | --- |
| `next-nuke` | Delete the whole `.next` (regenerates on next `dev`/`build`) |
| `next-nuke --cache` | Delete only `.next/cache` — reclaim disk, keep the compiled build |
| `next-nuke --full` | Delete `node_modules` + `.next`, then **reinstall** dependencies |
| `next-nuke --turbo` | Also clear `.turbo` caches |
| `next-nuke --build` | Run the project's build after cleaning |
| `next-nuke --dry-run` | Show the plan, delete nothing |
| `next-nuke -y, --yes` | Skip the confirmation prompt (scripts / CI) |

Flags compose: `next-nuke --full --turbo --build`.

### Monorepos

Run it at the repo root and it finds every app's `.next`; when there's more than one, you get a checklist to pick which to reset. Run it inside a single app and it resets just that one. Discovery only ever looks **at or below** where you stand — it never reaches up and touches sibling apps.

### pnpm / package managers

`--full` detects your package manager from the lockfile (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock[b]`), deletes every `node_modules` in scope, and runs a single install at the workspace root. If it can't tell which manager to use, it refuses to reinstall rather than guess.

---

## Safety

`next-nuke` runs `rm -rf`, so it's built defensively:

- **It only ever deletes** folders named `.next`, `node_modules`, `.turbo`, or `.next/cache` — never your source files, configs, or documents. Every path is re-checked against this rule immediately before deletion.
- **It refuses to run** at your home directory, the filesystem root, or any ancestor of home.
- **It stays in scope** — every target must be inside the directory you pointed it at.
- **It never follows symlinks** — symlinked build folders are skipped, not chased.
- **`--dry-run`** shows exactly what would go, and there's a confirmation prompt before anything is deleted.

---

## Requirements

- Node.js >= 20

## Releasing

Releases are fully automated via GitHub Actions + npm [OIDC trusted publishing](https://docs.npmjs.com/trusted-publishers/) — no tokens, no manual `npm publish`. To cut a release:

```bash
npm version patch       # or minor / major — bumps package.json, commits, and tags vX.Y.Z
git push --follow-tags  # pushes the tag; the Release workflow does the rest
```

Pushing a `v*.*.*` tag triggers `.github/workflows/release.yml`, which verifies the tag matches `package.json`, runs typecheck + tests + build, publishes to npm with provenance, and creates a GitHub Release with generated notes.

## License

MIT © Roy Bakker
