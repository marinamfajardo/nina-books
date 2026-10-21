import { db as defaultDb, SYNCED_TABLES, type Media, type NinaDB } from '../db';
import { markRemote, stamp } from './outbox';

/** Um registro como fica guardado na nuvem. */
export interface RemoteRecord {
  tbl: string;
  id: string;
  data: Record<string, unknown> | null;
  deleted: boolean;
  modified_at: string;
}

/** O que o motor de sincronização precisa do serviço na nuvem. */
export interface SyncBackend {
  push(records: Omit<RemoteRecord, 'modified_at'>[]): Promise<void>;
  /** Registros alterados a partir de `since`, em ordem de modificação. */
  pull(since: string | null, limit: number): Promise<RemoteRecord[]>;
  uploadMedia(id: string, blob: Blob): Promise<void>;
  downloadMedia(id: string): Promise<Blob | null>;
  deleteMedia(id: string): Promise<void>;
}

export const MAX_MEDIA_BYTES = 50 * 1024 * 1024; // limite por arquivo do plano gratuito

const cursorKey = (d: NinaDB) => `nina.sync.cursor:${d.name}`;
const PAGE = 500;
/** Relê um pouco do passado para não perder gravações que chegaram fora de ordem */
const OVERLAP_MS = 5 * 60 * 1000;

const keyOf = (tbl: string, id: string): string | number => (tbl === 'goals' ? Number(id) : id);

export interface SyncResult { pushed: number; pulled: number; skippedMedia: string[] }

/** Coloca tudo o que existe no aparelho na fila (primeira vez que conecta). */
export async function enqueueAll(db: NinaDB = defaultDb) {
  for (const tbl of SYNCED_TABLES) {
    const keys = await db.table(tbl).toCollection().primaryKeys();
    await db._outbox.bulkPut(keys.map((k) => ({ k: `${tbl}:${String(k)}`, tbl, id: String(k), t: stamp() })));
  }
}

export const pendingCount = (db: NinaDB = defaultDb) => db._outbox.count();

async function push(db: NinaDB, backend: SyncBackend, skippedMedia: string[]) {
  let pushed = 0;
  for (;;) {
    const batch = await db._outbox.limit(200).toArray();
    if (!batch.length) break;
    const records: Omit<RemoteRecord, 'modified_at'>[] = [];
    for (const item of batch) {
      const row = await db.table(item.tbl).get(keyOf(item.tbl, item.id));
      if (!row) {
        records.push({ tbl: item.tbl, id: item.id, data: null, deleted: true });
        if (item.tbl === 'media') await backend.deleteMedia(item.id).catch(() => {});
        continue;
      }
      if (item.tbl === 'media') {
        const m = row as Media;
        const { blob, ...meta } = m;
        if (blob) {
          if (blob.size > MAX_MEDIA_BYTES) {
            skippedMedia.push(m.name || m.id);
            continue; // fica só neste aparelho
          }
          await backend.uploadMedia(m.id, blob);
        }
        records.push({ tbl: 'media', id: m.id, data: { ...meta, size: blob?.size ?? m.size }, deleted: false });
        continue;
      }
      records.push({ tbl: item.tbl, id: item.id, data: row, deleted: false });
    }
    if (records.length) await backend.push(records);
    // só remove da fila o que não mudou de novo enquanto enviava
    await db.transaction('rw', db._outbox, async () => {
      for (const b of batch) {
        const cur = await db._outbox.get(b.k);
        if (cur && cur.t === b.t) await db._outbox.delete(b.k);
      }
    });
    pushed += records.length;
    if (batch.length < 200) break;
  }
  return pushed;
}

async function pull(db: NinaDB, backend: SyncBackend) {
  let pulled = 0;
  let cursor = localStorage.getItem(cursorKey(db));
  let since = cursor ? new Date(new Date(cursor).getTime() - OVERLAP_MS).toISOString() : null;
  for (;;) {
    const rows = await backend.pull(since, PAGE);
    if (!rows.length) break;
    const pending = new Set((await db._outbox.toArray()).map((o) => o.k));
    await db.transaction('rw', SYNCED_TABLES.map((t) => db.table(t)), async () => {
      markRemote();
      for (const r of rows) {
        if (pending.has(`${r.tbl}:${r.id}`)) continue; // mudança local mais nova ainda não enviada
        if (!(SYNCED_TABLES as readonly string[]).includes(r.tbl)) continue;
        const table = db.table(r.tbl);
        if (r.deleted || !r.data) {
          await table.delete(keyOf(r.tbl, r.id));
        } else if (r.tbl === 'media') {
          const local = (await table.get(r.id)) as Media | undefined;
          await table.put({ ...(r.data as unknown as Media), blob: local?.blob });
        } else {
          await table.put(r.data);
        }
      }
    });
    pulled += rows.length;
    const last = rows[rows.length - 1].modified_at;
    if (!cursor || last > cursor) cursor = last;
    if (rows.length < PAGE) break;
    // página cheia com o mesmo horário: avança sem repetir
    since = last === since ? new Date(new Date(last).getTime() + 1).toISOString() : last;
  }
  if (cursor) localStorage.setItem(cursorKey(db), cursor);
  return pulled;
}

const running = new Map<string, Promise<SyncResult>>();

/** Envia as mudanças deste aparelho e depois traz as dos outros. */
export function syncNow(backend: SyncBackend, db: NinaDB = defaultDb): Promise<SyncResult> {
  const current = running.get(db.name);
  if (current) return current;
  const p = (async () => {
    const skippedMedia: string[] = [];
    try {
      const pushed = await push(db, backend, skippedMedia);
      const pulled = await pull(db, backend);
      return { pushed, pulled, skippedMedia };
    } finally {
      running.delete(db.name);
    }
  })();
  running.set(db.name, p);
  return p;
}

/** Baixa da nuvem um arquivo que veio de outro aparelho. */
export async function fetchMissingMedia(backend: SyncBackend, id: string, db: NinaDB = defaultDb) {
  const m = await db.media.get(id);
  if (!m || m.blob) return m?.blob ?? null;
  const blob = await backend.downloadMedia(id);
  if (!blob) return null;
  const typed = blob.type ? blob : new Blob([blob], { type: m.type });
  await db.transaction('rw', db.media, async () => {
    markRemote();
    await db.media.update(id, { blob: typed });
  });
  return typed;
}

export const resetSyncCursor = (db: NinaDB = defaultDb) => localStorage.removeItem(cursorKey(db));
