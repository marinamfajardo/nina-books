import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { NinaDB } from '../db';
import { enqueueAll, fetchMissingMedia, pendingCount, syncNow, type RemoteRecord, type SyncBackend } from './engine';

// localStorage simples para o ambiente de teste
beforeAll(() => {
  const m = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k),
    clear: () => m.clear(), key: () => null, length: 0,
  };
});

/** Nuvem falsa: guarda registros com horário de modificação crescente. */
function fakeCloud() {
  const rows = new Map<string, RemoteRecord>();
  const files = new Map<string, Blob>();
  let clock = Date.parse('2026-01-01T00:00:00Z');
  const backend: SyncBackend = {
    async push(records) {
      for (const r of records) rows.set(`${r.tbl}:${r.id}`, { ...r, data: r.data ? structuredClone(r.data) : null, modified_at: new Date(clock++).toISOString() });
    },
    async pull(since, limit) {
      return [...rows.values()].filter((r) => !since || r.modified_at >= since).sort((a, b) => a.modified_at.localeCompare(b.modified_at)).slice(0, limit);
    },
    async uploadMedia(id, blob) { files.set(id, blob); },
    async downloadMedia(id) { return files.get(id) ?? null; },
    async deleteMedia(id) { files.delete(id); },
  };
  return { backend, rows, files };
}

const book = (id: string, title: string) => ({
  id, title, authors: ['A'], status: 'lido' as const, favorite: false, rating: 0, genres: [], tags: [], createdAt: '', updatedAt: '',
});

describe('sincronização entre aparelhos', () => {
  it('o que é feito no celular aparece no iPad e vice-versa', async () => {
    const cloud = fakeCloud();
    const phone = new NinaDB('celular-1');
    const ipad = new NinaDB('ipad-1');

    await phone.books.add(book('b1', 'Torto Arado'));
    await phone.sessions.add({ id: 's1', bookId: 'b1', readingId: 'r1', date: '2026-01-02', startPage: 0, endPage: 50, createdAt: '' });
    expect(await pendingCount(phone)).toBe(2);
    await syncNow(cloud.backend, phone);
    expect(await pendingCount(phone)).toBe(0);

    await syncNow(cloud.backend, ipad);
    expect((await ipad.books.get('b1'))?.title).toBe('Torto Arado');
    expect(await ipad.sessions.count()).toBe(1);
    // o que veio da nuvem não volta para a fila
    expect(await pendingCount(ipad)).toBe(0);

    await ipad.books.update('b1', { rating: 9 });
    await ipad.goals.put({ year: 2026, books: 30 });
    await syncNow(cloud.backend, ipad);
    await syncNow(cloud.backend, phone);
    expect((await phone.books.get('b1'))?.rating).toBe(9);
    expect((await phone.goals.get(2026))?.books).toBe(30);
  });

  it('apagar num aparelho apaga no outro (inclusive com where().delete())', async () => {
    const cloud = fakeCloud();
    const a = new NinaDB('a-2');
    const b = new NinaDB('b-2');
    await a.books.bulkAdd([book('x', 'X'), book('y', 'Y')]);
    await a.notes.bulkAdd([{ id: 'n1', bookId: 'x', kind: 'texto', text: 'oi', createdAt: '' }, { id: 'n2', bookId: 'x', kind: 'texto', text: 'olá', createdAt: '' }]);
    await syncNow(cloud.backend, a);
    await syncNow(cloud.backend, b);
    expect(await b.notes.count()).toBe(2);

    await a.notes.where('bookId').equals('x').delete();
    await a.books.delete('y');
    await syncNow(cloud.backend, a);
    await syncNow(cloud.backend, b);
    expect(await b.notes.count()).toBe(0);
    expect(await b.books.get('y')).toBeUndefined();
    expect(await b.books.get('x')).toBeDefined();
  });

  it('fotos, áudios e vídeos vão para a nuvem e são baixados no outro aparelho', async () => {
    const cloud = fakeCloud();
    const a = new NinaDB('a-3');
    const b = new NinaDB('b-3');
    await a.media.add({ id: 'm1', blob: new Blob(['audio-bytes'], { type: 'audio/mp4' }), type: 'audio/mp4', name: 'impressões', createdAt: '' });
    await syncNow(cloud.backend, a);
    expect(cloud.files.has('m1')).toBe(true);
    expect(cloud.rows.get('media:m1')?.data).not.toHaveProperty('blob');

    await syncNow(cloud.backend, b);
    const meta = await b.media.get('m1');
    expect(meta?.name).toBe('impressões');
    expect(meta?.blob).toBeUndefined();
    const blob = await fetchMissingMedia(cloud.backend, 'm1', b);
    expect(await blob?.text()).toBe('audio-bytes');
    expect(await (await b.media.get('m1'))?.blob?.text()).toBe('audio-bytes');
    expect(await pendingCount(b)).toBe(0);
  });

  it('ao conectar pela primeira vez, envia o que já existia no aparelho e junta com a nuvem', async () => {
    const cloud = fakeCloud();
    const a = new NinaDB('a-4');
    const b = new NinaDB('b-4');
    await a.books.add(book('a1', 'Do celular'));
    await a._outbox.clear(); // como se tivesse sido criado antes da sincronização existir
    await b.books.add(book('b1', 'Do iPad'));
    await b._outbox.clear();

    await enqueueAll(a);
    await syncNow(cloud.backend, a);
    await enqueueAll(b);
    await syncNow(cloud.backend, b);
    await syncNow(cloud.backend, a);
    expect((await a.books.toArray()).map((x) => x.title).sort()).toEqual(['Do celular', 'Do iPad']);
    expect((await b.books.toArray()).map((x) => x.title).sort()).toEqual(['Do celular', 'Do iPad']);
  });

  it('mudança local ainda não enviada não é sobrescrita pela nuvem', async () => {
    const cloud = fakeCloud();
    const a = new NinaDB('a-5');
    const b = new NinaDB('b-5');
    await a.books.add(book('k', 'Original'));
    await syncNow(cloud.backend, a);
    await syncNow(cloud.backend, b);
    await a.books.update('k', { title: 'Editado no celular' });
    await syncNow(cloud.backend, a);
    await b.books.update('k', { title: 'Editado no iPad depois' });
    await syncNow(cloud.backend, b); // envia primeiro, depois recebe
    expect((await b.books.get('k'))?.title).toBe('Editado no iPad depois');
    await syncNow(cloud.backend, a);
    expect((await a.books.get('k'))?.title).toBe('Editado no iPad depois');
  });
});
