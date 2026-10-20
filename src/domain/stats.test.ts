import { describe, expect, it } from 'vitest';
import type { Book, Reading, Session } from '../db';
import {
  averagePagesPerDay, closingSession, currentPage, finishedByPeriod, goalProgress, isoWeekKey,
  pagesPerHour, progressPercent, ratingDistribution, sessionPages, sessionWords, streaks, totals,
  totalsByGroup, totalsByPeriod, wordsPerPage,
} from './stats';

const book = (over: Partial<Book> = {}): Book => ({
  id: 'b1', title: 'Livro', authors: ['Autora'], status: 'lendo', favorite: false, rating: 0,
  genres: [], tags: [], createdAt: '', updatedAt: '', ...over,
});

let n = 0;
const session = (over: Partial<Session>): Session => ({
  id: `s${n++}`, bookId: 'b1', readingId: 'r1', date: '2026-01-01', startPage: 0, endPage: 0, createdAt: '', ...over,
});

describe('páginas e palavras', () => {
  it('conta as páginas de uma sessão e nunca dá negativo', () => {
    expect(sessionPages({ startPage: 10, endPage: 30 })).toBe(20);
    expect(sessionPages({ startPage: 30, endPage: 10 })).toBe(0);
  });

  it('usa 250 palavras por página por padrão', () => {
    expect(wordsPerPage(book())).toBe(250);
    expect(sessionWords(session({ startPage: 0, endPage: 10 }), book())).toBe(2500);
  });

  it('usa o valor editado do livro', () => {
    expect(wordsPerPage(book({ wordsPerPage: 300 }))).toBe(300);
  });

  it('prefere o total de palavras informado', () => {
    const b = book({ totalWords: 100_000, pageCount: 400, wordsPerPage: 300 });
    expect(wordsPerPage(b)).toBe(250);
    expect(sessionWords(session({ startPage: 0, endPage: 40 }), b)).toBe(10_000);
  });

  it('calcula página atual e porcentagem', () => {
    const ss = [session({ endPage: 50 }), session({ startPage: 50, endPage: 120 }), session({ readingId: 'r2', endPage: 300 })];
    expect(currentPage(ss, 'r1')).toBe(120);
    expect(progressPercent(120, 240)).toBe(50);
    expect(progressPercent(500, 240)).toBe(100);
    expect(progressPercent(10, undefined)).toBe(0);
  });
});

describe('fechamento ao marcar Lido', () => {
  it('cria sessão só com as páginas que faltam', () => {
    const ss = [session({ startPage: 0, endPage: 120 })];
    expect(closingSession(ss, 'r1', 300)).toEqual({ startPage: 120, endPage: 300 });
  });
  it('não cria nada se já registrou tudo', () => {
    expect(closingSession([session({ endPage: 300 })], 'r1', 300)).toBeNull();
  });
  it('livro inteiro quando não há sessões', () => {
    expect(closingSession([], 'r1', 200)).toEqual({ startPage: 0, endPage: 200 });
  });
  it('"Desisti" conta só o que foi lido de fato', () => {
    const ss = [session({ startPage: 0, endPage: 80 })];
    const b = book({ status: 'desisti', pageCount: 400 });
    expect(totals(ss, new Map([['b1', b]])).pages).toBe(80);
  });
});

