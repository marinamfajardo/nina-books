import { describe, expect, it } from 'vitest';
import type { Reading } from '../db';
import { availableVouchers, medalFor, medals } from './achievements';

const r = (i: number, outcome: Reading['outcome'] = 'concluida'): Reading => ({
  id: `r${i}`, bookId: `b${i}`, number: 1, startedAt: '2026-01-01', finishedAt: `2026-02-${String(i).padStart(2, '0')}`, outcome,
});

describe('medalhas a cada 5 livros', () => {
  it('nenhuma medalha antes de 5 livros', () => {
    const m = medals([1, 2, 3, 4].map((i) => r(i)));
    expect(m.earned).toHaveLength(0);
    expect(m.remaining).toBe(1);
    expect(m.progressPct).toBe(80);
  });
  it('ganha uma medalha a cada 5 leituras concluídas, com a data do 5º livro', () => {
    const m = medals([...Array(12)].map((_, i) => r(i + 1)));
    expect(m.earned.map((x) => x.milestone)).toEqual([5, 10]);
    expect(m.earned[0].earnedAt).toBe('2026-02-05');
    expect(m.next.milestone).toBe(15);
    expect(m.remaining).toBe(3);
  });
  it('livros abandonados não contam', () => {
    const m = medals([...[1, 2, 3, 4].map((i) => r(i)), r(5, 'abandonada')]);
    expect(m.earned).toHaveLength(0);
  });
  it('vales-livro usados saem da conta', () => {
    const { earned } = medals([...Array(10)].map((_, i) => r(i + 1)));
    expect(availableVouchers(earned, { celebrated: 10, redeemed: { 5: { at: '2026-02-06', title: 'Circe' } } }).map((m) => m.milestone)).toEqual([10]);
  });
  it('nomes continuam depois da 10ª medalha', () => {
    expect(medalFor(5).name).toBe('Primeiros capítulos');
    expect(medalFor(55).name).toBe('Primeiros capítulos ✦');
  });
});
