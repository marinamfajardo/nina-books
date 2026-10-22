import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, Modal, PageTitle, Progress, useToast } from '../components/ui';
import { db } from '../db';
import { useLibrary } from '../data/hooks';
import { availableVouchers, BOOKS_PER_MEDAL, medals, type Medal, type RewardsState } from '../domain/achievements';
import { today } from '../domain/stats';
import { useSyncState } from '../sync/useSync';

const EMPTY: RewardsState = { celebrated: 0, redeemed: {} };

/** Estado dos vales-livro (sincronizado entre aparelhos). */
export function useRewards() {
  const row = useLiveQuery(() => db.prefs.get('rewards'), []);
  const state: RewardsState = row ? { celebrated: Number(row.celebrated ?? 0), redeemed: (row.redeemed as RewardsState['redeemed']) ?? {} } : EMPTY;
  const save = (s: RewardsState) => db.prefs.put({ id: 'rewards', ...s });
  return { state, save };
}

/** Usa um vale-livro (o mais antigo disponível). Retorna false se não houver. */
export async function redeemVoucher(title?: string) {
  const row = await db.prefs.get('rewards');
  const state: RewardsState = row ? { celebrated: Number(row.celebrated ?? 0), redeemed: (row.redeemed as RewardsState['redeemed']) ?? {} } : EMPTY;
  const { earned } = medals(await db.readings.toArray());
  const v = availableVouchers(earned, state)[0];
  if (!v) return false;
  await db.prefs.put({ id: 'rewards', ...state, redeemed: { ...state.redeemed, [v.milestone]: { at: today(), title } } });
  return true;
}

export const MEDAL_MESSAGE = 'Você conquistou o direito de comprar mais um livro! 🛍️';

/** Comemoração que aparece uma vez quando a leitora completa mais 5 livros. */
export function MedalCelebration() {
  const lib = useLibrary();
  const { state, save } = useRewards();
  const prefsLoaded = useLiveQuery(async () => (await db.prefs.get('rewards')) ?? null, []) !== undefined;
  const [medal, setMedal] = useState<Medal | null>(null);
  const m = medals(lib.readings);
  const top = m.earned[m.earned.length - 1];

  const sync = useSyncState();
  useEffect(() => {
    // espera a sincronização terminar, para não comemorar de novo uma medalha já vista no outro aparelho
    if (!lib.loaded || !prefsLoaded || !top || sync.kind === 'syncing') return;
    if (top.milestone <= state.celebrated) return;
    const t = setTimeout(() => {
      setMedal(top);
      void save({ ...state, celebrated: top.milestone });
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib.loaded, prefsLoaded, top?.milestone, state.celebrated, sync.kind]);

  if (!medal) return null;
  return (
    <Modal title="Nova conquista!" onClose={() => setMedal(null)}>
      <div className="celebration center stack">
        <div className="confetti" aria-hidden>{'🎉✨📚🌹✨🎉'}</div>
        <div className="medal-big">{medal.emoji}</div>
        <h2>{medal.name}</h2>
        <p><b>{medal.milestone} livros lidos!</b></p>
        <div className="voucher">🎟️ {MEDAL_MESSAGE}</div>
        <div className="row">
          <Link to="/desejos" className="btn grow" onClick={() => setMedal(null)}>🛍️ Ver lista de desejos</Link>
          <Link to="/conquistas" className="btn secondary grow" onClick={() => setMedal(null)}>Minhas conquistas</Link>
        </div>
      </div>
    </Modal>
  );
}

export default function Achievements() {
  const lib = useLibrary();
  const toast = useToast();
  const { state, save } = useRewards();
  const m = medals(lib.readings);
  const vouchers = availableVouchers(m.earned, state);

  return (
    <div>
      <PageTitle back>Conquistas</PageTitle>

      <div className="card center stack">
        <div className="medal-big" style={{ opacity: 0.35 }}>{m.next.emoji}</div>
        <h3 style={{ margin: 0 }}>Próxima medalha: {m.next.name}</h3>
        <Progress pct={m.progressPct} />
        <p className="small" style={{ margin: 0 }}>
          {m.read} livro(s) lido(s) · faltam <b>{m.remaining}</b> para ganhar mais um vale-livro 🎟️
        </p>
        <p className="small muted" style={{ margin: 0 }}>A cada {BOOKS_PER_MEDAL} livros terminados você conquista o direito de comprar mais um livro.</p>
      </div>

      {vouchers.length > 0 && (
        <div className="card voucher-card">
          <h3>🎟️ Você tem {vouchers.length} vale-livro{vouchers.length > 1 ? 's' : ''}!</h3>
          <p className="small">{MEDAL_MESSAGE}</p>
          <div className="row">
            <Link to="/desejos" className="btn grow">🛍️ Escolher na lista de desejos</Link>
            <button className="secondary" onClick={async () => {
              const title = prompt('Qual livro você comprou? (opcional)') ?? undefined;
              await save({ ...state, redeemed: { ...state.redeemed, [vouchers[0].milestone]: { at: today(), title: title || undefined } } });
              toast('Aproveite o livro novo! 📚');
            }}>Já comprei</button>
          </div>
        </div>
      )}

      {!m.earned.length && <div className="empty"><div className="big">🏅</div>Termine {BOOKS_PER_MEDAL} livros para ganhar sua primeira medalha.</div>}
      <div className="medal-grid">
        {[...m.earned].reverse().map((md) => {
          const used = state.redeemed[String(md.milestone)];
          return (
            <div key={md.milestone} className="card center">
              <div className="medal-big">{md.emoji}</div>
              <b>{md.name}</b>
              <div className="small">{md.milestone} livros · {fmtDate(md.earnedAt)}</div>
              <div className="small mt" style={{ marginTop: 6 }}>
                {used ? <span className="muted">🎟️ usado{used.title ? `: ${used.title}` : ''} ({fmtDate(used.at)})</span> : <span style={{ color: 'var(--accent)', fontWeight: 700 }}>🎟️ vale-livro disponível</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
