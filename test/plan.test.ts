import { describe, it, expect } from "vitest";
import { selectTargetPaths, filterExcluded } from "../src/plan.js";
import type { NextApp, ScanResult } from "../src/types.js";

function makeApp(dir: string, hasCache = true): NextApp {
  return {
    dir,
    nextDir: `${dir}/.next`,
    cacheDirs: hasCache ? [`${dir}/.next/cache`] : [],
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

  it("--cache targets every cache dir an app has (Next 16 dev cache)", () => {
    const app16: NextApp = {
      dir: "/r/apps/site",
      nextDir: "/r/apps/site/.next",
      cacheDirs: ["/r/apps/site/.next/cache", "/r/apps/site/.next/dev/cache"],
      label: "apps/site",
    };
    const out = selectTargetPaths([app16], scan, {
      cache: true,
      full: false,
      turbo: false,
    });
    expect(out).toEqual([
      { path: "/r/apps/site/.next/cache", kind: "next-cache" },
      { path: "/r/apps/site/.next/dev/cache", kind: "next-cache" },
    ]);
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

describe("filterExcluded", () => {
  const mk = (label: string): NextApp => ({
    dir: `/r/${label}`,
    nextDir: `/r/${label}/.next`,
    cacheDirs: [],
    label,
  });
  const apps = [mk("apps/web"), mk("apps/docs"), mk("packages/ui")];

  it("returns all apps when there are no patterns", () => {
    expect(filterExcluded(apps, [])).toHaveLength(3);
  });

  it("drops apps whose label contains a pattern", () => {
    const out = filterExcluded(apps, ["apps/docs"]);
    expect(out.map((a) => a.label)).toEqual(["apps/web", "packages/ui"]);
  });

  it("supports a partial substring match", () => {
    const out = filterExcluded(apps, ["docs"]);
    expect(out.map((a) => a.label)).toEqual(["apps/web", "packages/ui"]);
  });

  it("excludes everything matching a broad pattern", () => {
    expect(filterExcluded(apps, ["apps/"])).toEqual([mk("packages/ui")]);
  });

  it("applies multiple patterns", () => {
    const out = filterExcluded(apps, ["web", "ui"]);
    expect(out.map((a) => a.label)).toEqual(["apps/docs"]);
  });

  it("ignores empty-string patterns", () => {
    expect(filterExcluded(apps, [""])).toHaveLength(3);
  });

  it("normalizes separators so apps/web matches a backslash label", () => {
    const win: NextApp[] = [
      { dir: "C:/r/apps/web", nextDir: "x", cacheDirs: [], label: "apps\\web" },
    ];
    expect(filterExcluded(win, ["apps/web"])).toHaveLength(0);
  });
});
