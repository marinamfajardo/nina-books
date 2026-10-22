import { useEffect, useState } from 'react';
import { ErrorBox, useToast } from '../components/ui';
import { disablePush, enablePush, getPushPrefs, isInstalled, isIOS, testNotification, updatePushPrefs, type PushPrefs } from '../services/push';
import { useSyncState } from '../sync/useSync';

export default function NotificationSettings() {
  const toast = useToast();
  const sync = useSyncState();
  const [on, setOn] = useState(false);
  const [prefs, setPrefs] = useState<PushPrefs>({ manha: true, noite: true });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void getPushPrefs().then((p) => { if (p) { setOn(p.on); setPrefs({ manha: p.manha, noite: p.noite }); } }); }, []);

  const change = async (p: PushPrefs) => {
    setPrefs(p);
    if (on) await updatePushPrefs(p);
  };

  return (
    <div className="card stack">
      <h3>🔔 Notificações diárias</h3>
      <label className="row nowrap" style={{ alignItems: 'flex-start' }}>
        <input type="checkbox" checked={prefs.manha} onChange={(e) => change({ ...prefs, manha: e.target.checked })} style={{ marginTop: 4 }} />
        <span><b>☀️ 9h — Bom dia com um livro</b><br /><span className="small muted">Uma das suas citações ou uma palavra do glossário, com o nome do livro.</span></span>
      </label>
      <label className="row nowrap" style={{ alignItems: 'flex-start' }}>
        <input type="checkbox" checked={prefs.noite} onChange={(e) => change({ ...prefs, noite: e.target.checked })} style={{ marginTop: 4 }} />
        <span><b>🌙 21h — “Saia do celular e vá ler”</b><br /><span className="small muted">Com um estudo sobre os benefícios da leitura (ex.: ficção e empatia).</span></span>
      </label>
      <ErrorBox error={err} />
      {isIOS() && !isInstalled() && (
        <p className="small alert info">📲 No iPhone/iPad, as notificações só funcionam com o app instalado na tela de início (Safari › Compartilhar ⬆️ › “Adicionar à Tela de Início”) e aberto pelo ícone.</p>
      )}
      {sync.kind === 'off' && <p className="small muted">⚠️ Para as notificações chegarem, conecte a sincronização (logo acima) — é por ela que o aviso sabe para qual aparelho ir.</p>}
      {!on ? (
        <button disabled={busy} onClick={async () => {
          setErr(null); setBusy(true);
          try { await enablePush(prefs); setOn(true); toast('Notificações ativadas 🔔'); await testNotification(); }
          catch (e) { setErr((e as Error).message); }
          finally { setBusy(false); }
        }}>🔔 Ativar notificações neste aparelho</button>
      ) : (
        <div className="row">
          <button className="secondary grow" onClick={() => testNotification().catch((e) => setErr((e as Error).message))}>Testar agora</button>
          <button className="danger" onClick={async () => { await disablePush(); setOn(false); toast('Notificações desativadas'); }}>Desativar</button>
        </div>
      )}
      <p className="small muted">Ative em cada aparelho em que quiser receber (celular e/ou iPad). Os horários podem atrasar alguns minutos.</p>
    </div>
  );
}
