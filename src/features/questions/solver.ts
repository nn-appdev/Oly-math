import type { LogicClue } from './model';

/** Semua susunan (permutasi) yang memenuhi petunjuk. Posisi dihitung mulai 1, sama dengan server. */
export function logicSolutions(ids: readonly string[], clues: readonly LogicClue[]): string[][] {
  const out: string[][] = [];
  const used = new Array<boolean>(ids.length).fill(false);
  const current: string[] = [];

  const posOf = (arr: readonly string[], id: string) => arr.indexOf(id) + 1;
  const satisfies = (arr: readonly string[]): boolean =>
    clues.every((c) => {
      switch (c.type) {
        case 'at':
          return posOf(arr, c.entity) === c.slot;
        case 'not_at':
          return posOf(arr, c.entity) !== c.slot;
        case 'left_of':
          return posOf(arr, c.a) < posOf(arr, c.b);
        case 'next_to':
          return Math.abs(posOf(arr, c.a) - posOf(arr, c.b)) === 1;
      }
    });

  function walk() {
    if (current.length === ids.length) {
      if (satisfies(current)) out.push([...current]);
      return;
    }
    ids.forEach((id, i) => {
      if (used[i]) return;
      used[i] = true;
      current.push(id);
      walk();
      current.pop();
      used[i] = false;
    });
  }
  walk();
  return out;
}

/** Luas (banyak petak) dan keliling bangun pada kisi satuan. */
export function gridMeasures(cells: readonly (readonly [number, number])[]): { area: number; perimeter: number } {
  const set = new Set(cells.map(([r, c]) => `${r},${c}`));
  let perimeter = 0;
  for (const [r, c] of cells) {
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (!set.has(`${r + dr},${c + dc}`)) perimeter += 1;
    }
  }
  return { area: set.size, perimeter };
}
