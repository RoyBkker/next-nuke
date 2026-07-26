# Contributing

## Local development

```bash
pnpm install
pnpm build          # tsup → dist/
pnpm test           # vitest
pnpm typecheck      # tsc --noEmit
pnpm dev            # tsup --watch
```

Run the local build against a scratch project rather than a repo you care about:

```bash
node dist/index.js /path/to/some/monorepo --dry-run
```

`--dry-run` exercises scan, sizing, and the plan output without deleting anything, which is the fastest way to check discovery changes.

## Releasing

Releases are automated via GitHub Actions and npm [OIDC trusted publishing](https://docs.npmjs.com/trusted-publishers/). There are no tokens and no manual `npm publish`. To cut a release:

```bash
npm version patch       # or minor / major — bumps package.json, commits, and tags vX.Y.Z
git push --follow-tags  # pushes the tag; the Release workflow does the rest
```

Pushing a `v*.*.*` tag triggers `.github/workflows/release.yml`, which verifies the tag matches `package.json`, runs typecheck + tests + build, publishes to npm with provenance, and creates a GitHub Release with generated notes.

## Regenerating the README demo

`assets/demo.gif` is recorded with [vhs](https://github.com/charmbracelet/vhs) from `assets/demo.tape`, so it can be rebuilt whenever the CLI output changes.

```bash
brew install vhs
pnpm build
bash assets/demo-fixture.sh   # builds a throwaway monorepo at /private/tmp/acme
vhs assets/demo.tape
```

`assets/demo-fixture.sh` creates the `.next` folders as sparse files, so they report ~18 GB to `stat()` while using a few hundred KB of disk. `next-nuke` sizes folders with `statSync().size`, so the recording shows realistic numbers for a repo that shape without needing the disk. It also drops a `npx` shim on `PATH` so the recording runs `dist/` instead of the published package. Re-run the script before each recording, since the demo deletes what it finds.

The tape hardcodes a terminal width of 1360px to keep the `.turbo` warning on one line. If you change that warning's wording, re-check the wrap.

### macOS: ttyd fails to start

vhs invokes `ttyd -i localhost`, and libwebsockets on macOS can't resolve `localhost` as an interface name, so recording fails with `could not open ttyd: ERR_CONNECTION_REFUSED`. Put a shim earlier on `PATH` that rewrites the address:

```bash
mkdir -p /tmp/shim
cat > /tmp/shim/ttyd <<'EOF'
#!/usr/bin/env bash
args=(); for a in "$@"; do [ "$a" = "localhost" ] && a=127.0.0.1; args+=("$a"); done
exec /opt/homebrew/bin/ttyd "${args[@]}"
EOF
chmod +x /tmp/shim/ttyd
PATH=/tmp/shim:$PATH vhs assets/demo.tape
```
