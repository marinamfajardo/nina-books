import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db, type Book, type ListKind, type Reading, type Session } from '../db';
import { currentPage, progressPercent } from '../domain/stats';

export interface BookMeta {
  pct: number;
  page: number;
  /** Anos em que houve leitura concluída ou sessões */
  years: string[];
  finishedAt?: string;
  startedAt?: string;
}

export interface Library {
  books: Book[];
  readings: Reading[];
  sessions: Session[];
  bookMap: Map<string, Book>;
  meta: Map<string, BookMeta>;
  loaded: boolean;
}

export function useLibrary(): Library {
  const books = useLiveQuery(() => db.books.toArray(), []);
  const readings = useLiveQuery(() => db.readings.toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  return useMemo(() => {
    const b = books ?? [];
    const r = readings ?? [];
    const s = sessions ?? [];
    const meta = new Map<string, BookMeta>();
    const byBookSessions = new Map<string, Session[]>();
    for (const x of s) {
      if (!byBookSessions.has(x.bookId)) byBookSessions.set(x.bookId, []);
      byBookSessions.get(x.bookId)!.push(x);
    }
    const byBookReadings = new Map<string, Reading[]>();
    for (const x of r) {
      if (!byBookReadings.has(x.bookId)) byBookReadings.set(x.bookId, []);
      byBookReadings.get(x.bookId)!.push(x);
    }
    for (const book of b) {
      const rs = (byBookReadings.get(book.id) ?? []).sort((a, c) => a.number - c.number);
      const ss = byBookSessions.get(book.id) ?? [];
      const last = rs[rs.length - 1];
      const page = last ? currentPage(ss, last.id) : 0;
      const years = new Set<string>();
      for (const x of rs) if (x.finishedAt && x.outcome === 'concluida') years.add(x.finishedAt.slice(0, 4));
      for (const x of ss) years.add(x.date.slice(0, 4));
      const finished = rs.filter((x) => x.outcome === 'concluida' && x.finishedAt).map((x) => x.finishedAt!).sort();
      meta.set(book.id, {
        page,
        pct: book.status === 'lido' ? 100 : progressPercent(page, book.pageCount),
        years: [...years].sort().reverse(),
        finishedAt: finished[finished.length - 1],
        startedAt: rs[0]?.startedAt,
      });
    }
    return {
      books: b, readings: r, sessions: s,
      bookMap: new Map(b.map((x) => [x.id, x])),
      meta,
      loaded: books !== undefined && readings !== undefined && sessions !== undefined,
    };
  }, [books, readings, sessions]);
}

export function useList(kind: ListKind) {
  const items = useLiveQuery(() => db.lists.where('kind').equals(kind).toArray(), [kind]);
  return useMemo(() => [...new Set((items ?? []).map((i) => i.name))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [items]);
}

export const useBook = (id?: string) => useLiveQuery(() => (id ? db.books.get(id) : undefined), [id]);
