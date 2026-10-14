import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { emptyAnswer, toResponse, type AnswerState, type ItemView } from './answers';
import { AnswerInput } from './AnswerInput';

function Harness({ item, onState }: { item: ItemView; onState: (a: AnswerState) => void }) {
  const [a, setA] = useState<AnswerState>(emptyAnswer(item));
  return <AnswerInput item={item} value={a} onChange={(n) => { setA(n); onState(n); }} />;
}
function setup(item: ItemView) {
  let last: AnswerState = emptyAnswer(item);
  render(<Harness item={item} onState={(a) => { last = a; }} />);
  return () => toResponse(last);
}
const opts = [{ id: 'a', text: 'Satu' }, { id: 'b', text: 'Dua' }, { id: 'c', text: 'Tiga' }];

describe('AnswerInput', () => {
  it('pilihan ganda: memilih satu opsi', async () => {
    const resp = setup({ answer_type: 'single_choice', options: opts, visual_data: null });
    await userEvent.click(screen.getByLabelText('Dua'));
    expect(resp()).toEqual({ choice: 'b' });
  });
  it('pilihan ganda kompleks: memilih dan membatalkan', async () => {
    const resp = setup({ answer_type: 'multi_choice', options: opts, visual_data: null });
    await userEvent.click(screen.getByLabelText('Satu'));
    await userEvent.click(screen.getByLabelText('Tiga'));
    await userEvent.click(screen.getByLabelText('Satu'));
    expect(resp()).toEqual({ choices: ['c'] });
  });
  it('benar/salah', async () => {
    const resp = setup({ answer_type: 'true_false', options: [], visual_data: null });
    await userEvent.click(screen.getByLabelText('Salah'));
    expect(resp()).toEqual({ value: false });
  });
  it('isian angka menerima koma desimal dan menolak teks', async () => {
    const resp = setup({ answer_type: 'numeric', options: [], visual_data: null });
    const input = screen.getByLabelText(/Jawabanmu/);
    await userEvent.type(input, 'abc');
    expect(screen.getByRole('alert')).toHaveTextContent('Tulis angka saja');
    await userEvent.clear(input);
    await userEvent.type(input, '3,5');
    expect(resp()).toEqual({ value: 3.5 });
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('urutan: tombol naik dan turun menukar posisi, tombol tepi dinonaktifkan', async () => {
    const resp = setup({ answer_type: 'ordering', options: opts, visual_data: null });
    expect(screen.getByRole('button', { name: 'Naikkan: Satu' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Turunkan: Satu' }));
    expect(resp()).toEqual({ order: ['b', 'a', 'c'] });
  });
  it('pencocokan: memilih pasangan lewat daftar', async () => {
    const resp = setup({
      answer_type: 'matching', visual_data: null,
      options: { left: [{ id: 'l1', text: 'Kiri 1' }], right: [{ id: 'r1', text: 'Kanan 1' }, { id: 'r2', text: 'Kanan 2' }] },
    });
    await userEvent.selectOptions(screen.getByLabelText('Kiri 1'), 'r2');
    expect(resp()).toEqual({ pairs: [{ left: 'l1', right: 'r2' }] });
  });
  it('kisi petak: ditandai dengan teks, bukan hanya warna', async () => {
    const resp = setup({ answer_type: 'visual', options: [], visual_data: { kind: 'grid_select', rows: 2, cols: 2 } });
    await userEvent.click(screen.getByRole('button', { name: 'Baris 2, kolom 1' }));
    expect(screen.getByRole('button', { name: 'Baris 2, kolom 1, terpilih' })).toHaveAttribute('aria-pressed', 'true');
    expect(resp()).toEqual({ cells: [[1, 0]] });
  });
  it('puzzle logika: petunjuk dibacakan dalam kalimat dan posisi dipilih', async () => {
    const resp = setup({
      answer_type: 'logic_puzzle', options: [],
      visual_data: { kind: 'position_clues', slots: 2, entities: [{ id: 'x', text: 'Ani' }, { id: 'y', text: 'Budi' }], clues: [{ type: 'at', entity: 'x', slot: 1 }] },
    });
    expect(screen.getByText('Ani berada di posisi 1.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Posisi 1'), 'x');
    await userEvent.selectOptions(screen.getByLabelText('Posisi 2'), 'y');
    expect(resp()).toEqual({ arrangement: ['x', 'y'] });
  });
});
