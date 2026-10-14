export const cellKey = (r: number, c: number) => `${r},${c}`;

/** Kisi petak yang dapat diklik; ditandai dengan teks (bukan hanya warna) agar dapat dibaca pembaca layar. */
export function CellGrid({ rows, cols, selected, onToggle, label, disabled }: {
  rows: number; cols: number; selected: ReadonlySet<string>; onToggle: (r: number, c: number) => void; label: string; disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 2.75rem)` }}>
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const on = selected.has(cellKey(r, c));
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            aria-label={`Baris ${r + 1}, kolom ${c + 1}${on ? ', terpilih' : ''}`}
            onClick={() => onToggle(r, c)}
            className={`h-11 w-11 rounded-lg border-2 text-lg font-extrabold ${on ? 'border-teal-800 bg-teal-600 text-white' : 'border-[#CFDCD7] bg-white'}`}
          >
            {on ? '✓' : ''}
          </button>
        );
      })}
    </div>
  );
}
