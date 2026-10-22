/// <reference lib="webworker" />
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { FACTS, REMINDERS } from './domain/inspiration';

declare const self: ServiceWorkerGlobalScope;

// ---------- Funcionar offline ----------
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

const yearCache = (name: string, entries: number) =>
  new CacheFirst({ cacheName: name, plugins: [new ExpirationPlugin({ maxEntries: entries, maxAgeSeconds: 31536000 }), new CacheableResponsePlugin({ statuses: [0, 200] })] });
registerRoute(({ url }) => /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname), yearCache('fontes', 20));
registerRoute(({ url }) => url.hostname === 'cdn.jsdelivr.net' && /tesseract/.test(url.pathname), yearCache('ocr', 20));
registerRoute(({ url }) => ['books.google.com', 'covers.openlibrary.org'].includes(url.hostname), yearCache('capas', 500));

// ---------- Notificações diárias ----------

/** Lê uma tabela do banco do app (IndexedDB) direto no service worker. */
function readAll<T>(store: string): Promise<T[]> {
  return new Promise((resolve) => {
    const open = indexedDB.open('nina-books');
    open.onerror = () => resolve([]);
    open.onsuccess = () => {
      const dbh = open.result;
      if (!dbh.objectStoreNames.contains(store)) return resolve([]);
      const req = dbh.transaction(store, 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => resolve([]);
    };
  });
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const BASE = self.registration.scope; // https://…/nina-books/

/** Manhã: uma citação ou uma palavra do glossário, com o livro de origem. */
async function morningNotification() {
  const [quotes, words, books] = await Promise.all([
    readAll<{ id: string; bookId: string; text: string; page?: number }>('quotes'),
    readAll<{ id: string; word: string; meaning?: string; language?: string; bookId?: string }>('glossary'),
    readAll<{ id: string; title: string; authors?: string[] }>('books'),
  ]);
  const title = (id?: string) => books.find((x) => x.id === id)?.title;
  const options = [
    ...quotes.map((q) => ({ kind: 'q' as const, q })),
    ...words.filter((w) => w.meaning).map((w) => ({ kind: 'w' as const, w })),
  ];
  if (!options.length) {
    const f = pick(FACTS);
    return { title: '☀️ Bom dia, leitora!', body: f.short, url: `${BASE}#/inspiracao` };
  }
  const o = pick(options);
  if (o.kind === 'q') {
    const text = o.q.text.length > 220 ? `${o.q.text.slice(0, 217)}…` : o.q.text;
    return { title: `☀️ ❝ ${title(o.q.bookId) ?? 'Citação do dia'}`, body: `“${text}”`, url: `${BASE}#/livro/${o.q.bookId}?aba=citacoes` };
  }
  const book = title(o.w.bookId);
  return {
    title: `☀️ Palavra do dia: ${o.w.word}`,
    body: `${o.w.meaning}${book ? ` — 📖 ${book}` : ''}`,
    url: o.w.bookId ? `${BASE}#/livro/${o.w.bookId}?aba=glossario` : `${BASE}#/glossario`,
  };
}

/** Noite: lembrete para largar o celular + um estudo sobre os benefícios da leitura. */
function nightNotification() {
  const f = pick(FACTS);
  return { title: pick(REMINDERS), body: `${f.short} (${f.source.match(/^[^)]*\)/)?.[0] ?? f.source})`, url: `${BASE}#/inspiracao` };
}

self.addEventListener('push', (event) => {
  let type = 'noite';
  try {
    type = event.data?.json()?.type ?? 'noite';
  } catch { /* sem conteúdo: lembrete da noite */ }
  event.waitUntil((async () => {
    const n = type === 'manha' || type === 'citacao' ? await morningNotification() : nightNotification();
    await self.registration.showNotification(n.title, {
      body: n.body,
      icon: `${BASE}icon-192.png`,
      badge: `${BASE}icon-192.png`,
      tag: type,
      data: { url: n.url },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? BASE;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins[0] as WindowClient | undefined;
    if (w) {
      await w.navigate(url).catch(() => {});
      return w.focus();
    }
    return self.clients.openWindow(url);
  })());
});
