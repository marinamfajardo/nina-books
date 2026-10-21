import type { Book, Reading, Session } from '../db';
import { daysBetween, sessionPages, sessionWords } from './stats';

const finishedIn = (readings: Reading[], bookId: string, year?: string) =>
  readings.filter((r) => r.bookId === bookId && r.outcome === 'concluida' && r.finishedAt && (!year || r.finishedAt.startsWith(year)));

/**
 * Ranking dos livros lidos: nota (maior primeiro), depois favorito, depois quem terminou mais recentemente.
 * Com `year`, só os livros concluídos naquele ano.
 */
export function rankBooks(books: Book[], readings: Reading[], year?: string) {
  return books
    .map((b) => {
      const fin = finishedIn(readings, b.id, year);
      return { book: b, finishedAt: fin.map((r) => r.finishedAt!).sort().pop(), times: fin.length };
    })
    .filter((x) => x.times > 0 || (!year && (x.book.status === 'lido' || x.book.status === 'relendo')))
    .sort((a, b) =>
      b.book.rating - a.book.rating ||
      Number(b.book.favorite) - Number(a.book.favorite) ||
      (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '') ||
      a.book.title.localeCompare(b.book.title, 'pt-BR'),
    );
}

export interface AuthorStats {
  name: string;
  books: Book[];
  /** livros concluídos (contando cada livro uma vez) */
  booksRead: number;
  /** leituras concluídas (inclui releituras) */
  readsCount: number;
  pages: number;
  words: number;
  seconds: number;
  sessions: number;
  avgRating: number; // 0–10, só livros avaliados
  favorites: number;
  firstRead?: string;
  lastRead?: string;
  genres: { key: string; count: number }[];
  languages: { key: string; count: number }[];
  pagesByYear: { key: string; pages: number }[];
  /** dias médios entre começar e terminar */
  avgDaysToFinish?: number;
}

const tally = (values: string[]) => {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'pt-BR'));
};

/** Estatísticas de cada autor (um livro com dois autores conta para os dois). */
export function authorStats(books: Book[], readings: Reading[], sessions: Session[], year?: string): AuthorStats[] {
  const byBook = new Map(books.map((b) => [b.id, b]));
  const map = new Map<string, AuthorStats>();
  const get = (name: string) => {
    if (!map.has(name)) {
      map.set(name, { name, books: [], booksRead: 0, readsCount: 0, pages: 0, words: 0, seconds: 0, sessions: 0, avgRating: 0, favorites: 0, genres: [], languages: [], pagesByYear: [] });
    }
    return map.get(name)!;
  };
  for (const b of books) for (const a of b.authors) get(a).books.push(b);

  const yearPages = new Map<string, Map<string, number>>();
  for (const s of sessions) {
    if (year && !s.date.startsWith(year)) continue;
    const b = byBook.get(s.bookId);
    if (!b) continue;
    for (const a of b.authors) {
      const st = get(a);
      st.pages += sessionPages(s);
      st.words += sessionWords(s, b);
      st.seconds += s.durationSec ?? 0;
      st.sessions += 1;
      if (!yearPages.has(a)) yearPages.set(a, new Map());
      const y = s.date.slice(0, 4);
      yearPages.get(a)!.set(y, (yearPages.get(a)!.get(y) ?? 0) + sessionPages(s));
    }
  }

  for (const st of map.values()) {
    const ids = new Set(st.books.map((b) => b.id));
    const done = readings.filter((r) => ids.has(r.bookId) && r.outcome === 'concluida' && r.finishedAt && (!year || r.finishedAt.startsWith(year)));
    st.readsCount = done.length;
    st.booksRead = new Set(done.map((r) => r.bookId)).size;
    const dates = done.map((r) => r.finishedAt!).sort();
    st.firstRead = dates[0];
    st.lastRead = dates[dates.length - 1];
    const spans = done.map((r) => daysBetween(r.startedAt, r.finishedAt!) + 1).filter((d) => d > 0);
    st.avgDaysToFinish = spans.length ? spans.reduce((a, b) => a + b, 0) / spans.length : undefined;
    const rated = st.books.filter((b) => b.rating > 0);
    st.avgRating = rated.length ? rated.reduce((a, b) => a + b.rating, 0) / rated.length : 0;
    st.favorites = st.books.filter((b) => b.favorite).length;
    st.genres = tally(st.books.flatMap((b) => b.genres));
    st.languages = tally(st.books.map((b) => b.readingLanguage).filter(Boolean) as string[]);
    st.pagesByYear = [...(yearPages.get(st.name) ?? new Map<string, number>())].map(([key, pages]) => ({ key, pages })).sort((a, b) => a.key.localeCompare(b.key));
  }
  return [...map.values()];
}

export type AuthorSort = 'livros' | 'paginas' | 'nota';
export function rankAuthors(stats: AuthorStats[], by: AuthorSort) {
  const v = (s: AuthorStats) => (by === 'livros' ? s.booksRead : by === 'paginas' ? s.pages : s.avgRating);
  return stats
    .filter((s) => (by === 'nota' ? s.avgRating > 0 : v(s) > 0))
    .sort((a, b) => v(b) - v(a) || b.booksRead - a.booksRead || b.pages - a.pages || a.name.localeCompare(b.name, 'pt-BR'));
}

/** Estatísticas de leitura de um livro (todas as leituras ou uma). */
export function bookReadingStats(book: Book, sessions: Session[], readings: Reading[]) {
  const timed = sessions.filter((s) => (s.durationSec ?? 0) > 0);
  const secs = timed.reduce((a, s) => a + (s.durationSec ?? 0), 0);
  const pages = sessions.reduce((a, s) => a + sessionPages(s), 0);
  const manual = sessions.filter((s) => !s.auto);
  const days = new Set(sessions.map((s) => s.date)).size;
  const done = readings.filter((r) => r.outcome === 'concluida' && r.finishedAt);
  const spans = done.map((r) => daysBetween(r.startedAt, r.finishedAt!) + 1);
  return {
    pages,
    words: sessions.reduce((a, s) => a + sessionWords(s, book), 0),
    seconds: secs,
    sessions: manual.length,
    readingDays: days,
    pagesPerSession: manual.length ? manual.reduce((a, s) => a + sessionPages(s), 0) / manual.length : 0,
    pagesPerHour: secs ? timed.reduce((a, s) => a + sessionPages(s), 0) / (secs / 3600) : 0,
    minutesPerPage: secs && pages ? secs / 60 / timed.reduce((a, s) => a + sessionPages(s), 0) : 0,
    timesRead: done.length,
    daysToFinish: spans.length ? spans[spans.length - 1] : undefined,
  };
}
