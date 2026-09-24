import { describe, expect, it } from 'vitest';
// @ts-expect-error JavaScript CLI rule module intentionally has no application types.
import { checkPaths, ownersForPath, ROLE_PREFIXES } from '../../scripts/ownership-rules.mjs';

describe('single-owner paths', () => {
  it('has no overlapping role prefixes and maps shared paths separately', () => {
    const prefixes = Object.values(ROLE_PREFIXES).flat() as string[];
    for (const prefix of prefixes) for (const other of prefixes) if (prefix !== other) expect(prefix.startsWith(other)).toBe(false);
    expect(ownersForPath('src/contracts/index.ts')).toEqual(['shared']);
    expect(ownersForPath('src/main.ts')).toEqual(['C']);
    expect(ownersForPath('docs/handoffs/B/report.md')).toEqual(['B']);
  });
  it('blocks foreign/shared edits unless integration A explicitly approves shared', () => {
    expect(checkPaths(['src/core/index.ts', 'tests/core/game.test.ts'], 'A')).toEqual([]);
    expect(checkPaths(['src/core/index.ts'], 'B')).toHaveLength(1);
    expect(checkPaths(['src/contracts/index.ts'], 'A')).toHaveLength(1);
    expect(checkPaths(['src/contracts/index.ts'], 'A', true)).toEqual([]);
    expect(() => checkPaths([], 'B', true)).toThrow();
    expect(checkPaths(['mystery.file'], 'C')).toHaveLength(1);
  });
});
