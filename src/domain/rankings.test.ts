import { describe, expect, it } from 'vitest';
import type { Book, Reading, Session } from '../db';
import { authorStats, bookReadingStats, rankAuthors, rankBooks } from './rankings';

const b = (id: string, over: Partial<Book>): Book => ({
  id, title: id, authors: ['A'], status: 'lido', favorite: false, rating: 0, genres: [], tags: [], createdAt: '', updatedAt: '', ...over,
});
const r = (bookId: string, finishedAt: string, outcome: Reading['outcome'] = 'concluida', startedAt = finishedAt.slice(0, 8) + '01'): Reading => ({
  id: `${bookId}-${finishedAt}`, bookId, number: 1, startedAt, finishedAt, outcome,
});
let n = 0;
const s = (bookId: string, date: string, start: number, end: number, durationSec?: number, auto?: boolean): Session => ({
  id: `s${n++}`, bookId, readingId: 'x', date, startPage: start, endPage: end, durationSec, auto, createdAt: '',
});

const books = [
  b('Duna', { authors: ['Frank Herbert'], rating: 10, favorite: true, genres: ['Ficção científica'], readingLanguage: 'Inglês', pageCount: 600 }),
  b('Messias', { authors: ['Frank Herbert'], rating: 7, genres: ['Ficção científica'], readingLanguage: 'Inglês' }),
  b('Circe', { authors: ['Madeline Miller'], rating: 10, genres: ['Fantasia'] }),
  b('Boas Omens', { authors: ['Neil Gaiman', 'Terry Pratchett'], rating: 8, genres: ['Fantasia', 'Humor'] }),
  b('Largado', { authors: ['Madeline Miller'], status: 'desisti' }),
];
const readings = [r('Duna', '2025-03-20'), r('Messias', '2026-02-10'), r('Circe', '2026-01-15'), r('Boas Omens', '2026-05-01'), r('Largado', '2026-04-01', 'abandonada'), r('Duna', '2026-06-30')];
const sessions = [s('Duna', '2025-03-05', 0, 600), s('Messias', '2026-02-01', 0, 300, 3600), s('Circe', '2026-01-10', 0, 400), s('Largado', '2026-03-20', 0, 50), s('Duna', '2026-06-20', 0, 600)];

describe('ranking de livros', () => {
  it('ordena por nota, depois favorito, depois mais recente', () => {
    expect(rankBooks(books, readings).map((x) => x.book.id)).toEqual(['Duna', 'Circe', 'Boas Omens', 'Messias']);
  });
  it('filtra pelo ano de conclusão (releitura conta)', () => {
    expect(rankBooks(books, readings, '2025').map((x) => x.book.id)).toEqual(['Duna']);
    expect(rankBooks(books, readings, '2026').map((x) => x.book.id)).toEqual(['Duna', 'Circe', 'Boas Omens', 'Messias']);
  });
  it('não inclui livros abandonados', () => {
    expect(rankBooks(books, readings).some((x) => x.book.id === 'Largado')).toBe(false);
  });
});

describe('estatísticas por autor', () => {
  const stats = authorStats(books, readings, sessions);
  const herbert = stats.find((x) => x.name === 'Frank Herbert')!;
  const miller = stats.find((x) => x.name === 'Madeline Miller')!;

  it('soma livros, leituras e páginas', () => {
    expect(herbert.books).toHaveLength(2);
    expect(herbert.booksRead).toBe(2);
    expect(herbert.readsCount).toBe(3);
    expect(herbert.pages).toBe(1500);
    expect(herbert.firstRead).toBe('2025-03-20');
    expect(herbert.lastRead).toBe('2026-06-30');
    expect(herbert.pagesByYear).toEqual([{ key: '2025', pages: 600 }, { key: '2026', pages: 900 }]);
  });
  it('nota média só dos avaliados e páginas de livros abandonados', () => {
    expect(herbert.avgRating).toBe(8.5);
    expect(miller.avgRating).toBe(10);
    expect(miller.booksRead).toBe(1);
    expect(miller.pages).toBe(450);
  });
  it('coautoria conta para os dois autores', () => {
    expect(stats.find((x) => x.name === 'Neil Gaiman')?.booksRead).toBe(1);
    expect(stats.find((x) => x.name === 'Terry Pratchett')?.booksRead).toBe(1);
  });
  it('gêneros e idiomas do autor', () => {
    expect(herbert.genres).toEqual([{ key: 'Ficção científica', count: 2 }]);
    expect(herbert.languages).toEqual([{ key: 'Inglês', count: 2 }]);
  });
  it('ranking de autores por livros, páginas e nota', () => {
    expect(rankAuthors(stats, 'livros')[0].name).toBe('Frank Herbert');
    expect(rankAuthors(stats, 'paginas').map((x) => x.name).slice(0, 2)).toEqual(['Frank Herbert', 'Madeline Miller']);
    expect(rankAuthors(stats, 'nota')[0].name).toBe('Madeline Miller');
  });
  it('filtra por ano', () => {
    const y = authorStats(books, readings, sessions, '2025').find((x) => x.name === 'Frank Herbert')!;
    expect(y.pages).toBe(600);
    expect(y.booksRead).toBe(1);
  });
});

describe('estatísticas de leitura do livro', () => {
  it('ritmo, páginas por sessão e dias até terminar', () => {
    const bk = b('L', { pageCount: 200 });
    const ss = [s('L', '2026-01-01', 0, 30, 1800), s('L', '2026-01-02', 30, 90, 3600), s('L', '2026-01-05', 90, 200, undefined, true)];
    const st = bookReadingStats(bk, ss, [r('L', '2026-01-05', 'concluida', '2026-01-01')]);
    expect(st.pages).toBe(200);
    expect(st.sessions).toBe(2);
    expect(st.pagesPerSession).toBe(45);
    expect(st.pagesPerHour).toBe(60);
    expect(st.minutesPerPage).toBe(1);
    expect(st.readingDays).toBe(3);
    expect(st.daysToFinish).toBe(5);
    expect(st.words).toBe(200 * 250);
  });
});
