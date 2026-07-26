#!/usr/bin/env bash
# Builds the throwaway monorepo used by demo.tape.
#
# The .next folders are sparse files (`mkfile -n`), so they report ~18 GB to
# stat() while occupying a few hundred KB of real disk. next-nuke sizes folders
# with statSync().size, so the demo shows honest numbers for a repo this shape
# without anyone needing 18 GB free.
#
# macOS only (mkfile). Re-run before each recording — the demo deletes the
# folders it finds.
set -euo pipefail

DEMO=/private/tmp/acme
BIN=/private/tmp/demo-bin
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

rm -rf "$DEMO" "$BIN"
mkdir -p "$DEMO" "$BIN"

cat > "$DEMO/package.json" <<'EOF'
{ "name": "acme", "private": true, "packageManager": "pnpm@9.12.0" }
EOF
cat > "$DEMO/pnpm-workspace.yaml" <<'EOF'
packages: ["apps/*"]
EOF
touch "$DEMO/pnpm-lock.yaml"

app() { # name, build-size, cache-size
  local d="$DEMO/apps/$1"
  mkdir -p "$d/.next/cache" "$d/.next/static/chunks" "$d/src/app"
  cat > "$d/package.json" <<EOF
{ "name": "$1", "dependencies": { "next": "16.0.1", "react": "19.2.0" } }
EOF
  touch "$d/next.config.ts"
  mkfile -n "$2" "$d/.next/static/chunks/main.js"
  mkfile -n "$3" "$d/.next/cache/webpack.pack"
}

app web   9g     3g
app admin 3200m  1600m
app docs  800m   400m

# A .turbo cache so the stale-cache warning fires — the whole point of the demo.
mkdir -p "$DEMO/.turbo/cache"
mkfile -n 900m "$DEMO/.turbo/cache/turbo-build.log"

# Shim so `npx next-nuke` in the recording runs this working tree instead of
# hitting the registry. Same code path, no network latency in the GIF.
cat > "$BIN/npx" <<EOF
#!/usr/bin/env bash
[ "\$1" = "next-nuke" ] && exec node "$REPO/dist/index.js" "\${@:2}"
exec /usr/bin/env npx "\$@"
EOF
chmod +x "$BIN/npx"
