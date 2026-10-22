import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Book, Session } from '../db';
import { formatDuration, pagesByDay, sessionPages, toDateKey, today } from '../domain/stats';
import { fmtDate, Modal } from './ui';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Tom de rosa conforme as páginas do dia (0 = sem leitura). */
const level = (pages: number, max: number) => (pages <= 0 ? 0 : Math.min(4, Math.ceil((pages / Math.max(max, 1)) * 4)));

/** Calendário do ano: cada dia pintado pela quantidade de páginas lidas. */
export function ReadingCalendar({ year, sessions, books }: { year: number; sessions: Session[]; books: Map<string, Book> }) {
  const [day, setDay] = useState<string | null>(null);
  const days = useMemo(() => pagesByDay(sessions.filter((s) => s.date.startsWith(String(year)))), [sessions, year]);
  const max = Math.max(0, ...days.values());
  const readDays = [...days.values()].filter((p) => p > 0).length;
  const now = today();

  return (
    <div className="card">
      <div className="row between">
        <h3 style={{ margin: 0 }}>🗓️ Calendário de leitura {year}</h3>
        <span className="small muted">{readDays} dia(s) com leitura</span>
      </div>
      <div className="cal-months">
        {MONTHS.map((m, mi) => {
          const first = new Date(year, mi, 1);
          const count = new Date(year, mi + 1, 0).getDate();
          return (
            <div key={m} className="cal-month">
              <div className="small" style={{ fontWeight: 700, marginBottom: 2 }}>{m}</div>
              <div className="cal-grid">
                {WEEK.map((w, i) => <span key={`w${i}`} className="cal-w">{w}</span>)}
                {Array.from({ length: first.getDay() }, (_, i) => <span key={`e${i}`} />)}
                {Array.from({ length: count }, (_, i) => {
                  const key = toDateKey(new Date(year, mi, i + 1));
                  const p = days.get(key) ?? 0;
                  return (
                    <button
                      key={key}
                      className={`cal-d l${level(p, max)}${key === now ? ' today' : ''}`}
                      title={`${fmtDate(key)}: ${p} página(s)`}
                      aria-label={`${fmtDate(key)}: ${p} páginas`}
                      onClick={() => p > 0 && setDay(key)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="row small muted" style={{ gap: 4, justifyContent: 'flex-end', marginTop: 8 }}>
        menos {[0, 1, 2, 3, 4].map((l) => <span key={l} className={`cal-d l${l}`} style={{ display: 'inline-block' }} />)} mais
      </div>
      {day && (
        <Modal title={fmtDate(day)} onClose={() => setDay(null)}>
          {sessions.filter((s) => s.date === day).map((s) => {
            const b = books.get(s.bookId);
            return (
              <Link key={s.id} to={`/livro/${s.bookId}?aba=leitura`} className="list-item">
                <div className="grow"><b>{b?.title ?? 'Livro'}</b><div className="small muted">p. {s.startPage} → {s.endPage}{s.durationSec ? ` · ${formatDuration(s.durationSec)}` : ''}</div></div>
                <b>+{sessionPages(s)}</b>
              </Link>
            );
          })}
        </Modal>
      )}
    </div>
  );
}
