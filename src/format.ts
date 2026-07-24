/** Format a byte count as a human-readable string (e.g. `29.8 GB`). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exp;
  // Show one decimal for KB+ , whole numbers for bytes.
  const digits = exp === 0 ? 0 : value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[exp]}`;
}

/** Pluralize a noun based on a count (`1 folder`, `3 folders`). */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
