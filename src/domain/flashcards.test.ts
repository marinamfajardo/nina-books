import { describe, expect, it } from 'vitest';
import { isDue, MAX_BOX, review } from './flashcards';

describe('flashcards (Leitner)', () => {
  it('acerto sobe de caixa e espaça a revisão', () => {
    expect(review(1, true, '2026-05-10')).toEqual({ box: 2, nextReview: '2026-05-12' });
    expect(review(3, true, '2026-05-10')).toEqual({ box: 4, nextReview: '2026-05-18' });
  });
  it('erro volta para a caixa 1', () => {
    expect(review(5, false, '2026-05-10')).toEqual({ box: 1, nextReview: '2026-05-11' });
  });
  it('não passa da última caixa', () => {
    expect(review(MAX_BOX, true, '2026-05-10').box).toBe(MAX_BOX);
  });
  it('sabe quando a carta está para revisar', () => {
    expect(isDue('2026-05-10', '2026-05-10')).toBe(true);
    expect(isDue('2026-05-11', '2026-05-10')).toBe(false);
  });
});

describe('rodadas de revisão', () => {
  it('cada rodada tem todas as palavras, uma vez cada', async () => {
    const { newRound } = await import('./flashcards');
    const words = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
    const r = newRound(words);
    expect(r.map((w) => w.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('a nova rodada não começa pela palavra que acabou de sair', async () => {
    const { newRound } = await import('./flashcards');
    const words = ['a', 'b', 'c'].map((id) => ({ id }));
    for (let i = 0; i < 30; i++) expect(newRound(words, 'c')[0].id).not.toBe('c');
  });
});
