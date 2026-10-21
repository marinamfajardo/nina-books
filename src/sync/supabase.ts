import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RemoteRecord, SyncBackend } from './engine';

/**
 * Endereço e chave pública do projeto Supabase da Nina.
 * A chave "anon" é pública por natureza: quem protege os dados são as regras
 * de segurança (RLS) do banco, que só deixam a dona da conta ler e gravar.
 * Também podem ser informados em Ajustes › Sincronização.
 */
export const DEFAULT_SUPABASE_URL = 'https://dghztcgapzaidjnkfopl.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_hKsa9b7SFsZbN3pC1k_8nQ_TwHFYX12';

const URL_KEY = 'nina.supabase.url';
const ANON_KEY = 'nina.supabase.key';
const BUCKET = 'media';

export const getConfig = () => ({
  url: (localStorage.getItem(URL_KEY) || DEFAULT_SUPABASE_URL).trim(),
  key: (localStorage.getItem(ANON_KEY) || DEFAULT_SUPABASE_KEY).trim(),
});
export function setConfig(url: string, key: string) {
  localStorage.setItem(URL_KEY, url.trim());
  localStorage.setItem(ANON_KEY, key.trim());
  client = null;
}
export const isConfigured = () => {
  const c = getConfig();
  return /^https:\/\/.+/.test(c.url) && c.key.length > 20;
};

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!isConfigured()) return null;
  if (!client) {
    const c = getConfig();
    client = createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nina.auth' } });
  }
  return client;
}

export class SyncError extends Error {}

const friendly = (e: { message?: string; status?: number } | null, fallback: string): never => {
  const m = e?.message ?? '';
  if (/Invalid login credentials/i.test(m)) throw new SyncError('E-mail ou senha incorretos.');
  if (/Email not confirmed/i.test(m)) throw new SyncError('Confirme seu e-mail: abra a mensagem que o Supabase enviou e clique no link. Depois entre de novo.');
  if (/already registered|already been registered/i.test(m)) throw new SyncError('Esse e-mail já tem conta. Use “Entrar”.');
  if (/Password should be/i.test(m)) throw new SyncError('A senha precisa ter pelo menos 6 caracteres.');
  if (/Signups not allowed/i.test(m)) throw new SyncError('Novos cadastros estão desativados neste projeto. Use “Entrar” com sua conta.');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) throw new SyncError('Sem conexão com a nuvem. Verifique a internet.');
  if (/JWT|not authenticated|401/i.test(m) || e?.status === 401) throw new SyncError('Sua sessão expirou. Entre de novo em Ajustes › Sincronização.');
  if (/relation .*records.* does not exist|Could not find the table/i.test(m)) throw new SyncError('O banco na nuvem ainda não foi preparado. Rode o script SQL de instalação (veja o README).');
  if (/Payload too large|exceeded the maximum/i.test(m)) throw new SyncError('Arquivo grande demais para a nuvem (máx. 50 MB).');
  throw new SyncError(m ? `${fallback} (${m})` : fallback);
};

export async function currentUser() {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

export async function signIn(email: string, password: string) {
  const sb = supabase();
  if (!sb) throw new SyncError('Configure o endereço e a chave do Supabase primeiro.');
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) friendly(error, 'Não foi possível entrar.');
  return data.user;
}

export async function signUp(email: string, password: string) {
  const sb = supabase();
  if (!sb) throw new SyncError('Configure o endereço e a chave do Supabase primeiro.');
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: 'https://marinamfajardo.github.io/nina-books/' } });
  if (error) friendly(error, 'Não foi possível criar a conta.');
  return { user: data.user, needsConfirmation: !data.session };
}

export async function signOut() {
  await supabase()?.auth.signOut();
}

/** Implementação do backend de sincronização usando uma tabela única `records` + Storage. */
export function supabaseBackend(sb: SupabaseClient, userId: string): SyncBackend {
  const path = (id: string) => `${userId}/${id}`;
  return {
    async push(records) {
      const rows = records.map((r) => ({ ...r, user_id: userId }));
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await sb.from('records').upsert(rows.slice(i, i + 100), { onConflict: 'user_id,tbl,id' });
        if (error) friendly(error, 'Erro ao enviar para a nuvem.');
      }
    },
    async pull(since, limit) {
      let q = sb.from('records').select('tbl,id,data,deleted,modified_at').order('modified_at', { ascending: true }).order('id').limit(limit);
      if (since) q = q.gte('modified_at', since);
      const { data, error } = await q;
      if (error) friendly(error, 'Erro ao baixar da nuvem.');
      return (data ?? []) as RemoteRecord[];
    },
    async uploadMedia(id, blob) {
      const { error } = await sb.storage.from(BUCKET).upload(path(id), blob, { upsert: true, contentType: blob.type || 'application/octet-stream' });
      if (error) friendly(error, 'Erro ao enviar foto/áudio/vídeo.');
    },
    async downloadMedia(id) {
      const { data, error } = await sb.storage.from(BUCKET).download(path(id));
      if (error) return null;
      return data;
    },
    async deleteMedia(id) {
      await sb.storage.from(BUCKET).remove([path(id)]);
    },
  };
}
