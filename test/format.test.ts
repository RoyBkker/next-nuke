import { describe, it, expect } from "vitest";
import { formatBytes, plural } from "../src/format.js";

describe("formatBytes", () => {
  it("handles zero and negatives", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
  });

  it("formats across units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1024 ** 3)).toBe("1.0 GB");
    expect(formatBytes(30 * 1024 ** 3)).toBe("30.0 GB");
  });

  it("drops decimals for large magnitudes within a unit", () => {
    expect(formatBytes(512 * 1024 ** 2)).toBe("512 MB");
  });
});

describe("plural", () => {
  it("pluralizes based on count", () => {
    expect(plural(1, "folder")).toBe("1 folder");
    expect(plural(0, "folder")).toBe("0 folders");
    expect(plural(3, "folder")).toBe("3 folders");
  });
});
