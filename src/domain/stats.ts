import type { Book, Reading, Session } from '../db';
import { DEFAULT_WORDS_PER_PAGE } from './constants';

// ---------- Datas (sempre no fuso local, formato AAAA-MM-DD) ----------

export const toDateKey = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const today = () => toDateKey(new Date());

export const parseDateKey = (key: string) => {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key: string, days: number) => {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
};

export const daysBetween = (a: string, b: string) =>
  Math.round((parseDateKey(b).getTime() - parseDateKey(a).getTime()) / 86_400_000);

/** Semana ISO no formato AAAA-Www */
export const isoWeekKey = (key: string) => {
  const d = parseDateKey(key);
  const day = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - day + 3); // quinta-feira da semana
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-S${String(week).padStart(2, '0')}`;
};

export type Period = 'ano' | 'mes' | 'semana' | 'dia';
export const periodKey = (date: string, period: Period) => {
  switch (period) {
    case 'ano': return date.slice(0, 4);
    case 'mes': return date.slice(0, 7);
    case 'semana': return isoWeekKey(date);
    case 'dia': return date.slice(0, 10);
  }
};

// ---------- Páginas e palavras ----------

/** Páginas lidas numa sessão: da página inicial até a final (nunca negativo). */
export const sessionPages = (s: Pick<Session, 'startPage' | 'endPage'>) =>
  Math.max(0, (s.endPage ?? 0) - (s.startPage ?? 0));

/**
 * Palavras por página do livro: se o total de palavras foi informado,
 * usa total ÷ páginas; senão o valor editável do livro (padrão 250).
 */
export const wordsPerPage = (book: Pick<Book, 'totalWords' | 'pageCount' | 'wordsPerPage'>) => {
  if (book.totalWords && book.pageCount) return book.totalWords / book.pageCount;
  return book.wordsPerPage || DEFAULT_WORDS_PER_PAGE;
};

export const sessionWords = (s: Session, book?: Pick<Book, 'totalWords' | 'pageCount' | 'wordsPerPage'>) =>
  sessionPages(s) * (book ? wordsPerPage(book) : DEFAULT_WORDS_PER_PAGE);

/** Página atual de uma leitura = maior página final registrada. */
export const currentPage = (sessions: Session[], readingId?: string) =>
  sessions
    .filter((s) => !readingId || s.readingId === readingId)
    .reduce((max, s) => Math.max(max, s.endPage), 0);

export const progressPercent = (page: number, total?: number) =>
  total && total > 0 ? Math.min(100, Math.round((page / total) * 100)) : 0;

/**
 * Sessão de fechamento criada ao marcar um livro como Lido:
 * cobre só as páginas que ainda não foram registradas naquela leitura.
 * Retorna null se não falta nada (ou se o livro não tem nº de páginas).
 * Para "Desisti" esta função não é usada — contam só as páginas lidas.
 */
export const closingSession = (
  sessions: Session[],
  readingId: string,
  pageCount: number | undefined,
): { startPage: number; endPage: number } | null => {
  if (!pageCount) return null;
  const page = currentPage(sessions, readingId);
  if (page >= pageCount) return null;
  return { startPage: page, endPage: pageCount };
};

// ---------- Agregações ----------

export interface Totals { pages: number; words: number; sessions: number; seconds: number }
const emptyTotals = (): Totals => ({ pages: 0, words: 0, sessions: 0, seconds: 0 });

const addSession = (t: Totals, s: Session, book?: Book) => {
  t.pages += sessionPages(s);
  t.words += sessionWords(s, book);
  t.sessions += 1;
  t.seconds += s.durationSec ?? 0;
};

export const filterByRange = (sessions: Session[], from?: string, to?: string) =>
  sessions.filter((s) => (!from || s.date >= from) && (!to || s.date <= to));

export const totals = (sessions: Session[], books: Map<string, Book>): Totals => {
  const t = emptyTotals();
  for (const s of sessions) addSession(t, s, books.get(s.bookId));
  return t;
};

/** Totais por período (ano, mês, semana ou dia), em ordem cronológica. */
export const totalsByPeriod = (sessions: Session[], books: Map<string, Book>, period: Period) => {
  const map = new Map<string, Totals>();
  for (const s of sessions) {
    const k = periodKey(s.date, period);
    if (!map.has(k)) map.set(k, emptyTotals());
    addSession(map.get(k)!, s, books.get(s.bookId));
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, t]) => ({ key, ...t }));
};

export type GroupBy = 'genero' | 'idioma' | 'autor' | 'status' | 'formato';

export const bookGroupValues = (book: Book, by: GroupBy): string[] => {
  switch (by) {
    case 'genero': return book.genres.length ? book.genres : ['Sem gênero'];
    case 'idioma': return [book.readingLanguage || 'Sem idioma'];
    case 'autor': return book.authors.length ? book.authors : ['Sem autor'];
    case 'status': return [book.status];
    case 'formato': return [book.format || 'Sem formato'];
  }
};

/**
 * Totais por grupo. Um livro com dois gêneros conta inteiro em cada gênero
 * (por isso a soma dos grupos pode passar do total geral).
 */
export const totalsByGroup = (sessions: Session[], books: Map<string, Book>, by: GroupBy) => {
  const map = new Map<string, Totals>();
  for (const s of sessions) {
    const book = books.get(s.bookId);
    if (!book) continue;
    for (const g of bookGroupValues(book, by)) {
      if (!map.has(g)) map.set(g, emptyTotals());
      addSession(map.get(g)!, s, book);
    }
  }
  return [...map.entries()].map(([key, t]) => ({ key, ...t })).sort((a, b) => b.pages - a.pages);
};

/** Livros concluídos (leituras concluídas) por período. */
export const finishedByPeriod = (readings: Reading[], period: Period) => {
  const map = new Map<string, number>();
  for (const r of readings) {
    if (r.outcome !== 'concluida' || !r.finishedAt) continue;
    const k = periodKey(r.finishedAt, period);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({ key, count }));
};

/** Sequência de dias seguidos lendo. Conta até hoje, ou até ontem se hoje ainda não teve leitura. */
export const streaks = (sessions: Session[], ref = today()) => {
  const days = new Set(sessions.filter((s) => sessionPages(s) > 0 || (s.durationSec ?? 0) > 0).map((s) => s.date));
  let current = 0;
  let cursor = days.has(ref) ? ref : addDays(ref, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best };
};

/** Média de páginas por dia no intervalo (inclui dias sem leitura). */
export const averagePagesPerDay = (sessions: Session[], from: string, to: string) => {
  const days = daysBetween(from, to) + 1;
  if (days <= 0) return 0;
  const pages = filterByRange(sessions, from, to).reduce((sum, s) => sum + sessionPages(s), 0);
  return pages / days;
};

/** Ritmo: páginas por hora, usando só sessões com duração registrada. */
export const pagesPerHour = (sessions: Session[]) => {
  const timed = sessions.filter((s) => (s.durationSec ?? 0) > 0);
  const secs = timed.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);
  if (!secs) return 0;
  return timed.reduce((sum, s) => sum + sessionPages(s), 0) / (secs / 3600);
};

export const ratingDistribution = (books: Book[]) => {
  const dist = Array.from({ length: 11 }, (_, i) => ({ rating: i / 2, count: 0 }));
  for (const b of books) if (b.rating > 0) dist[Math.round(b.rating)].count++;
  return dist.slice(1);
};

export const countBy = (books: Book[], by: 'genero' | 'idioma') => {
  const map = new Map<string, number>();
  for (const b of books) for (const g of bookGroupValues(b, by)) map.set(g, (map.get(g) ?? 0) + 1);
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
};

/** Progresso da meta anual. */
export const goalProgress = (
  year: number,
  readings: Reading[],
  sessions: Session[],
  goal: { books?: number; pages?: number } | undefined,
  ref = today(),
) => {
  const y = String(year);
  const booksDone = readings.filter((r) => r.outcome === 'concluida' && r.finishedAt?.startsWith(y)).length;
  const pagesDone = sessions.filter((s) => s.date.startsWith(y)).reduce((sum, s) => sum + sessionPages(s), 0);
  const start = `${y}-01-01`;
  const end = `${y}-12-31`;
  const totalDays = daysBetween(start, end) + 1;
  const elapsed = ref < start ? 0 : ref > end ? totalDays : daysBetween(start, ref) + 1;
  const expectedFraction = elapsed / totalDays;
  const pct = (done: number, target?: number) => (target ? Math.min(100, Math.round((done / target) * 100)) : 0);
  return {
    booksDone,
    pagesDone,
    booksPct: pct(booksDone, goal?.books),
    pagesPct: pct(pagesDone, goal?.pages),
    /** Quantos livros já deveriam estar lidos para estar no ritmo */
    booksExpected: goal?.books ? Math.floor(goal.books * expectedFraction) : 0,
    pagesExpected: goal?.pages ? Math.floor(goal.pages * expectedFraction) : 0,
  };
};

export const formatNumber = (n: number) => Math.round(n).toLocaleString('pt-BR');

export const formatDuration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h) return `${h}h ${String(m).padStart(2, '0')}min`;
  if (m) return `${m}min`;
  return `${Math.round(sec)}s`;
};

// ---------- Calendário e tempo por gênero ----------

/** Páginas lidas em cada dia (AAAA-MM-DD → páginas). */
export const pagesByDay = (sessions: Session[]) => {
  const m = new Map<string, number>();
  for (const s of sessions) m.set(s.date, (m.get(s.date) ?? 0) + sessionPages(s));
  return m;
};

/** Segundos por página no seu ritmo (sessões cronometradas); 90 s se ainda não houver dados. */
export const secondsPerPage = (sessions: Session[]) => {
  const pph = pagesPerHour(sessions);
  return pph > 0 ? 3600 / pph : 90;
};

export interface GenreTime { key: string; pages: number; recordedSec: number; estimatedSec: number; pagesPerHour: number; books: number }

/**
 * Tempo de leitura por gênero. `recordedSec` soma só o cronometrado;
 * `estimatedSec` completa as sessões sem cronômetro usando o seu ritmo médio.
 */
export function timeByGenre(sessions: Session[], books: Map<string, Book>): GenreTime[] {
  const spp = secondsPerPage(sessions);
  const map = new Map<string, GenreTime & { timedPages: number; ids: Set<string> }>();
  for (const s of sessions) {
    const b = books.get(s.bookId);
    if (!b) continue;
    for (const g of bookGroupValues(b, 'genero')) {
      if (!map.has(g)) map.set(g, { key: g, pages: 0, recordedSec: 0, estimatedSec: 0, pagesPerHour: 0, books: 0, timedPages: 0, ids: new Set() });
      const t = map.get(g)!;
      const p = sessionPages(s);
      t.pages += p;
      t.ids.add(b.id);
      if (s.durationSec) {
        t.recordedSec += s.durationSec;
        t.estimatedSec += s.durationSec;
        t.timedPages += p;
      } else {
        t.estimatedSec += p * spp;
      }
    }
  }
  return [...map.values()]
    .map(({ timedPages, ids, ...t }) => ({ ...t, books: ids.size, pagesPerHour: t.recordedSec ? timedPages / (t.recordedSec / 3600) : 0 }))
    .sort((a, b) => b.estimatedSec - a.estimatedSec);
}
