import { describe, expect, it } from 'vitest';
import { gridMeasures, logicSolutions } from './solver';

describe('logicSolutions', () => {
  it('menemukan solusi tunggal', () => {
    const s = logicSolutions(['x', 'y', 'z'], [
      { type: 'at', entity: 'x', slot: 1 },
      { type: 'left_of', a: 'y', b: 'z' },
    ]);
    expect(s).toEqual([['x', 'y', 'z']]);
  });
  it('mengembalikan lebih dari satu solusi bila petunjuk kurang', () => {
    expect(logicSolutions(['x', 'y', 'z'], [{ type: 'at', entity: 'x', slot: 1 }])).toHaveLength(2);
  });
  it('mengembalikan kosong bila petunjuk bertentangan', () => {
    expect(logicSolutions(['x', 'y'], [{ type: 'at', entity: 'x', slot: 1 }, { type: 'at', entity: 'y', slot: 1 }])).toEqual([]);
  });
  it('memperlakukan posisi mulai dari 1 dan next_to secara simetris', () => {
    const s = logicSolutions(['a', 'b', 'c'], [{ type: 'next_to', a: 'a', b: 'c' }, { type: 'at', entity: 'b', slot: 1 }]);
    expect(s).toEqual([['b', 'a', 'c'], ['b', 'c', 'a']]);
  });
});

describe('gridMeasures', () => {
  it('menghitung luas dan keliling persegi 2×2', () => {
    expect(gridMeasures([[0, 0], [0, 1], [1, 0], [1, 1]])).toEqual({ area: 4, perimeter: 8 });
  });
  it('menghitung bangun L', () => {
    expect(gridMeasures([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]])).toEqual({ area: 5, perimeter: 12 });
  });
  it('menghitung petak tunggal', () => {
    expect(gridMeasures([[3, 3]])).toEqual({ area: 1, perimeter: 4 });
  });
});
