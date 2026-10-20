import { db, nowIso, uid, type Book, type ListKind, type Reading, type Status } from '../db';
import { DEFAULT_GENRES, DEFAULT_LANGUAGES } from '../domain/constants';
import { closingSession, today } from '../domain/stats';

export async function seedDefaults() {
  if ((await db.lists.count()) > 0) return;
  await db.lists.bulkAdd([
    ...DEFAULT_GENRES.map((name) => ({ id: uid(), kind: 'genre' as const, name })),
    ...DEFAULT_LANGUAGES.map((name) => ({ id: uid(), kind: 'language' as const, name })),
  ]);
}

export async function ensureListItems(kind: ListKind, names: (string | undefined)[]) {
  for (const raw of names) {
    const name = raw?.trim();
    if (!name) continue;
    const exists = await db.lists.where('[kind+name]').equals([kind, name]).first();
    if (!exists) await db.lists.add({ id: uid(), kind, name });
  }
}

const field: Record<ListKind, 'genres' | 'tags' | 'readingLanguage'> = {
  genre: 'genres', tag: 'tags', language: 'readingLanguage',
};

/** Renomeia (ou remove, se newName vazio) um gênero/tag/idioma em todos os livros. */
export async function renameListItem(kind: ListKind, oldName: string, newName: string | null) {
  await db.transaction('rw', db.lists, db.books, async () => {
    const item = await db.lists.where('[kind+name]').equals([kind, oldName]).first();
    if (item) {
      if (newName) await db.lists.update(item.id, { name: newName });
      else await db.lists.delete(item.id);
    }
    const f = field[kind];
    await db.books.toCollection().modify((b) => {
      if (f === 'readingLanguage') {
        if (b.readingLanguage === oldName) b.readingLanguage = newName ?? undefined;
      } else {
        const arr = b[f];
        if (arr.includes(oldName)) {
          b[f] = [...new Set(arr.map((x) => (x === oldName ? newName : x)).filter(Boolean) as string[])];
        }
      }
    });
  });
}

export type NewBook = Omit<Book, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'favorite' | 'rating' | 'genres' | 'tags'> &
  Partial<Pick<Book, 'status' | 'favorite' | 'rating' | 'genres' | 'tags'>>;

export async function findByIsbn(isbn?: string) {
  if (!isbn) return undefined;
  return db.books.where('isbn').equals(isbn).first();
}

export async function createBook(data: NewBook) {
  const book: Book = {
    status: 'quero_ler', favorite: false, rating: 0, genres: [], tags: [],
    ...data,
    id: uid(), createdAt: nowIso(), updatedAt: nowIso(),
  };
  await db.books.add(book);
  await ensureListItems('genre', book.genres);
  await ensureListItems('tag', book.tags);
  await ensureListItems('language', [book.readingLanguage]);
  if (book.status !== 'quero_ler') {
    const s = book.status;
    book.status = 'quero_ler';
    await changeStatus(book.id, s);
  }
  return book.id;
}

export async function updateBook(id: string, changes: Partial<Book>) {
  await db.books.update(id, { ...changes, updatedAt: nowIso() });
  if (changes.genres) await ensureListItems('genre', changes.genres);
  if (changes.tags) await ensureListItems('tag', changes.tags);
  if (changes.readingLanguage) await ensureListItems('language', [changes.readingLanguage]);
}

export async function openReading(bookId: string): Promise<Reading | undefined> {
  const rs = await db.readings.where('bookId').equals(bookId).toArray();
  return rs.find((r) => r.outcome === 'andamento');
}

export async function readingsOf(bookId: string) {
  return (await db.readings.where('bookId').equals(bookId).toArray()).sort((a, b) => a.number - b.number);
}

async function startReading(bookId: string, date: string) {
  const rs = await readingsOf(bookId);
  const r: Reading = { id: uid(), bookId, number: rs.length + 1, startedAt: date, outcome: 'andamento' };
  await db.readings.add(r);
  return r;
}

/**
 * Muda o status cuidando do histórico de leituras:
 * - Lendo/Relendo abre uma leitura (Relendo sempre começa uma nova);
 * - Lido fecha a leitura e registra as páginas que faltavam;
 * - Desisti fecha a leitura sem somar páginas extras.
 */
