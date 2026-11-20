import { describe, expect, it } from 'vitest';
import { editionLabel, otherEditions, workIdFor } from './editions';

describe('edições em outros idiomas', () => {
  const pt = { id: 'pt', title: 'Harry Potter e a Pedra Filosofal', editionLanguage: 'Português' };
  it('o primeiro livro vira o "grupo" quando ainda não tem um', () => {
    expect(workIdFor(pt)).toBe('pt');
    expect(workIdFor({ ...pt, workId: 'w1' })).toBe('w1');
  });
  it('lista as outras edições do mesmo livro', () => {
    const books = [
      { ...pt, workId: 'pt' },
      { id: 'en', title: "Philosopher's Stone", editionLanguage: 'Inglês', workId: 'pt' },
      { id: 'es', title: 'La piedra filosofal', editionLanguage: 'Espanhol', workId: 'pt' },
      { id: 'x', title: 'Outro livro' },
    ];
    expect(otherEditions(books[0], books).map((b) => b.id)).toEqual(['es', 'en']);
    expect(otherEditions(books[3], books)).toEqual([]);
  });
  it('mostra o idioma do exemplar ou, se faltar, o idioma de leitura', () => {
    expect(editionLabel({ id: 'a', title: 'a', readingLanguage: 'Inglês' })).toBe('Inglês');
    expect(editionLabel({ id: 'a', title: 'a', editionLanguage: 'Espanhol', readingLanguage: 'Inglês' })).toBe('Espanhol');
  });
});
