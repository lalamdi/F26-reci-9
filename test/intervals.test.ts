import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mergeIntervals, type Interval } from '../src/intervals';

const interval: fc.Arbitrary<Interval> = fc
  .tuple(fc.integer(), fc.integer())
  .map(([a, b]): Interval => [Math.min(a, b), Math.max(a, b)]);

const touchingIntervals = fc.integer({ min: -20, max: 20 }).map(
  (p): Interval[] => [[p - 1, p], [p, p + 1]],
);

const intervalList = fc.oneof(fc.array(interval), touchingIntervals);

const neighboringIntervals = fc.integer({ min: -20, max: 20 }).map(
  (p): Interval[] => [[p - 1, p], [p + 1, p + 2]],
);

const disjointIntervals = fc
  .array(fc.tuple(fc.nat(10), fc.integer({ min: 1, max: 5 })))
  .map(parts => {
    let start = -20;
    return parts.map(([length, gap]): Interval => {
      const end = start + length;
      const interval: Interval = [start, end];
      start = end + gap;
      return interval;
    });
  });

describe('mergeIntervals', () => {
  // Pattern: invariant. Every input interval lies inside some output interval.
  it('every input interval lies inside some output interval', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        const uncovered = xs.filter(
          ([s, e]) => !out.some(([a, b]) => a <= s && e <= b),
        );
        expect(uncovered).toEqual([]);
      }),
    );
  });

  // Pattern: invariant. Output intervals are sorted and never overlap or touch.
  it('returns sorted intervals that do not overlap or touch', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);

        for (let i = 1; i < out.length; i++) {
          expect(out[i - 1][1]).toBeLessThan(out[i][0]);
        }
      }),
    );
  });

  // Pattern: differential. Input and output cover the same points.
  it('preserves which points are covered', () => {
    fc.assert(
      fc.property(fc.oneof(intervalList, neighboringIntervals), xs => {
        const out = mergeIntervals(xs);
        const covers = (intervals: readonly Interval[], p: number) =>
          intervals.some(([start, end]) => start <= p && p <= end);

        for (const [start, end] of [...xs, ...out]) {
          for (const point of [start - 0.5, start, end, end + 0.5]) {
            expect(covers(out, point)).toBe(covers(xs, point));
          }
        }
      }),
    );
  });

  // Pattern: algebraic. Merging twice gives the same result as merging once.
  it('gives the same result when merged again', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const merged = mergeIntervals(xs);
        expect(mergeIntervals(merged)).toEqual(merged);
      }),
    );
  });

  // Pattern: metamorphic. Reversing the input leaves the result unchanged.
  it('returns the same result when the input is reversed', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const reversed = [...xs].reverse();
        expect(mergeIntervals(reversed)).toEqual(mergeIntervals(xs));
      }),
    );
  });

  // Pattern: conditional. Sorted intervals with gaps are already merged.
  it('returns the same intervals when they are sorted and separated by gaps', () => {
    fc.assert(
      fc.property(disjointIntervals, xs => {
        expect(mergeIntervals(xs)).toEqual(xs);
      }),
    );
  });

  // Pattern: invariant. Merging leaves the input array and its endpoints unchanged.
  it('does not change the input intervals', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const before = xs.map(([start, end]): Interval => [start, end]);
        mergeIntervals(xs);
        expect(xs).toEqual(before);
      }),
    );
  });
});