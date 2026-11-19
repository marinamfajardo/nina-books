import { describe, expect, it } from 'vitest';
import { clampRating, ratingLabel, ratingSections, ratingTitle } from './rating';

describe('avaliação estendida', () => {
  it('rótulos de notas negativas, normais e acima de 5', () => {
    expect(ratingLabel(-2)).toBe('−1');
    expect(ratingLabel(-1)).toBe('−½');
    expect(ratingLabel(9)).toBe('4,5');
    expect(ratingLabel(12)).toBe('6');
    expect(ratingTitle(12)).toBe('6 estrelas ✨');
    expect(ratingTitle(2)).toBe('1 estrela');
    expect(ratingTitle(-2)).toBe('−1 estrela');
  });
  it('limita entre −1 e 7 estrelas', () => {
    expect(clampRating(-5)).toBe(-2);
    expect(clampRating(30)).toBe(14);
  });
  it('agrupa da maior para a menor, negativas depois e sem nota no fim', () => {
    const s = ratingSections([
      { title: 'A', rating: 10 }, { title: 'B', rating: 0 }, { title: 'C', rating: -2 },
      { title: 'D', rating: 12 }, { title: 'E', rating: 8 }, { title: 'F', rating: 10 },
    ]);
    expect(s.map((x) => x.rating)).toEqual([12, 10, 8, -2, 0]);
    expect(s[1].items.map((x) => x.title)).toEqual(['A', 'F']);
  });
});
