import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  deleteTargets,
  installCommand,
  buildCommand,
  hasBuildScript,
} from "../src/execute.js";
import { SafetyError } from "../src/safety.js";
import type { DeleteTarget } from "../src/types.js";

let root: string;

function write(rel: string, content = "x"): string {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}

function target(rel: string): DeleteTarget {
  return { path: path.join(root, rel), kind: "next", size: 0 };
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "next-nuke-exec-"));
  write("keep.txt", "precious"); // decoy that must never be touched
  write("apps/web/package.json", JSON.stringify({ scripts: { build: "next build" } }));
  write("apps/web/src/index.ts", "export const x = 1;"); // source must survive
  write("apps/web/.next/BUILD_ID", "abc");
  write("apps/web/.next/cache/blob", "x".repeat(500));
  write("apps/nobuild/package.json", JSON.stringify({ name: "nobuild" }));
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("deleteTargets — the safety contract", () => {
  it("deletes .next but leaves sibling source and decoy files untouched", async () => {
    const outcomes = await deleteTargets([target("apps/web/.next")], root);
    expect(outcomes[0]?.status).toBe("deleted");
    expect(existsSync(path.join(root, "apps/web/.next"))).toBe(false);
    // Everything that is NOT a build folder survives.
    expect(existsSync(path.join(root, "apps/web/src/index.ts"))).toBe(true);
    expect(existsSync(path.join(root, "apps/web/package.json"))).toBe(true);
    expect(existsSync(path.join(root, "keep.txt"))).toBe(true);
  });

  it("aborts the ENTIRE run if any target is illegal — deletes nothing", async () => {
    const valid = target("apps/web/.next");
    const illegal: DeleteTarget = { path: "/etc/hosts", kind: "next", size: 0 };
    await expect(deleteTargets([valid, illegal], root)).rejects.toBeInstanceOf(
      SafetyError,
    );
    // The valid target must still be intact — pre-validation ran before any rm.
    expect(existsSync(path.join(root, "apps/web/.next"))).toBe(true);
  });

  it("skips symlinked targets instead of chasing them", async () => {
    mkdirSync(path.join(root, "apps/sym/realbuild"), { recursive: true });
    writeFileSync(path.join(root, "apps/sym/realbuild/keep"), "x");
    symlinkSync(
      path.join(root, "apps/sym/realbuild"),
      path.join(root, "apps/sym/.next"),
      "dir",
    );
    const outcomes = await deleteTargets([target("apps/sym/.next")], root);
    expect(outcomes[0]?.status).toBe("skipped-symlink");
    expect(existsSync(path.join(root, "apps/sym/realbuild/keep"))).toBe(true);
  });

  it("reports a legal-but-absent target as missing, not an error", async () => {
    const outcomes = await deleteTargets([target("apps/ghost/.next")], root);
    expect(outcomes[0]?.status).toBe("missing");
  });
});

describe("command mapping", () => {
  it("maps install commands per package manager", () => {
    expect(installCommand("pnpm")).toEqual({ cmd: "pnpm", args: ["install"] });
    expect(installCommand("npm")).toEqual({ cmd: "npm", args: ["install"] });
    expect(installCommand("yarn")).toEqual({ cmd: "yarn", args: ["install"] });
    expect(installCommand("bun")).toEqual({ cmd: "bun", args: ["install"] });
  });

  it("maps build commands with run", () => {
    expect(buildCommand("pnpm")).toEqual({ cmd: "pnpm", args: ["run", "build"] });
  });

  it("detects a build script", () => {
    expect(hasBuildScript(path.join(root, "apps/web"))).toBe(true);
    expect(hasBuildScript(path.join(root, "apps/nobuild"))).toBe(false);
  });
});
