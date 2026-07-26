# next-nuke

[![npm version](https://img.shields.io/npm/v/next-nuke?color=cb3837&logo=npm)](https://www.npmjs.com/package/next-nuke)
[![npm downloads](https://img.shields.io/npm/dm/next-nuke?color=cb3837&logo=npm)](https://www.npmjs.com/package/next-nuke)
[![provenance](https://img.shields.io/badge/provenance-verified-brightgreen?logo=npm)](https://www.npmjs.com/package/next-nuke)
[![install size](https://packagephobia.com/badge?p=next-nuke)](https://packagephobia.com/result?p=next-nuke)
[![CI](https://github.com/RoyBkker/next-nuke/actions/workflows/ci.yml/badge.svg)](https://github.com/RoyBkker/next-nuke/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/next-nuke)](https://www.npmjs.com/package/next-nuke)
[![license](https://img.shields.io/npm/l/next-nuke)](./LICENSE)

Reset a Next.js project's build state in one command. `next-nuke` finds every `.next` in your repo, shows you what it will delete and how much disk you get back, and can reinstall dependencies afterwards. Monorepo- and pnpm-aware.

```bash
npx next-nuke
```

![next-nuke scanning a Turborepo, selecting two of three apps, and freeing 16.7 GB of .next folders](https://raw.githubusercontent.com/RoyBkker/next-nuke/main/assets/demo.gif)

---

## Why not `rm -rf .next`?

Usually `rm -rf .next` is fine. Two cases where it isn't:

**Turborepo can put the folder straight back.** `turbo build` caches task outputs keyed on an input hash, and a standard Next.js pipeline lists `.next/**` among those outputs. Delete `.next`, rebuild without changing an input, and Turbo reports a cache hit and restores the build you just deleted. The clean rebuild you thought you did is the old build. `next-nuke` notices the `.turbo` cache and tells you; `--turbo` clears it.

**A monorepo has more than one.** You need to know where every app lives, and you probably want to skip some of them. `next-nuke` finds them, sizes them, and gives you a checklist.

There's also the reinstall. `--full` deletes `node_modules` alongside `.next`, works out which package manager your lockfile belongs to, and runs a single install at the workspace root.

---

## Safety

`next-nuke` runs `rm -rf`, so it's built defensively:

- **It only ever deletes** folders named `.next`, `node_modules`, `.turbo`, `.next/cache`, or `.next/dev/cache` — never your source files, configs, or documents. Every path is re-checked against this rule immediately before deletion.
- **It refuses to run** at your home directory, the filesystem root, or any ancestor of home.
- **It stays in scope** — every target must be inside the directory you pointed it at.
- **It never follows symlinks** — symlinked build folders are skipped, not chased.
- **`--dry-run`** shows exactly what would go, and there's a confirmation prompt before anything is deleted.

Every release is published from CI by [npm OIDC trusted publishing](https://docs.npmjs.com/trusted-publishers/), so each version on npm carries a signed provenance attestation linking the tarball to the exact GitHub Actions run and commit that built it.

---

## Usage

```bash
npx next-nuke [path] [options]
# or: pnpm dlx next-nuke
```

| Command | What it does |
| --- | --- |
| `next-nuke` | Delete the whole `.next` (regenerates on next `dev`/`build`) |
| `next-nuke --cache` | Delete only the Next.js caches (`.next/cache` and, on Next 16+, `.next/dev/cache`) — reclaim disk, keep the compiled build |
| `next-nuke --full` | Delete `node_modules` + `.next`, then **reinstall** dependencies |
| `next-nuke --turbo` | Also clear `.turbo` caches |
| `next-nuke --build` | Run the project's build after cleaning |
| `next-nuke --exclude <pattern>` | Skip apps whose path contains `<pattern>` (repeatable) |
| `next-nuke --dry-run` | Show the plan, delete nothing |
| `next-nuke -y, --yes` | Skip the confirmation prompt (scripts / CI) |

Flags compose: `next-nuke --full --turbo --build`.

### Monorepos

Run it at the repo root and it finds every app's `.next`; when there's more than one, you get a checklist to pick which to reset. Run it inside a single app and it resets just that one. Discovery only ever looks **at or below** where you stand — it never reaches up and touches sibling apps.

Use `--exclude` to skip apps by path, which is what you want for non-interactive (`--yes`) or CI runs where there's no checklist. It's repeatable and matches a substring of each app's path:

```bash
next-nuke --full --yes --exclude apps/legacy --exclude packages/docs
```

### pnpm / package managers

`--full` detects your package manager from the lockfile (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock[b]`), deletes every `node_modules` in scope, and runs a single install at the workspace root. If it can't tell which manager to use, it refuses to reinstall rather than guess.

---

## Why not `npkill -t .next`?

[npkill](https://npkill.js.org) already finds and deletes `.next` folders, and it's good at that. `next-nuke` is narrower and does two things npkill doesn't:

- **Delete _and_ reinstall** (`--full`) — wipe `node_modules` + `.next`, then run the right `install` for you.
- **Turbo-cache honesty** — in a Turborepo, deleting `.next` alone can be undone by `.turbo` restoring a stale build from cache. `next-nuke` warns you, and `--turbo` clears it.

If you only ever want to reclaim disk across many projects, `npkill -t .next` is the right tool. If you want to reset the project you're working in, this is.

---

## Requirements

- Node.js >= 20

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local development and the release process.

## License

MIT © Roy Bakker
