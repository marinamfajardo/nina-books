import { describe, expect, it } from 'vitest';
import { LITERATURE, pillOfDay, wikiUrl } from './inspiration';

describe('cartão do dia', () => {
  const d = new Date(2026, 10, 19);
  it('alterna os cinco tipos quando há palavras no glossário', () => {
    const kinds = new Set([0, 1, 2, 3, 4].map((o) => pillOfDay(d, o, [{ word: 'saudade', meaning: 'falta' }]).kind));
    expect(kinds).toEqual(new Set(['curiosidade', 'palavra', 'desafio', 'literatura', 'pergunta']));
  });
  it('sem glossário, não mostra o tipo palavra', () => {
    const kinds = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((o) => pillOfDay(d, o).kind));
    expect(kinds.has('palavra')).toBe(false);
    expect(kinds.has('literatura')).toBe(true);
  });
  it('mostra as palavras da leitora', () => {
    const words = [{ word: 'muggle', meaning: 'pessoa sem magia', bookTitle: 'Harry Potter' }];
    const p = [0, 1, 2, 3, 4].map((o) => pillOfDay(d, o, words)).find((x) => x.kind === 'palavra');
    expect(p).toEqual({ kind: 'palavra', word: words[0] });
  });
  it('temas de literatura têm link de busca na Wikipédia', () => {
    expect(LITERATURE.length).toBeGreaterThanOrEqual(15);
    expect(wikiUrl('Conto')).toBe('https://pt.wikipedia.org/wiki/Especial:Pesquisar?search=Conto&go=Ir');
  });
});
