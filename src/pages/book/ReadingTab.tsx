import { useEffect, useState } from 'react';
import { fmtDate, Modal, useToast } from '../../components/ui';
import { db, type Book, type Reading, type Session } from '../../db';
import { addSession } from '../../data/actions';
import { currentPage, formatDuration, formatNumber, sessionPages, sessionWords, today } from '../../domain/stats';

// ---------- Cronômetro (continua contando mesmo se você sair da tela) ----------
const TIMER_KEY = 'nina.timer';
interface TimerState { bookId: string; startedAt: number | null; accumulated: number }
const loadTimer = (): TimerState | null => {
  try { return JSON.parse(localStorage.getItem(TIMER_KEY) ?? 'null'); } catch { return null; }
};
const saveTimer = (t: TimerState | null) => (t ? localStorage.setItem(TIMER_KEY, JSON.stringify(t)) : localStorage.removeItem(TIMER_KEY));
const elapsed = (t: TimerState | null) => (t ? t.accumulated + (t.startedAt ? (Date.now() - t.startedAt) / 1000 : 0) : 0);

function Timer({ bookId, onFinish }: { bookId: string; onFinish: (sec: number) => void }) {
  const [t, setT] = useState<TimerState | null>(() => {
    const x = loadTimer();
    return x?.bookId === bookId ? x : null;
  });
  const [, tick] = useState(0);
  useEffect(() => {
    if (!t?.startedAt) return;
    const i = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [t?.startedAt]);
  const update = (x: TimerState | null) => { setT(x); saveTimer(x); };
  const other = loadTimer();
  const sec = elapsed(t);
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = Math.floor(sec % 60);
  const p = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="card">
      <h3>Cronômetro</h3>
      {other && other.bookId !== bookId && !t && <p className="small muted">Há um cronômetro aberto em outro livro.</p>}
      <div className="timer">{p(hh)}:{p(mm)}:{p(ss)}</div>
      <div className="row" style={{ justifyContent: 'center' }}>
        {!t && <button onClick={() => update({ bookId, startedAt: Date.now(), accumulated: 0 })}>▶ Começar a ler</button>}
        {t?.startedAt && <button className="secondary" onClick={() => update({ ...t, startedAt: null, accumulated: elapsed(t) })}>⏸ Pausar</button>}
        {t && !t.startedAt && <button className="secondary" onClick={() => update({ ...t, startedAt: Date.now() })}>▶ Continuar</button>}
        {t && <button onClick={() => { const s = Math.round(elapsed(t)); update(null); onFinish(s); }}>⏹ Terminar sessão</button>}
        {t && <button className="ghost" onClick={() => confirm('Descartar o cronômetro?') && update(null)}>Descartar</button>}
      </div>
    </div>
  );
}

function SessionForm({ book, fromPage, durationSec, onClose }: { book: Book; fromPage: number; durationSec?: number; onClose: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [start, setStart] = useState(String(fromPage));
  const [end, setEnd] = useState('');
  const [minutes, setMinutes] = useState(durationSec ? String(Math.max(1, Math.round(durationSec / 60))) : '');
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    const s = Number(start), e = Number(end);
    if (!end || isNaN(e)) return setErr('Informe a página em que você parou.');
    if (e < s) return setErr('A página final precisa ser maior que a inicial.');
    if (book.pageCount && e > book.pageCount) return setErr(`O livro tem ${book.pageCount} páginas.`);
    await addSession(book.id, { date, startPage: s, endPage: e, durationSec: minutes ? Number(minutes) * 60 : durationSec });
    toast(`+${e - s} páginas registradas`);
    onClose();
    if (book.pageCount && e >= book.pageCount && book.status !== 'lido') {
      setTimeout(() => toast('Chegou ao fim! Marque como “Lido” 🎉'), 2900);
    }
  };

  return (
    <Modal title="Registrar leitura" onClose={onClose}>
      <div className="stack">
        {err && <div className="alert">{err}</div>}
        <label className="field"><span>Data</span><input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="grid2">
          <label className="field"><span>Da página</span><input inputMode="numeric" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="field"><span>Até a página</span><input inputMode="numeric" autoFocus value={end} onChange={(e) => setEnd(e.target.value)} placeholder={book.pageCount ? `de ${book.pageCount}` : ''} /></label>
        </div>
        <label className="field"><span>Duração (minutos, opcional)</span><input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
        <button className="block" onClick={save}>Salvar sessão</button>
      </div>
    </Modal>
  );
}

