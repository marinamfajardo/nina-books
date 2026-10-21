import Dexie, { type DBCore, type DBCoreMutateRequest, type DBCoreTable } from 'dexie';

/** Tabelas cujas mudanças vão para a nuvem. */
const TRACKED = new Set([
  'books', 'readings', 'sessions', 'notes', 'quotes', 'photos',
  'glossary', 'goals', 'loans', 'wishlist', 'lists', 'media',
]);
const OUTBOX = '_outbox';
let seq = 0;
/** Marca de versão: muda a cada gravação, para saber se o item mudou durante o envio. */
export const stamp = () => Date.now() * 1000 + (seq++ % 1000);

/** Marca a transação atual como "vinda da nuvem" (não volta para a fila). */
export function markRemote() {
  const tx = Dexie.currentTransaction as unknown as { idbtrans?: { __remote?: boolean } } | null;
  if (tx?.idbtrans) tx.idbtrans.__remote = true;
}

async function affectedKeys(table: DBCoreTable, req: DBCoreMutateRequest): Promise<unknown[]> {
  const keyPath = table.schema.primaryKey.keyPath as string;
  switch (req.type) {
    case 'add':
    case 'put':
      return req.keys ?? req.values.map((v) => (v as Record<string, unknown>)[keyPath]);
    case 'delete':
      return req.keys;
    case 'deleteRange': {
      const r = await table.query({ trans: req.trans, values: false, query: { index: table.schema.primaryKey, range: req.range } });
      return r.result;
    }
  }
}

/**
 * Middleware do Dexie: toda gravação local em uma tabela sincronizada
 * registra "tabela:id" na fila _outbox, na mesma transação.
 */
export function installOutbox(db: Dexie) {
  db.use({
    stack: 'dbcore',
    name: 'nina-outbox',
    create(down: DBCore): DBCore {
      return {
        ...down,
        transaction(stores, mode, opts) {
          const s = mode === 'readwrite' && stores.some((x) => TRACKED.has(x)) && !stores.includes(OUTBOX) ? [...stores, OUTBOX] : stores;
          return down.transaction(s, mode, opts);
        },
        table(name) {
          const table = down.table(name);
          if (!TRACKED.has(name)) return table;
          return {
            ...table,
            async mutate(req) {
              if ((req.trans as unknown as { __remote?: boolean }).__remote) return table.mutate(req);
              const keys = req.type === 'deleteRange' ? await affectedKeys(table, req) : null;
              const res = await table.mutate(req);
              const all = keys ?? (await affectedKeys(table, req));
              const ids = (req.type === 'add' || req.type === 'put') && !req.keys ? res.results ?? all : all;
              const values = (ids ?? []).filter((k) => k !== undefined && k !== null).map((k) => ({ k: `${name}:${String(k)}`, tbl: name, id: String(k), t: stamp() }));
              if (values.length) await down.table(OUTBOX).mutate({ type: 'put', trans: req.trans, values });
              return res;
            },
          };
        },
      };
    },
  });
}