describe('agregações', () => {
  const b1 = book({ id: 'b1', genres: ['Fantasia', 'Romance'], readingLanguage: 'Inglês' });
  const b2 = book({ id: 'b2', genres: ['Policial'], readingLanguage: 'Português', wordsPerPage: 300 });
  const books = new Map([['b1', b1], ['b2', b2]]);
  const ss = [
    session({ bookId: 'b1', date: '2025-12-30', startPage: 0, endPage: 10, durationSec: 1800 }),
    session({ bookId: 'b1', date: '2026-01-02', startPage: 10, endPage: 40 }),
    session({ bookId: 'b2', date: '2026-02-10', startPage: 0, endPage: 20, durationSec: 1800 }),
  ];

  it('soma geral de páginas e palavras', () => {
    expect(totals(ss, books)).toMatchObject({ pages: 60, words: 40 * 250 + 20 * 300, sessions: 3, seconds: 3600 });
  });

  it('agrupa por ano e mês', () => {
    expect(totalsByPeriod(ss, books, 'ano').map((t) => [t.key, t.pages])).toEqual([['2025', 10], ['2026', 50]]);
    expect(totalsByPeriod(ss, books, 'mes').map((t) => [t.key, t.pages])).toEqual([['2025-12', 10], ['2026-01', 30], ['2026-02', 20]]);
  });

  it('agrupa por semana ISO (virada de ano)', () => {
    expect(isoWeekKey('2025-12-30')).toBe('2026-S01');
    expect(isoWeekKey('2026-01-02')).toBe('2026-S01');
    expect(isoWeekKey('2026-02-10')).toBe('2026-S07');
  });

  it('livro com dois gêneros conta em ambos', () => {
    const g = totalsByGroup(ss, books, 'genero');
    expect(g.find((x) => x.key === 'Fantasia')?.pages).toBe(40);
    expect(g.find((x) => x.key === 'Romance')?.pages).toBe(40);
    expect(g.find((x) => x.key === 'Policial')?.pages).toBe(20);
  });

  it('agrupa por idioma de leitura', () => {
    const g = totalsByGroup(ss, books, 'idioma');
    expect(g.map((x) => [x.key, x.pages])).toEqual([['Inglês', 40], ['Português', 20]]);
  });

  it('ritmo em páginas por hora usa só sessões cronometradas', () => {
    expect(pagesPerHour(ss)).toBe(30); // 30 páginas em 1 hora
  });

  it('média de páginas por dia inclui dias sem leitura', () => {
    expect(averagePagesPerDay(ss, '2026-01-01', '2026-01-10')).toBe(3);
  });
});

describe('sequência de dias', () => {
  const s = (date: string) => session({ date, startPage: 0, endPage: 5 });
  it('conta dias seguidos até hoje', () => {
    expect(streaks([s('2026-03-01'), s('2026-03-02'), s('2026-03-03')], '2026-03-03')).toEqual({ current: 3, best: 3 });
  });
  it('mantém a sequência se ainda não leu hoje', () => {
    expect(streaks([s('2026-03-01'), s('2026-03-02')], '2026-03-03').current).toBe(2);
  });
  it('zera depois de um dia sem leitura e guarda o recorde', () => {
    const r = streaks([s('2026-02-01'), s('2026-02-02'), s('2026-02-03'), s('2026-03-01')], '2026-03-03');
    expect(r).toEqual({ current: 0, best: 3 });
  });
});

describe('metas e livros concluídos', () => {
  const readings: Reading[] = [
    { id: 'r1', bookId: 'b1', number: 1, startedAt: '2026-01-01', finishedAt: '2026-01-20', outcome: 'concluida' },
    { id: 'r2', bookId: 'b2', number: 1, startedAt: '2026-02-01', finishedAt: '2026-03-05', outcome: 'concluida' },
    { id: 'r3', bookId: 'b3', number: 1, startedAt: '2026-02-01', finishedAt: '2026-03-06', outcome: 'abandonada' },
    { id: 'r4', bookId: 'b4', number: 1, startedAt: '2025-02-01', finishedAt: '2025-03-06', outcome: 'concluida' },
  ];
  it('conta só leituras concluídas', () => {
    expect(finishedByPeriod(readings, 'ano')).toEqual([{ key: '2025', count: 1 }, { key: '2026', count: 2 }]);
  });
  it('calcula progresso da meta', () => {
    const ss = [session({ date: '2026-01-05', endPage: 500 })];
    const g = goalProgress(2026, readings, ss, { books: 10, pages: 1000 }, '2026-07-02');
    expect(g.booksDone).toBe(2);
    expect(g.booksPct).toBe(20);
    expect(g.pagesDone).toBe(500);
    expect(g.pagesPct).toBe(50);
    expect(g.booksExpected).toBe(5);
  });
});

describe('notas', () => {
  it('distribui notas com meia estrela', () => {
    const d = ratingDistribution([book({ rating: 9 }), book({ rating: 9 }), book({ rating: 4 }), book({ rating: 0 })]);
    expect(d.find((x) => x.rating === 4.5)?.count).toBe(2);
    expect(d.find((x) => x.rating === 2)?.count).toBe(1);
    expect(d.reduce((s, x) => s + x.count, 0)).toBe(3);
  });
});
