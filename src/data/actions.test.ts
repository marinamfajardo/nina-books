import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { totals } from '../domain/stats';
import { addSession, changeStatus, createBook, deleteBook, importBooks, readingsOf, renameListItem } from './actions';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

const newBook = (over = {}) => createBook({ title: 'O Livro', authors: ['Autora'], pageCount: 300, ...over });

describe('status e leituras', () => {
  it('marcar Lido sem sessões conta o livro inteiro na data informada', async () => {
    const id = await newBook();
    await changeStatus(id, 'lido', '2026-03-10');
    const ss = await db.sessions.toArray();
    expect(ss).toHaveLength(1);
    expect(ss[0]).toMatchObject({ date: '2026-03-10', startPage: 0, endPage: 300, auto: true });
    const [r] = await readingsOf(id);
    expect(r).toMatchObject({ outcome: 'concluida', finishedAt: '2026-03-10' });
  });

  it('marcar Lido completa só as páginas que faltam', async () => {
    const id = await newBook();
    await changeStatus(id, 'lendo', '2026-03-01');
    await addSession(id, { date: '2026-03-02', startPage: 0, endPage: 120 });
    await changeStatus(id, 'lido', '2026-03-05');
    const ss = (await db.sessions.toArray()).sort((a, b) => a.date.localeCompare(b.date));
    expect(ss.map((s) => [s.startPage, s.endPage])).toEqual([[0, 120], [120, 300]]);
  });

  it('Desisti conta só o que foi lido', async () => {
    const id = await newBook();
    await addSession(id, { date: '2026-03-02', startPage: 0, endPage: 80 });
    expect((await db.books.get(id))?.status).toBe('lendo');
    await changeStatus(id, 'desisti', '2026-03-03');
    const book = (await db.books.get(id))!;
    expect(totals(await db.sessions.toArray(), new Map([[id, book]])).pages).toBe(80);
    expect((await readingsOf(id))[0].outcome).toBe('abandonada');
  });

  it('Relendo abre uma nova leitura e guarda o histórico', async () => {
    const id = await newBook();
    await changeStatus(id, 'lido', '2025-01-10');
    await changeStatus(id, 'relendo', '2026-02-01');
    await addSession(id, { date: '2026-02-02', startPage: 0, endPage: 50 });
    await changeStatus(id, 'lido', '2026-02-20');
    const rs = await readingsOf(id);
    expect(rs.map((r) => [r.number, r.outcome, r.finishedAt])).toEqual([[1, 'concluida', '2025-01-10'], [2, 'concluida', '2026-02-20']]);
    expect(totals(await db.sessions.toArray(), new Map()).pages).toBe(600);
  });
});

describe('listas', () => {
  it('renomeia um gênero em todos os livros', async () => {
    const id = await newBook({ genres: ['Fantasia', 'Romance'] });
    await renameListItem('genre', 'Fantasia', 'Fantasia épica');
    expect((await db.books.get(id))?.genres).toEqual(['Fantasia épica', 'Romance']);
    await renameListItem('genre', 'Romance', null);
    expect((await db.books.get(id))?.genres).toEqual(['Fantasia épica']);
  });
});

describe('importação e exclusão', () => {
  it('importa pulando ISBN repetido', async () => {
    await newBook({ isbn: '9788535914849' });
    const r = await importBooks([
      { book: { title: 'Repetido', authors: [], isbn: '9788535914849' } },
      { book: { title: 'Novo', authors: ['X'], pageCount: 100, status: 'lido' }, startedAt: '2024-01-01', finishedAt: '2024-01-15' },
    ]);
    expect(r).toEqual({ added: 1, skipped: 1 });
    const novo = (await db.books.toArray()).find((b) => b.title === 'Novo')!;
    expect(novo.status).toBe('lido');
    expect((await readingsOf(novo.id))[0]).toMatchObject({ startedAt: '2024-01-01', finishedAt: '2024-01-15' });
  });

  it('apagar livro remove tudo ligado a ele', async () => {
    const id = await newBook();
    await addSession(id, { date: '2026-01-01', startPage: 0, endPage: 10 });
    await db.notes.add({ id: 'n1', bookId: id, kind: 'texto', text: 'oi', createdAt: '' });
    await deleteBook(id);
    expect(await db.books.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.notes.count()).toBe(0);
    expect(await db.readings.count()).toBe(0);
  });
});