export async function changeStatus(bookId: string, status: Status, date = today()) {
  await db.transaction('rw', db.books, db.readings, db.sessions, async () => {
    const book = await db.books.get(bookId);
    if (!book) return;
    let open = await openReading(bookId);

    if (status === 'lendo' && !open) open = await startReading(bookId, date);
    if (status === 'relendo') {
      if (open && (await db.sessions.where('readingId').equals(open.id).count()) > 0) {
        await db.readings.update(open.id, { outcome: 'concluida', finishedAt: date });
        open = undefined;
      }
      if (!open) open = await startReading(bookId, date);
    }
    if (status === 'lido') {
      if (!open) open = await startReading(bookId, date);
      const sessions = await db.sessions.where('readingId').equals(open.id).toArray();
      const close = closingSession(sessions, open.id, book.pageCount);
      if (close) {
        await db.sessions.add({ id: uid(), bookId, readingId: open.id, date, ...close, auto: true, createdAt: nowIso() });
      }
      await db.readings.update(open.id, { outcome: 'concluida', finishedAt: date });
    }
    if (status === 'desisti' && open) {
      await db.readings.update(open.id, { outcome: 'abandonada', finishedAt: date });
    }
    await db.books.update(bookId, { status, updatedAt: nowIso() });
  });
}

export async function addSession(bookId: string, s: { date: string; startPage: number; endPage: number; durationSec?: number }) {
  const book = await db.books.get(bookId);
  let open = await openReading(bookId);
  if (!open) {
    open = await startReading(bookId, s.date);
    if (book && (book.status === 'quero_ler' || book.status === 'desisti')) {
      await db.books.update(bookId, { status: 'lendo', updatedAt: nowIso() });
    }
  }
  if (s.date < open.startedAt) await db.readings.update(open.id, { startedAt: s.date });
  await db.sessions.add({ id: uid(), bookId, readingId: open.id, ...s, createdAt: nowIso() });
}

export async function deleteBook(id: string) {
  await db.transaction('rw', [db.books, db.readings, db.sessions, db.notes, db.quotes, db.photos, db.loans, db.media, db.glossary], async () => {
    const book = await db.books.get(id);
    const notes = await db.notes.where('bookId').equals(id).toArray();
    const photos = await db.photos.where('bookId').equals(id).toArray();
    const mediaIds = [book?.coverId, ...notes.map((n) => n.mediaId), ...photos.map((p) => p.mediaId)].filter(Boolean) as string[];
    await db.media.bulkDelete(mediaIds);
    for (const t of [db.readings, db.sessions, db.notes, db.quotes, db.photos, db.loans]) {
      await t.where('bookId').equals(id).delete();
    }
    await db.glossary.where('bookId').equals(id).modify({ bookId: undefined });
    await db.books.delete(id);
  });
}

export async function saveMedia(blob: Blob, name?: string) {
  const id = uid();
  await db.media.add({ id, blob, type: blob.type, name, createdAt: nowIso() });
  return id;
}

/** Pede ao navegador para não apagar os dados do app automaticamente. */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* sem suporte */ }
}

/** Importa linhas de CSV, pulando ISBNs que já estão na estante. */
export async function importBooks(rows: { book: NewBook & { title: string }; startedAt?: string; finishedAt?: string }[]) {
  let added = 0;
  let skipped = 0;
  for (const row of rows) {
    if (await findByIsbn(row.book.isbn)) {
      skipped++;
      continue;
    }
    const status = row.book.status ?? 'quero_ler';
    const id = await createBook({ ...row.book, status: 'quero_ler' });
    if (status !== 'quero_ler') {
      const date = row.finishedAt ?? row.startedAt ?? today();
      // "Desisti" precisa de uma leitura aberta para fechar
      if (status === 'desisti') await changeStatus(id, 'lendo', date);
      await changeStatus(id, status, date);
      if (row.startedAt) {
        const rs = await readingsOf(id);
        if (rs[0]) await db.readings.update(rs[0].id, { startedAt: row.startedAt });
      }
    }
    added++;
  }
  return { added, skipped };
}
