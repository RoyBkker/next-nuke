import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  scan,
  isNextProject,
  detectInstallRoot,
  dirSize,
  toNextApp,
} from "../src/discover.js";

let root: string;

function write(rel: string, content = "x"): string {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}

function rels(paths: string[]): string[] {
  return paths.map((p) => path.relative(root, p)).sort();
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "next-nuke-discover-"));

  // Workspace root (pnpm).
  write("pnpm-lock.yaml", "lockfileVersion: 9");
  write("pnpm-workspace.yaml", "packages:\n  - apps/*");
  write("package.json", JSON.stringify({ name: "root", scripts: { build: "turbo run build" } }));
  write("node_modules/.modules.yaml", "x");
  // Decoy: a .next INSIDE node_modules must never be discovered.
  write("node_modules/some-dep/.next/BUILD_ID", "should-not-be-found");
  write(".turbo/cache/blob", "x");

  // apps/web — real Next app (config + dependency).
  write("apps/web/package.json", JSON.stringify({ name: "web", dependencies: { next: "15.0.0" } }));
  write("apps/web/next.config.js", "module.exports = {}");
  write("apps/web/.next/BUILD_ID", "abc");
  write("apps/web/.next/cache/big", "x".repeat(2000));
  write("apps/web/node_modules/dep/index.js", "x");

  // apps/docs — real Next app (devDependency only).
  write("apps/docs/package.json", JSON.stringify({ name: "docs", devDependencies: { next: "15.0.0" } }));
  write("apps/docs/.next/BUILD_ID", "def");

  // packages/ui — has a .next but is NOT a Next app.
  write("packages/ui/package.json", JSON.stringify({ name: "ui" }));
  write("packages/ui/.next/junk", "x");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("scan", () => {
  it("finds every .next below the root", () => {
    const { nextDirs } = scan(root);
    expect(rels(nextDirs)).toEqual([
      "apps/docs/.next",
      "apps/web/.next",
      "packages/ui/.next",
    ]);
  });

  it("never descends into node_modules (decoy .next is not found)", () => {
    const { nextDirs } = scan(root);
    expect(nextDirs.some((p) => p.includes("node_modules"))).toBe(false);
  });

  it("finds node_modules dirs but does not descend into them", () => {
    const { nodeModulesDirs } = scan(root);
    expect(rels(nodeModulesDirs)).toEqual([
      "apps/web/node_modules",
      "node_modules",
    ]);
  });

  it("finds .turbo dirs", () => {
    const { turboDirs } = scan(root);
    expect(rels(turboDirs)).toEqual([".turbo"]);
  });
});

describe("isNextProject", () => {
  it("is true for a config or a next dependency", () => {
    expect(isNextProject(path.join(root, "apps/web"))).toBe(true);
    expect(isNextProject(path.join(root, "apps/docs"))).toBe(true);
  });
  it("is false when there is no next signal", () => {
    expect(isNextProject(path.join(root, "packages/ui"))).toBe(false);
  });
});

describe("dirSize", () => {
  it("sums file sizes recursively", () => {
    expect(dirSize(path.join(root, "apps/web/.next"))).toBeGreaterThanOrEqual(2000);
  });
});

describe("toNextApp", () => {
  it("captures cache dir and a relative label", () => {
    const app = toNextApp(path.join(root, "apps/web/.next"), root);
    expect(app.label).toBe("apps/web");
    expect(app.cacheDir).not.toBeNull();
  });
  it("reports null cache dir when absent", () => {
    const app = toNextApp(path.join(root, "apps/docs/.next"), root);
    expect(app.cacheDir).toBeNull();
  });
});

describe("detectInstallRoot", () => {
  it("finds the pnpm root at the workspace root", () => {
    const res = detectInstallRoot(root);
    expect(res).toEqual({
      ok: true,
      root: { dir: path.resolve(root), pm: "pnpm", aboveScanRoot: false },
    });
  });

  it("walks up from an app to the workspace root", () => {
    const res = detectInstallRoot(path.join(root, "apps/web"));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.root.pm).toBe("pnpm");
      expect(res.root.dir).toBe(path.resolve(root));
      expect(res.root.aboveScanRoot).toBe(true);
    }
  });

  it("reports ambiguous when multiple lockfiles collide", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "next-nuke-ambi-"));
    writeFileSync(path.join(dir, "pnpm-lock.yaml"), "x");
    writeFileSync(path.join(dir, "package-lock.json"), "{}");
    try {
      const res = detectInstallRoot(dir);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.reason).toBe("ambiguous");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports none when no lockfile exists", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "next-nuke-none-"));
    try {
      const res = detectInstallRoot(dir);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.reason).toBe("none");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
