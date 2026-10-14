import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Loaded } from '@/features/questions/hooks';
import type { MapNode } from '@/features/practice/types';
import { activityLabel, LearningMapPage } from './LearningMapPage';

const mk = (o: Partial<MapNode>): MapNode => ({
  id: '11111111-1111-4111-8111-111111111111', code: 'BIL-1-01', domain: 'bilangan', title: 'Nilai tempat', grade_min: 1, grade_max: 1,
  objectives: '', available: true, question_count: 5, attempted_items: 0, correct_items: 0, last_practiced_at: null, prerequisites: [], ...o,
});
let state: Loaded<{ grade: number | null; nodes: MapNode[] }>;
vi.mock('@/features/practice/hooks', () => ({ useLearningMap: () => [state, () => undefined] }));
const renderPage = () => render(<MemoryRouter><LearningMapPage /></MemoryRouter>);

describe('LearningMapPage', () => {
  it('mengelompokkan materi per domain dan menautkan ke materi', () => {
    state = { status: 'ready', data: { grade: 1, nodes: [mk({}), mk({ id: '22222222-2222-4222-8222-222222222222', code: 'GEO-1-01', domain: 'geometri', title: 'Bangun datar' })] } };
    renderPage();
    const geo = screen.getByRole('region', { name: 'Geometri dan pengukuran' });
    expect(within(geo).getByText('Bangun datar')).toBeInTheDocument();
    expect(within(geo).getByRole('link', { name: /Buka materi/ })).toHaveAttribute('href', '/siswa/materi/22222222-2222-4222-8222-222222222222');
    expect(screen.queryByRole('region', { name: 'Data dan pengukuran' })).toBeNull();
  });
  it('keterangan aktivitas netral dan tidak menyatakan penguasaan', () => {
    expect(activityLabel(mk({ available: false }))).toBe('Soal belum tersedia');
    expect(activityLabel(mk({ attempted_items: 3, correct_items: 3 }))).toBe('Kamu sudah mencoba 3 soal');
    expect(activityLabel(mk({ attempted_items: 3, correct_items: 3 }))).not.toMatch(/kuasai|mahir|lulus/i);
  });
  it('menampilkan galat dengan tombol coba lagi', () => {
    state = { status: 'error', message: 'Koneksi bermasalah.' };
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Koneksi bermasalah.');
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });
});
