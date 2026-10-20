import type { BookDraft } from '../components/BookForm';
import { db, type Book } from '../db';
import { downloadCover } from '../services/bookLookup';
import { changeStatus, createBook, saveMedia, updateBook } from './actions';

async function resolveCover(d: BookDraft, previous?: Book) {
  if (d.coverBlob) return { coverId: await saveMedia(d.coverBlob, 'capa'), coverUrl: undefined };
  if (d.coverUrl && d.coverUrl !== previous?.coverUrl && !d.coverId) {
    const blob = await downloadCover(d.coverUrl);
    if (blob) return { coverId: await saveMedia(blob, 'capa'), coverUrl: d.coverUrl };
  }
  return { coverId: d.coverId, coverUrl: d.coverUrl };
}

export async function createFromDraft(d: BookDraft) {
  const { coverBlob: _, id: _id, ...rest } = d;
  const cover = await resolveCover(d);
  return createBook({ ...rest, ...cover });
}

export async function updateFromDraft(id: string, d: BookDraft) {
  const prev = await db.books.get(id);
  if (!prev) return;
  const { coverBlob: _, id: _id, createdAt: _c, status, ...rest } = d;
  const cover = await resolveCover(d, prev);
  if (cover.coverId !== prev.coverId && prev.coverId) await db.media.delete(prev.coverId);
  await updateBook(id, { ...rest, ...cover });
  if (status && status !== prev.status) await changeStatus(id, status);
}
