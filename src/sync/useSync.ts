import { useEffect, useSyncExternalStore } from 'react';
import { enqueueAll, fetchMissingMedia, pendingCount, syncNow, type SyncBackend } from './engine';
import { applySyncedPrefs } from '../services/prefs';
import { currentUser, supabase, supabaseBackend, SyncError } from './supabase';

export type SyncState =
  | { kind: 'off' }
  | { kind: 'syncing' }
  | { kind: 'ok'; at: string; pending: number }
  | { kind: 'error'; message: string };

let state: SyncState = { kind: 'off' };
const listeners = new Set<() => void>();
const set = (s: SyncState) => {
  state = s;
  listeners.forEach((l) => l());
};
export const useSyncState = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => state);

const JOINED_KEY = 'nina.sync.joinedUser';
let lastSkipped: string[] = [];
export const skippedMedia = () => lastSkipped;

async function backend(): Promise<SyncBackend | null> {
  const sb = supabase();
  if (!sb) return null;
  const user = await currentUser();
  if (!user) return null;
  // primeira vez desta conta neste aparelho: envia tudo o que já existe aqui
  if (localStorage.getItem(JOINED_KEY) !== user.id) {
    await enqueueAll();
    localStorage.setItem(JOINED_KEY, user.id);
  }
  return supabaseBackend(sb, user.id);
}

/** Sincroniza agora (se estiver conectada). */
export async function runSync() {
  const b = await backend().catch(() => null);
  if (!b) {
    set({ kind: 'off' });
    return;
  }
  if (!navigator.onLine) {
    set({ kind: 'error', message: 'Sem internet — as mudanças ficam guardadas e vão quando a conexão voltar.' });
    return;
  }
  set({ kind: 'syncing' });
  try {
    const r = await syncNow(b);
    lastSkipped = r.skippedMedia;
    await applySyncedPrefs();
    set({ kind: 'ok', at: new Date().toISOString(), pending: await pendingCount() });
  } catch (e) {
    set({ kind: 'error', message: e instanceof SyncError ? e.message : `Erro ao sincronizar: ${(e as Error).message}` });
  }
}

/** Baixa um arquivo (foto, áudio, vídeo) que foi gravado no outro aparelho. */
export async function downloadMedia(id: string) {
  const b = await backend().catch(() => null);
  if (!b) return null;
  return fetchMissingMedia(b, id).catch(() => null);
}

/** Sincroniza ao abrir, ao voltar para o app, a cada 30 s e logo depois de mudanças. */
export function useAutoSync() {
  useEffect(() => {
    void runSync();
    const onVisible = () => document.visibilityState === 'visible' && void runSync();
    const onOnline = () => void runSync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    const timer = setInterval(async () => {
      // mudou algo: envia logo (depois de erro, espera a tentativa de 30 s)
      if (state.kind === 'ok' && (await pendingCount()) > 0) void runSync();
    }, 4000);
    const slow = setInterval(() => void runSync(), 30000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      clearInterval(timer);
      clearInterval(slow);
    };
  }, []);
}

export const forgetJoined = () => localStorage.removeItem(JOINED_KEY);
