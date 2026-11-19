import { describe, expect, it } from 'vitest';
import { sliceAtTop, spinTarget } from './wheel';

describe('roleta', () => {
  it('para exatamente na fatia sorteada', () => {
    for (const n of [1, 2, 5, 7, 23]) {
      let rot = 0;
      for (let i = 0; i < n; i++) {
        rot = spinTarget(rot, i, n);
        expect(sliceAtTop(rot, n)).toBe(i);
      }
    }
  });
  it('sempre gira para frente, com pelo menos 5 voltas', () => {
    const t = spinTarget(1000, 2, 6);
    expect(t - 1000).toBeGreaterThanOrEqual(360 * 4);
  });
});

describe('o que entra na roleta', () => {
  const b = (id: string, status: string, series?: string, n?: number) => ({ id, title: id, status, series, seriesNumber: n });
  it('livros avulsos da fila e só o próximo volume de cada saga', async () => {
    const { wheelEntries } = await import('./wheel');
    const e = wheelEntries([
      b('Circe', 'quero_ler'),
      b('Lido avulso', 'lido'),
      b('VA1', 'lido', 'Vampire Academy', 1), b('VA2', 'lido', 'Vampire Academy', 2),
      b('VA3', 'quero_ler', 'Vampire Academy', 3), b('VA6', 'quero_ler', 'Vampire Academy', 6),
      b('HP1', 'quero_ler', 'Harry Potter', 1), b('HP2', 'quero_ler', 'Harry Potter', 2),
    ]);
    expect(e.map((x) => x.book.id).sort()).toEqual(['Circe', 'HP1', 'VA3']);
    expect(e.find((x) => x.book.id === 'VA3')?.label).toBe('Vampire Academy 3');
  });
  it('saga em andamento ou com o próximo volume fora da fila não entra', async () => {
    const { wheelEntries } = await import('./wheel');
    expect(wheelEntries([b('A1', 'lendo', 'A', 1), b('A2', 'quero_ler', 'A', 2)])).toEqual([]);
    // o volume 2 não está na fila (sem status de quero ler): não pula para o 3
    expect(wheelEntries([b('B1', 'lido', 'B', 1), b('B2', 'desisti', 'B', 2), b('B3', 'quero_ler', 'B', 3)]).map((x) => x.book.id)).toEqual(['B3']);
  });
  it('nome da saga com acento/maiúscula diferente conta como a mesma', async () => {
    const { wheelEntries } = await import('./wheel');
    const e = wheelEntries([b('X1', 'lido', 'Crônicas', 1), b('X2', 'quero_ler', 'cronicas', 2), b('X3', 'quero_ler', 'Crônicas', 3)]);
    expect(e.map((x) => x.book.id)).toEqual(['X2']);
  });
});
