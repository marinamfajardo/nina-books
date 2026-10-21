import { useEffect, useState } from 'react';
import { ErrorBox, fmtDateTime, useToast } from '../components/ui';
import { resetSyncCursor } from '../sync/engine';
import { currentUser, getConfig, isConfigured, setConfig, signIn, signOut, signUp } from '../sync/supabase';
import { forgetJoined, runSync, skippedMedia, useSyncState } from '../sync/useSync';

export function SyncStatusBadge() {
  const s = useSyncState();
  if (s.kind === 'off') return null;
  const label = s.kind === 'syncing' ? '⏳' : s.kind === 'ok' ? (s.pending ? '☁️…' : '☁️') : '⚠️';
  const title = s.kind === 'error' ? s.message : s.kind === 'ok' ? 'Sincronizado' : 'Sincronizando…';
  return <span title={title} aria-label={title} style={{ fontSize: '1.1rem' }}>{label}</span>;
}

export default function SyncSettings() {
  const toast = useToast();
  const state = useSyncState();
  const [user, setUser] = useState<{ email?: string } | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState(getConfig());
  const [showCfg, setShowCfg] = useState(!isConfigured());

  useEffect(() => { void currentUser().then(setUser); }, [state.kind]);

  const act = async (fn: () => Promise<void>) => {
    setErr(null);
    setBusy(true);
    try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="card stack">
      <h3>☁️ Mesma estante no celular e no iPad</h3>
      <p className="small">
        Entre com a mesma conta nos dois aparelhos: livros, anotações, fotos, áudios e vídeos ficam iguais nos dois,
        e continuam funcionando sem internet (sincronizam quando a conexão volta).
      </p>
      <ErrorBox error={err} />

      {showCfg && (
        <div className="stack">
          <p className="small muted">Dados do projeto no Supabase (Project Settings › API):</p>
          <label className="field"><span>Project URL</span><input placeholder="https://xxxx.supabase.co" value={cfg.url} onChange={(e) => setCfg({ ...cfg, url: e.target.value })} autoCapitalize="off" spellCheck={false} /></label>
          <label className="field"><span>Chave pública (anon / publishable)</span><input value={cfg.key} onChange={(e) => setCfg({ ...cfg, key: e.target.value })} autoCapitalize="off" spellCheck={false} /></label>
          <button className="secondary" onClick={() => { setConfig(cfg.url, cfg.key); setShowCfg(false); toast('Projeto salvo'); }}>Salvar projeto</button>
        </div>
      )}

      {isConfigured() && !showCfg && user === null && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); void act(async () => { await signIn(email, password); toast('Conectada! Sincronizando… ☁️'); await runSync(); setUser(await currentUser()); }); }}>
          <label className="field"><span>E-mail</span><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="field"><span>Senha</span><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <div className="row">
            <button type="submit" className="grow" disabled={busy || !email || !password}>Entrar</button>
            <button type="button" className="secondary grow" disabled={busy || !email || password.length < 6} onClick={() => act(async () => {
              const r = await signUp(email, password);
              if (r.needsConfirmation) toast('Conta criada! Confirme pelo e-mail e depois toque em Entrar.');
              else { toast('Conta criada e conectada ☁️'); await runSync(); setUser(await currentUser()); }
            })}>Criar conta</button>
          </div>
          <p className="small muted">Use “Criar conta” só na primeira vez. No outro aparelho, use “Entrar” com o mesmo e-mail e senha.</p>
        </form>
      )}

      {user && (
        <div className="stack">
          <p className="small">Conectada como <b>{user.email}</b></p>
          <p className="small">
            {state.kind === 'syncing' && '⏳ Sincronizando…'}
            {state.kind === 'ok' && `✅ Sincronizado ${fmtDateTime(state.at)}${state.pending ? ` · ${state.pending} mudança(s) na fila` : ''}`}
            {state.kind === 'error' && `⚠️ ${state.message}`}
          </p>
          {skippedMedia().length > 0 && <p className="small muted">Ficaram só neste aparelho (maiores que 50 MB): {skippedMedia().join(', ')}</p>}
          <div className="row">
            <button className="grow" disabled={state.kind === 'syncing'} onClick={() => void runSync()}>↻ Sincronizar agora</button>
            <button className="secondary" onClick={() => act(async () => {
              if (!confirm('Desconectar este aparelho? Os dados continuam aqui, mas param de sincronizar.')) return;
              await signOut();
              forgetJoined();
              resetSyncCursor();
              setUser(null);
              await runSync();
            })}>Sair</button>
          </div>
        </div>
      )}

      {isConfigured() && !showCfg && (
        <button className="ghost small" onClick={() => setShowCfg(true)}>Alterar projeto do Supabase</button>
      )}
    </div>
  );
}
