import { describe, it, expect } from "vitest";
import { selectTargetPaths } from "../src/plan.js";
import type { NextApp, ScanResult } from "../src/types.js";

function makeApp(dir: string, hasCache = true): NextApp {
  return {
    dir,
    nextDir: `${dir}/.next`,
    cacheDir: hasCache ? `${dir}/.next/cache` : null,
    label: dir,
  };
}

const scan: ScanResult = {
  nextDirs: ["/r/apps/web/.next", "/r/apps/docs/.next"],
  nodeModulesDirs: ["/r/node_modules", "/r/apps/web/node_modules"],
  turboDirs: ["/r/.turbo"],
};

const web = makeApp("/r/apps/web");
const docs = makeApp("/r/apps/docs", false);

describe("selectTargetPaths", () => {
  it("default deletes each app's whole .next", () => {
    const out = selectTargetPaths([web, docs], scan, {
      cache: false,
      full: false,
      turbo: false,
    });
    expect(out).toEqual([
      { path: "/r/apps/web/.next", kind: "next" },
      { path: "/r/apps/docs/.next", kind: "next" },
    ]);
  });

  it("--cache targets only .next/cache and skips apps without one", () => {
    const out = selectTargetPaths([web, docs], scan, {
      cache: true,
      full: false,
      turbo: false,
    });
    expect(out).toEqual([{ path: "/r/apps/web/.next/cache", kind: "next-cache" }]);
  });

  it("--full adds every node_modules in scope (workspace-wide)", () => {
    const out = selectTargetPaths([web], scan, {
      cache: false,
      full: true,
      turbo: false,
    });
    expect(out).toEqual([
      { path: "/r/apps/web/.next", kind: "next" },
      { path: "/r/node_modules", kind: "node_modules" },
      { path: "/r/apps/web/node_modules", kind: "node_modules" },
    ]);
  });

  it("--turbo adds every .turbo in scope", () => {
    const out = selectTargetPaths([web], scan, {
      cache: false,
      full: false,
      turbo: true,
    });
    expect(out).toContainEqual({ path: "/r/.turbo", kind: "turbo" });
  });

  it("de-dupes repeated paths", () => {
    const dup: ScanResult = { ...scan, nodeModulesDirs: ["/r/node_modules", "/r/node_modules"] };
    const out = selectTargetPaths([web], dup, {
      cache: false,
      full: true,
      turbo: false,
    });
    const nm = out.filter((t) => t.path === "/r/node_modules");
    expect(nm).toHaveLength(1);
  });
});
