/**
 * Shared interactive-selection parsing for the maintenance scripts. Not run
 * directly — a library, like corporation-merge-helpers.ts.
 *
 * Extracted from reassign-tickets.ts when cleanup-stale-tickets.ts grew a
 * multi-select of its own; both present a numbered list and accept the same
 * answer vocabulary, so the vocabulary lives in one place.
 */

/**
 * Parses "1,3-5" / "all" into a 0-based Set of indices, bounded by [0, count).
 * Exits the process on an unparseable token or an out-of-range index — these
 * are interactive scripts, and a mistyped selection should stop the run rather
 * than silently target the wrong rows.
 */
export function parseSelection(input: string, count: number): Set<number> {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === 'all') return new Set(Array.from({ length: count }, (_, i) => i));

  const indices = new Set<number>();
  for (const part of trimmed.split(',').map((p) => p.trim()).filter(Boolean)) {
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const [, startStr, endStr] = rangeMatch;
      const start = Number(startStr);
      const end = Number(endStr);
      for (let n = Math.min(start, end); n <= Math.max(start, end); n++) indices.add(n - 1);
      continue;
    }
    if (/^\d+$/.test(part)) {
      indices.add(Number(part) - 1);
      continue;
    }
    console.error(`Invalid selection token: "${part}"`);
    process.exit(1);
  }

  if (indices.size === 0) {
    console.error('Nothing selected.');
    process.exit(1);
  }

  for (const i of indices) {
    if (i < 0 || i >= count) {
      console.error(`Selection out of range: ${i + 1} (valid: 1-${count})`);
      process.exit(1);
    }
  }
  return indices;
}
