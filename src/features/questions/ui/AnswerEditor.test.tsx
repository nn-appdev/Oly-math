import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { QuestionPayload } from '../model';
import { questionProblems } from '../validate';
import { AnswerEditor } from './AnswerEditor';
import { defaultsFor, emptyPayload } from './defaults';

function Harness({ type, onState }: { type: QuestionPayload['answer_type']; onState: (q: QuestionPayload) => void }) {
  const [q, setQ] = useState<QuestionPayload>({ ...emptyPayload(), answer_type: type, ...defaultsFor(type) });
  onState(q);
  return <AnswerEditor q={q} onChange={(p) => setQ((c) => ({ ...c, ...p }))} />;
}

describe('AnswerEditor', () => {
  it('pilihan tunggal: meminta miskonsepsi untuk opsi salah dan menerima setelah lengkap', async () => {
    let last!: QuestionPayload;
    render(<Harness type="single_choice" onState={(q) => { last = q; }} />);
    for (const [i, t] of ['5', '7', '12', '17'].entries()) {
      await userEvent.type(screen.getByLabelText(`Opsi ${'ABCD'[i]}`), t);
    }
    await userEvent.click(screen.getAllByRole('radio')[1] as HTMLElement);
    expect(last.answer_key).toEqual({ correct: 'b' });
    expect(questionProblems(last, null)).toContain('Opsi "A" yang salah belum diberi miskonsepsi yang ditargetkan.');
    for (const id of ['A', 'C', 'D']) await userEvent.type(screen.getByLabelText(`Miskonsepsi pada opsi ${id}`), 'salah hitung');
    const optProblems = questionProblems(last, null).filter((p) => /Opsi|opsi|Kunci/.test(p));
    expect(optProblems).toEqual([]);
  });
  it('pilihan tunggal: opsi benar tidak memiliki kolom miskonsepsi', async () => {
    render(<Harness type="single_choice" onState={() => undefined} />);
    expect(screen.queryByLabelText('Miskonsepsi pada opsi A')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Miskonsepsi pada opsi B')).toBeInTheDocument();
  });
  it('pilihan tunggal: jumlah opsi dibatasi 2 sampai 6', async () => {
    render(<Harness type="single_choice" onState={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tambah opsi' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tambah opsi' }));
    expect(screen.queryByRole('button', { name: 'Tambah opsi' })).not.toBeInTheDocument();
    for (let i = 0; i < 4; i += 1) await userEvent.click(screen.getAllByRole('button', { name: /Hapus opsi/ })[0] as HTMLElement);
    screen.getAllByRole('button', { name: /Hapus opsi/ }).forEach((b) => expect(b).toBeDisabled());
  });
  it('urutan: kunci mengikuti urutan penulisan dan tombol naik/turun menukar butir', async () => {
    let last!: QuestionPayload;
    render(<Harness type="ordering" onState={(q) => { last = q; }} />);
    expect(last.answer_key).toEqual({ order: ['a', 'b', 'c'] });
    await userEvent.click(screen.getByRole('button', { name: 'Turunkan butir 1' }));
    expect(last.answer_key).toEqual({ order: ['b', 'a', 'c'] });
  });
  it('mencocokkan: kunci memasangkan baris yang sama', async () => {
    let last!: QuestionPayload;
    render(<Harness type="matching" onState={(q) => { last = q; }} />);
    expect(last.answer_key).toEqual({ pairs: [{ left: 'l1', right: 'r1' }, { left: 'l2', right: 'r2' }, { left: 'l3', right: 'r3' }] });
    await userEvent.click(screen.getByRole('button', { name: 'Hapus pasangan 2' }));
    expect(last.answer_key).toEqual({ pairs: [{ left: 'l1', right: 'r1' }, { left: 'l3', right: 'r3' }] });
  });
  it('geometri: kunci dihitung otomatis dari petak yang dipilih', async () => {
    let last!: QuestionPayload;
    render(<Harness type="geometry_puzzle" onState={(q) => { last = q; }} />);
    for (const label of ['Baris 1, kolom 1', 'Baris 1, kolom 2', 'Baris 2, kolom 1', 'Baris 2, kolom 2']) {
      await userEvent.click(screen.getByRole('button', { name: label }));
    }
    expect(last.answer_key).toEqual({ value: 4 });
    await userEvent.selectOptions(screen.getByLabelText('Yang ditanyakan'), 'perimeter');
    expect(last.answer_key).toEqual({ value: 8 });
    expect(screen.getByRole('status')).toHaveTextContent('Kunci otomatis: 8 satuan');
  });
  it('puzzle logika: melaporkan jumlah solusi dan mengisi kunci saat tunggal', async () => {
    let last!: QuestionPayload;
    render(<Harness type="logic_puzzle" onState={(q) => { last = q; }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Tambahkan petunjuk.');
    await userEvent.click(screen.getByRole('button', { name: 'Tambah petunjuk' }));
    expect(screen.getByRole('status')).toHaveTextContent('Ada 2 solusi');
    await userEvent.click(screen.getByRole('button', { name: 'Tambah petunjuk' }));
    // petunjuk kedua dijadikan: e2 berada di depan e3
    const relation = screen.getAllByLabelText('Hubungan')[1] as HTMLElement;
    await userEvent.selectOptions(relation, 'left_of');
    await userEvent.selectOptions(screen.getByLabelText('Tokoh lain'), 'e3');
    await userEvent.selectOptions(screen.getAllByLabelText('Tokoh')[1] as HTMLElement, 'e2');
    expect(screen.getByRole('status')).toHaveTextContent('Solusi tunggal');
    expect(last.answer_key).toEqual({ arrangement: ['e1', 'e2', 'e3'] });
  });
  it('visual: petak kunci dipertahankan saat kisi diperkecil', async () => {
    let last!: QuestionPayload;
    render(<Harness type="visual" onState={(q) => { last = q; }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Baris 3, kolom 3' }));
    expect(last.answer_key).toEqual({ cells: [[2, 2]] });
    const rows = screen.getByLabelText('Baris (1–10)');
    await userEvent.clear(rows);
    await userEvent.type(rows, '2');
    expect(last.answer_key).toEqual({ cells: [] });
  });
});
