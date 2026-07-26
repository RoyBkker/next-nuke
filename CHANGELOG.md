# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.2] - 2026-07-26

### Added

- Recorded terminal demo in the README (`assets/demo.gif`), plus the vhs tape and fixture script used to regenerate it. Excluded from the npm tarball by the existing `files` whitelist.
- `CONTRIBUTING.md`, covering local development, the release process (moved out of the README), and how to re-record the demo.
- npm provenance badge.

### Changed

- README now opens with the `rm -rf .next` comparison rather than the npkill one, since that's the alternative most readers are weighing, and explains how Turborepo can restore a deleted `.next` from its cache. Safety moved directly beneath it.

## [0.2.1] - 2026-07-24

### Fixed

- `--cache` now also clears the Next.js 16 dev-server cache at `.next/dev/cache`, not just the build cache at `.next/cache`. On Next.js 16 (`next dev` writes to `.next/dev`), the dev cache is usually the largest one, and `--cache` was silently missing it entirely — so apps whose only cache lived in `.next/dev/cache` were skipped. Both cache locations are now detected and cleared when present.

## [0.2.0] - 2026-07-24

### Added

- `--exclude <pattern>` flag (repeatable) to skip apps whose path contains the pattern. Applies before selection, so it works both interactively and in non-interactive (`--yes` / CI) runs.
- npm downloads, install size, and Node version badges in the README.
- This CHANGELOG.

### Changed

- Bumped CI/release actions to Node 24 runtimes: `checkout` v7, `setup-node` v7, `pnpm/action-setup` v6.

## [0.1.1] - 2026-07-24

### Added

- Automated release pipeline: GitHub Actions CI plus npm OIDC trusted publishing with build provenance.
- `repository`, `homepage`, and `bugs` metadata in `package.json`.
- README badges (npm version, CI, license) and a "Releasing" section.

## [0.1.0] - 2026-07-24

### Added

- Initial release — nuke bloated `.next` folders in Next.js projects and monorepos, then optionally reinstall a fresh instance.
- Default deletes the whole `.next`; `--cache` targets only `.next/cache`.
- `--full` deletes `node_modules` too and reinstalls (package manager detected from the lockfile: pnpm, npm, yarn, or bun).
- `--turbo` clears `.turbo` caches, with an automatic warning whenever a `.turbo` cache is present (Turbo can otherwise restore a stale build).
- `--build`, `--dry-run`, and `--yes` flags.
- Monorepo-aware discovery — downward from the current directory, skipping `node_modules`, requiring a real Next.js project, never following symlinks — with an interactive checklist when multiple apps are found.
- Safety guardrails: refuses to run at `$HOME` or the filesystem root, and only ever deletes `.next`, `node_modules`, `.turbo`, or `.next/cache`.

[Unreleased]: https://github.com/RoyBkker/next-nuke/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/RoyBkker/next-nuke/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/RoyBkker/next-nuke/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/RoyBkker/next-nuke/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/RoyBkker/next-nuke/releases/tag/v0.1.1
[0.1.0]: https://www.npmjs.com/package/next-nuke/v/0.1.0
