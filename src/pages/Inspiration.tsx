import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DictateButton } from '../components/Dictation';
import { fmtDate, Modal, PageTitle, useToast } from '../components/ui';
import { db, nowIso, uid, type Quote } from '../db';
import { useLibrary } from '../data/hooks';
import { matches } from '../domain/filters';
import { CHALLENGES, FACTS, pillOfDay, QUESTIONS, type Pill } from '../domain/inspiration';

function PillBody({ pill }: { pill: Pill }) {
  if (pill.kind === 'curiosidade') {
    return (
      <>
        <div className="pill-kind">🧠 Você sabia?</div>
        <p style={{ margin: '4px 0' }}>{pill.fact.text}</p>
        {pill.fact.note && <p className="small muted" style={{ margin: '2px 0' }}>{pill.fact.note}</p>}
        <a className="small" href={pill.fact.url} target="_blank" rel="noreferrer">📄 {pill.fact.source}</a>
      </>
    );
  }
  if (pill.kind === 'desafio') return <><div className="pill-kind">🎯 Desafio do dia</div><p style={{ margin: '4px 0', fontWeight: 700 }}>{pill.text}</p></>;
  return <><div className="pill-kind">💭 Pergunta para pensar</div><p style={{ margin: '4px 0', fontFamily: 'var(--serif)', fontSize: '1.1rem' }}>{pill.text}</p></>;
}

/** Cartão diário na estante: curiosidade, desafio ou pergunta. */
export function PillCard() {
  const [offset, setOffset] = useState(0);
  const pill = pillOfDay(new Date(), offset);
  return (
    <div className="card pill-card">
      <PillBody pill={pill} />
      <div className="row between mt" style={{ marginTop: 8 }}>
        <Link to="/inspiracao" className="small">ver todas</Link>
        <button className="ghost small" onClick={() => setOffset((o) => o + 1)}>outra ›</button>
      </div>
    </div>
  );
}

/** Citação do dia (sorteada entre as suas, muda a cada dia). */
export function useQuoteOfDay() {
  const quotes = useLiveQuery(() => db.quotes.toArray(), []) ?? [];
  const lib = useLibrary();
  return useMemo(() => {
    if (!quotes.length) return null;
    const day = Math.floor(Date.now() / 86_400_000);
    const sorted = [...quotes].sort((a, b) => a.id.localeCompare(b.id));
    const q = sorted[(day * 7919) % sorted.length];
    return { quote: q, book: lib.bookMap.get(q.bookId) };
  }, [quotes, lib.bookMap]);
}

export function QuoteOfDayCard() {
  const qd = useQuoteOfDay();
  if (!qd) return null;
  return (
    <Link to={`/livro/${qd.quote.bookId}?aba=citacoes`} className="card quote-day" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      <div className="pill-kind">❝ Citação do dia</div>
      <div className="quote pre" style={{ marginTop: 6 }}>{qd.quote.text}</div>
      <div className="small muted" style={{ marginTop: 6 }}>— {qd.book?.title ?? 'livro'}{qd.book?.authors[0] ? `, ${qd.book.authors[0]}` : ''}{qd.quote.page ? ` · p. ${qd.quote.page}` : ''}</div>
    </Link>
  );
}

export default function Inspiration() {
  return (
    <div>
      <PageTitle back>Inspiração</PageTitle>
      <p className="small muted">Ler sobre os benefícios da leitura ajuda a lembrar por que ela vale a pena. 💗</p>
      <h2 className="mt">🧠 Curiosidades com ciência</h2>
      {FACTS.map((f) => <div key={f.url} className="card"><PillBody pill={{ kind: 'curiosidade', fact: f }} /></div>)}
      <h2 className="mt">🎯 Desafios</h2>
      <div className="card">{CHALLENGES.map((c) => <p key={c} style={{ margin: '6px 0' }}>• {c}</p>)}</div>
      <h2 className="mt">💭 Perguntas para pensar</h2>
      <div className="card">{QUESTIONS.map((c) => <p key={c} style={{ margin: '6px 0', fontFamily: 'var(--serif)' }}>• {c}</p>)}</div>
    </div>
  );
}

/** Todas as citações, de todos os livros, num lugar só. */
export function AllQuotes() {
  const lib = useLibrary();
  const toast = useToast();
  const quotes = useLiveQuery(() => db.quotes.toArray(), []) ?? [];
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<Quote> | null>(null);
  const [interim, setInterim] = useState('');
  const shown = quotes
    .filter((x) => !q || matches(x.text, q) || matches(x.comment, q) || matches(lib.bookMap.get(x.bookId)?.title, q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const books = [...lib.books].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  const lang = edit?.bookId ? lib.bookMap.get(edit.bookId)?.readingLanguage : undefined;

  return (
    <div>
      <PageTitle back right={<button onClick={() => setEdit({})} disabled={!books.length}>+ Citação</button>}>Minhas citações</PageTitle>
      <QuoteOfDayCard />
      <input type="search" placeholder="Buscar citação, comentário ou livro" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
      {!quotes.length && <div className="empty"><div className="big">❝</div>Anote aqui as frases que marcaram você. Todo dia uma delas volta como lembrete.</div>}
      {shown.map((x) => {
        const b = lib.bookMap.get(x.bookId);
        return (
          <div key={x.id} className="card">
            <div className="quote pre">{x.text}</div>
            {x.comment && <p className="small" style={{ marginTop: 6 }}>💬 {x.comment}</p>}
            <div className="row between small muted">
              <Link to={`/livro/${x.bookId}?aba=citacoes`}>📖 {b?.title ?? 'livro apagado'}{x.page ? ` · p. ${x.page}` : ''}</Link>
              <span>{fmtDate(x.createdAt)}</span>
            </div>
          </div>
        );
      })}
      {edit && (
        <Modal title="Nova citação" onClose={() => setEdit(null)}>
          <div className="stack">
            <label className="field"><span>Livro</span>
              <select value={edit.bookId ?? ''} onChange={(e) => setEdit({ ...edit, bookId: e.target.value })}>
                <option value="">Escolha o livro…</option>
                {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select>
            </label>
            <DictateButton language={lang} onInterim={setInterim} onText={(t) => setEdit((c) => c && { ...c, text: c.text?.trim() ? `${c.text.trim()} ${t}` : t })} />
            <label className="field"><span>Citação (escreva ou fale)</span><textarea value={edit.text ?? ''} onChange={(e) => setEdit({ ...edit, text: e.target.value })} /></label>
            {interim && <p className="small muted" style={{ margin: 0, fontStyle: 'italic' }}>…{interim}</p>}
            <div className="grid2">
              <label className="field"><span>Página</span><input inputMode="numeric" value={edit.page ?? ''} onChange={(e) => setEdit({ ...edit, page: Number(e.target.value.replace(/\D/g, '')) || undefined })} /></label>
              <label className="field"><span>Meu comentário</span><input value={edit.comment ?? ''} onChange={(e) => setEdit({ ...edit, comment: e.target.value })} /></label>
            </div>
            <button className="block" disabled={!edit.bookId || !edit.text?.trim()} onClick={async () => {
              await db.quotes.add({ id: uid(), bookId: edit.bookId!, text: edit.text!.trim(), page: edit.page, comment: edit.comment?.trim() || undefined, createdAt: nowIso() });
              setEdit(null);
              toast('Citação salva ❝');
            }}>Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