export function ReadingTab({ book, sessions, readings }: { book: Book; sessions: Session[]; readings: Reading[] }) {
  const [form, setForm] = useState<{ duration?: number } | null>(null);
  const rs = [...readings].sort((a, b) => b.number - a.number);
  const open = rs.find((r) => r.outcome === 'andamento');
  const fromPage = open ? currentPage(sessions, open.id) : 0;
  const totalPages = sessions.reduce((s, x) => s + sessionPages(x), 0);
  const totalWords = sessions.reduce((s, x) => s + sessionWords(x, book), 0);
  const totalSec = sessions.reduce((s, x) => s + (x.durationSec ?? 0), 0);

  return (
    <div>
      <Timer bookId={book.id} onFinish={(duration) => setForm({ duration })} />
      <button className="block" onClick={() => setForm({})}>+ Registrar páginas lidas</button>

      <div className="kpis mt">
        <div className="kpi"><div className="v">{formatNumber(totalPages)}</div><div className="l">páginas lidas (todas as leituras)</div></div>
        <div className="kpi"><div className="v">{formatNumber(totalWords)}</div><div className="l">palavras (estimativa)</div></div>
        <div className="kpi"><div className="v">{totalSec ? formatDuration(totalSec) : '—'}</div><div className="l">tempo cronometrado</div></div>
        <div className="kpi"><div className="v">{readings.filter((r) => r.outcome === 'concluida').length}</div><div className="l">vezes lido</div></div>
      </div>

      {rs.length === 0 && <div className="empty">Nenhuma leitura registrada ainda. Mude o status para “Lendo” ou registre páginas.</div>}
      {rs.map((r) => {
        const ss = sessions.filter((s) => s.readingId === r.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
        return (
          <div className="card" key={r.id}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>{r.number === 1 ? 'Primeira leitura' : `${r.number}ª leitura (releitura)`}</h3>
              <span className="badge">{r.outcome === 'andamento' ? 'Em andamento' : r.outcome === 'concluida' ? 'Concluída' : 'Abandonada'}</span>
            </div>
            <p className="small muted">{fmtDate(r.startedAt)}{r.finishedAt ? ` → ${fmtDate(r.finishedAt)}` : ' → hoje'}</p>
            {ss.map((s) => (
              <div key={s.id} className="row between small" style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                <span>{fmtDate(s.date)}</span>
                <span>p. {s.startPage} → {s.endPage} <b>(+{sessionPages(s)})</b>{s.auto ? ' · ao concluir' : ''}</span>
                <span className="muted">{s.durationSec ? formatDuration(s.durationSec) : ''}</span>
                <button className="icon small" aria-label="Apagar sessão" onClick={() => confirm('Apagar esta sessão?') && db.sessions.delete(s.id)}>✕</button>
              </div>
            ))}
            {r.outcome !== 'andamento' && (
              <details className="small mt">
                <summary style={{ cursor: 'pointer' }}>Corrigir datas</summary>
                <div className="grid2 mt">
                  <label className="field"><span>Início</span><input type="date" value={r.startedAt} onChange={(e) => e.target.value && db.readings.update(r.id, { startedAt: e.target.value })} /></label>
                  <label className="field"><span>Fim</span><input type="date" value={r.finishedAt ?? ''} onChange={(e) => e.target.value && db.readings.update(r.id, { finishedAt: e.target.value })} /></label>
                </div>
                <button className="danger small mt" onClick={async () => {
                  if (!confirm('Apagar esta leitura e suas sessões?')) return;
                  await db.sessions.where('readingId').equals(r.id).delete();
                  await db.readings.delete(r.id);
                }}>Apagar esta leitura</button>
              </details>
            )}
          </div>
        );
      })}

      {form && <SessionForm book={book} fromPage={fromPage} durationSec={form.duration} onClose={() => setForm(null)} />}
    </div>
  );
}
