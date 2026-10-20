import { describe, expect, it } from 'vitest';
import type { Book } from '../db';
import type { BookMeta } from '../data/hooks';
import { applyFilters, groupToFilter, matches, sortBooks } from './filters';

const b = (id: string, over: Partial<Book>): Book => ({
  id, title: id, authors: [], status: 'lido', favorite: false, rating: 0, genres: [], tags: [], createdAt: id, updatedAt: '', ...over,
});
const books = [
  b('a', { genres: ['Fantasia'], readingLanguage: 'Inglês', status: 'lido', rating: 9, pageCount: 500 }),
  b('b', { genres: ['Fantasia'], readingLanguage: 'Português', status: 'lido', favorite: true, pageCount: 300 }),
  b('c', { genres: ['Fantasia', 'Romance'], readingLanguage: 'Inglês', status: 'lendo', pageCount: 100 }),
  b('d', { genres: ['Policial'], readingLanguage: 'Inglês', status: 'lido', rating: 6 }),
];
const meta = new Map<string, BookMeta>([
  ['a', { pct: 100, page: 500, years: ['2025'], finishedAt: '2025-03-01' }],
  ['b', { pct: 100, page: 300, years: ['2026'], finishedAt: '2026-01-01' }],
  ['c', { pct: 30, page: 30, years: ['2026'] }],
  ['d', { pct: 100, page: 0, years: ['2026'], finishedAt: '2026-02-01' }],
]);

describe('filtros combináveis', () => {
  it('Fantasia + Lidos + Inglês', () => {
    const r = applyFilters(books, meta, { ...groupToFilter('genero', 'Fantasia'), status: 'lido', language: 'Inglês' });
    expect(r.map((x) => x.id)).toEqual(['a']);
  });
  it('favorito, nota mínima e ano de leitura', () => {
    expect(applyFilters(books, meta, { favorite: true }).map((x) => x.id)).toEqual(['b']);
    expect(applyFilters(books, meta, { minRating: 6 }).map((x) => x.id)).toEqual(['a', 'd']);
    expect(applyFilters(books, meta, { year: '2026', genre: 'Fantasia' }).map((x) => x.id)).toEqual(['b', 'c']);
  });
  it('ordena por páginas e por conclusão', () => {
    expect(sortBooks(books, meta, 'paginas', true).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(sortBooks(books, meta, 'conclusao', false).map((x) => x.id)).toEqual(['c', 'a', 'b', 'd']);
  });
  it('busca ignora acentos e maiúsculas', () => {
    expect(matches('Ficção Científica', 'ficcao')).toBe(true);
  });
});
