import { describe, expect, it } from 'vitest';
import {
  DONUT_OTHER,
  DONUT_PALETTE,
  DONUT_TOP_N,
  buildDonutColorMap,
  buildDonutSlices,
  donutValue,
} from '../Categories';
import type { BudgetRow } from '../../lib/budgetStatus';

// Minimal BudgetRow factory — only the fields the donut helpers read.
function row(
  id: string,
  spent: number,
  monthlyLimit?: number,
): BudgetRow {
  return {
    id,
    name: `Kategorie ${id}`,
    type: 'expense',
    spent,
    txCount: 0,
    budget:
      monthlyLimit === undefined
        ? null
        : {
            category_id: id,
            monthly_limit: monthlyLimit,
            currency: 'EUR',
            category: null,
          },
  };
}

describe('donutValue', () => {
  it('returns the spent amount in Ist mode', () => {
    expect(donutValue(row('a', 120, 200), 'ist')).toBe(120);
  });

  it('returns the monthly limit in Soll mode', () => {
    expect(donutValue(row('a', 120, 200), 'soll')).toBe(200);
  });

  it('falls back to 0 in Soll mode when no budget is set', () => {
    expect(donutValue(row('a', 120), 'soll')).toBe(0);
  });
});

describe('buildDonutColorMap', () => {
  it('assigns palette colors by descending size, mode-independent', () => {
    // b is the biggest by spend, a by budget — the map ranks on the max of
    // either so the color is stable across the Ist/Soll toggle.
    const rows = [row('a', 10, 500), row('b', 400, 50), row('c', 5, 5)];
    const map = buildDonutColorMap(rows);
    expect(map.get('a')).toBe(DONUT_PALETTE[0]); // budget 500 → rank 0
    expect(map.get('b')).toBe(DONUT_PALETTE[1]); // spent 400 → rank 1
    expect(map.get('c')).toBe(DONUT_PALETTE[2]);
  });

  it('cycles the palette when there are more categories than colors', () => {
    const rows = Array.from({ length: DONUT_PALETTE.length + 1 }, (_, i) =>
      row(`cat-${i}`, 100 - i),
    );
    const map = buildDonutColorMap(rows);
    // The (palette+1)-th category wraps back to palette[0].
    expect(map.get(`cat-${DONUT_PALETTE.length}`)).toBe(DONUT_PALETTE[0]);
  });

  it('keeps a category color identical regardless of mode', () => {
    const rows = [row('a', 10, 500), row('b', 400, 50)];
    const map = buildDonutColorMap(rows);
    const istSlices = buildDonutSlices(rows, 'ist', map);
    const sollSlices = buildDonutSlices(rows, 'soll', map);
    const colorOf = (slices: typeof istSlices, id: string) =>
      slices.find((s) => s.id === id)?.color;
    expect(colorOf(istSlices, 'a')).toBe(colorOf(sollSlices, 'a'));
    expect(colorOf(istSlices, 'b')).toBe(colorOf(sollSlices, 'b'));
  });
});

describe('buildDonutSlices', () => {
  it('drops zero-value rows and sorts descending by value', () => {
    const rows = [row('a', 10), row('b', 0), row('c', 50)];
    const map = buildDonutColorMap(rows);
    const slices = buildDonutSlices(rows, 'ist', map);
    expect(slices.map((s) => s.id)).toEqual(['c', 'a']);
  });

  it('keeps every slice when the count fits within Top-N + 1', () => {
    const rows = Array.from({ length: DONUT_TOP_N + 1 }, (_, i) =>
      row(`cat-${i}`, 100 - i),
    );
    const map = buildDonutColorMap(rows);
    const slices = buildDonutSlices(rows, 'ist', map);
    // No "Sonstige" bucket — exactly Top-N + 1 individual slices.
    expect(slices).toHaveLength(DONUT_TOP_N + 1);
    expect(slices.some((s) => s.id === '__other__')).toBe(false);
  });

  it('buckets everything beyond Top-N into a "Sonstige" slice', () => {
    // Top-N + 2 rows triggers bucketing — keeps Top-N, sums the rest.
    const rows = Array.from({ length: DONUT_TOP_N + 2 }, (_, i) =>
      row(`cat-${i}`, 100 - i),
    );
    const map = buildDonutColorMap(rows);
    const slices = buildDonutSlices(rows, 'ist', map);
    expect(slices).toHaveLength(DONUT_TOP_N + 1);
    const other = slices[slices.length - 1];
    expect(other.id).toBe('__other__');
    expect(other.color).toBe(DONUT_OTHER);
    // The two smallest rows (values 100-7=93 and 100-8=92) are summed.
    expect(other.name).toBe('Sonstige (2)');
    expect(other.value).toBe(93 + 92);
  });

  it('uses the fallback color for a row missing from the color map', () => {
    const rows = [row('a', 50)];
    const slices = buildDonutSlices(rows, 'ist', new Map());
    expect(slices[0].color).toBe(DONUT_OTHER);
  });
});
