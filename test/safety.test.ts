import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import {
  isWithin,
  assertScanRootAllowed,
  assertSafeToDelete,
  SafetyError,
} from "../src/safety.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "next-nuke-safety-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("isWithin", () => {
  it("is true for a descendant", () => {
    expect(isWithin("/a/b/c", "/a")).toBe(true);
  });
  it("is false for the same path", () => {
    expect(isWithin("/a", "/a")).toBe(false);
  });
  it("is false for an escape via ..", () => {
    expect(isWithin("/a/../b", "/a")).toBe(false);
    expect(isWithin("/other", "/a")).toBe(false);
  });
});

describe("assertScanRootAllowed (INVARIANT #1)", () => {
  it("allows a normal project directory", () => {
    expect(() => assertScanRootAllowed(root)).not.toThrow();
  });

  it("refuses the filesystem root", () => {
    expect(() => assertScanRootAllowed(path.parse(root).root)).toThrow(
      SafetyError,
    );
  });

  it("refuses the home directory", () => {
    expect(() => assertScanRootAllowed(homedir())).toThrow(SafetyError);
  });

  it("refuses an ancestor of home", () => {
    expect(() => assertScanRootAllowed(path.dirname(homedir()))).toThrow(
      SafetyError,
    );
  });

  it("refuses a path that does not exist", () => {
    expect(() => assertScanRootAllowed(path.join(root, "nope"))).toThrow(
      SafetyError,
    );
  });
});

describe("assertSafeToDelete (INVARIANT #2)", () => {
  it("allows .next / node_modules / .turbo inside the scan root", () => {
    for (const name of [".next", "node_modules", ".turbo"]) {
      const p = path.join(root, "apps", "web", name);
      expect(() => assertSafeToDelete(p, root)).not.toThrow();
    }
  });

  it("allows .next/cache", () => {
    const p = path.join(root, "apps", "web", ".next", "cache");
    expect(() => assertSafeToDelete(p, root)).not.toThrow();
  });

  it("refuses a non-allowed folder name", () => {
    expect(() => assertSafeToDelete(path.join(root, "src"), root)).toThrow(
      SafetyError,
    );
  });

  it("refuses a target outside the scan root", () => {
    expect(() => assertSafeToDelete("/etc/.next", root)).toThrow(SafetyError);
  });

  it("refuses the scan root itself", () => {
    expect(() => assertSafeToDelete(root, root)).toThrow(SafetyError);
  });

  it("refuses a bare 'cache' folder not under .next", () => {
    expect(() =>
      assertSafeToDelete(path.join(root, "cache"), root),
    ).toThrow(SafetyError);
  });
});
