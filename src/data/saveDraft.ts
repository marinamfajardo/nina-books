import type { BookDraft } from '../components/BookForm';
import { db, type Book } from '../db';
import { downloadCover } from '../services/bookLookup';
import { today } from '../domain/stats';
import { changeStatus, createBook, saveMedia, updateBook } from './actions';

async function resolveCover(d: BookDraft, previous?: Book) {
  if (d.coverBlob) return { coverId: await saveMedia(d.coverBlob, 'capa'), coverUrl: undefined };
  if (d.coverUrl && d.coverUrl !== previous?.coverUrl && !d.coverId) {
    const blob = await downloadCover(d.coverUrl);
    if (blob) return { coverId: await saveMedia(blob, 'capa'), coverUrl: d.coverUrl };
  }
  return { coverId: d.coverId, coverUrl: d.coverUrl };
}

/** Data de conclusão de um livro lido no passado: último dia do mês, ou 31/12 se só houver o ano. */
export function pastReadingDate(year?: number, month?: number) {
  if (!year || year < 1900 || year > 2100) return undefined;
  const now = today();
  if (month) {
    const last = new Date(year, month, 0).getDate();
    const date = `${year}-${String(month).padStart(2, '0')}-${last}`;
    return { date: date > now ? now : date, approx: 'mes' as const };
  }
  const date = `${year}-12-31`;
  return { date: date > now ? now : date, approx: 'ano' as const };
}

export async function createFromDraft(d: BookDraft) {
  const { coverBlob: _, id: _id, readYear, readMonth, ...rest } = d;
  const cover = await resolveCover(d);
  const finished = d.status === 'lido' ? pastReadingDate(readYear, readMonth) : undefined;
  return createBook({ ...rest, ...cover }, finished);
}

export async function updateFromDraft(id: string, d: BookDraft) {
  const prev = await db.books.get(id);
  if (!prev) return;
  const { coverBlob: _, id: _id, createdAt: _c, status, readYear: _y, readMonth: _m, ...rest } = d;
  const cover = await resolveCover(d, prev);
  if (cover.coverId !== prev.coverId && prev.coverId) await db.media.delete(prev.coverId);
  await updateBook(id, { ...rest, ...cover });
  if (status && status !== prev.status) await changeStatus(id, status);
}
