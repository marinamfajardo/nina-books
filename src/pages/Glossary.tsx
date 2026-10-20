import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorBox, Modal, PageTitle, useToast } from '../components/ui';
import { db, nowIso, uid, type Book, type GlossaryEntry } from '../db';
import { ensureListItems } from '../data/actions';
import { useLibrary, useList } from '../data/hooks';
import { matches } from '../domain/filters';
import { isDue, review } from '../domain/flashcards';
import { today } from '../domain/stats';
import { defineWord, hasApiKey } from '../services/claude';

function EntryForm({ initial, onClose, fixedBook }: { initial: Partial<GlossaryEntry>; onClose: () => void; fixedBook?: Book }) {
  const lib = useLibrary();
  const languages = useList('language');
  const toast = useToast();
  const [e, setE] = useState<Partial<GlossaryEntry>>({ language: fixedBook?.readingLanguage, bookId: fixedBook?.id, ...initial });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<GlossaryEntry>) => setE((x) => ({ ...x, ...p }));

  const ai = async () => {
    if (!e.word?.trim()) return;
    setErr(null);
    setBusy(true);
    try {
      const meaning = await defineWord(e.word.trim(), e.language, e.example, e.bookId ? lib.bookMap.get(e.bookId)?.title : undefined);
      set({ meaning, meaningByAI: true });
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!e.word?.trim()) return;
    if (e.language) await ensureListItems('language', [e.language]);
    const data = {
      word: e.word.trim(), language: e.language || undefined, meaning: e.meaning?.trim() || undefined, meaningByAI: e.meaningByAI,
      example: e.example?.trim() || undefined, page: e.page, bookId: e.bookId || undefined,
    };
    if (e.id) await db.glossary.update(e.id, data);
    else await db.glossary.add({ id: uid(), ...data, box: 1, nextReview: today(), createdAt: nowIso() });
    toast('Palavra salva');
    onClose();
  };

  return (
    <Modal title={e.id ? 'Editar palavra' : 'Nova palavra'} onClose={onClose}>
      <div className="stack">
        <ErrorBox error={err} />
        <label className="field"><span>Palavra ou expressão *</span><input autoFocus value={e.word ?? ''} onChange={(x) => set({ word: x.target.value })} /></label>
        <label className="field"><span>Idioma</span>
          <input list="gl-langs" value={e.language ?? ''} onChange={(x) => set({ language: x.target.value })} />
          <datalist id="gl-langs">{languages.map((l) => <option key={l} value={l} />)}</datalist>
        </label>
        <label className="field"><span>Frase do livro / exemplo</span><textarea style={{ minHeight: 70 }} value={e.example ?? ''} onChange={(x) => set({ example: x.target.value })} /></label>
        <label className="field">
          <span className="row between">Significado {e.meaningByAI && <span className="badge ai">✨ IA (editável)</span>}</span>
          <textarea value={e.meaning ?? ''} onChange={(x) => set({ meaning: x.target.value, meaningByAI: e.meaningByAI && !!x.target.value })} />
        </label>
        {hasApiKey() && <button className="secondary" onClick={ai} disabled={busy || !e.word?.trim()}>{busy ? '⏳ Buscando…' : '✨ Buscar significado com IA'}</button>}
        <div className="grid2">
          <label className="field"><span>Livro</span>
            <select value={e.bookId ?? ''} onChange={(x) => set({ bookId: x.target.value || undefined })} disabled={!!fixedBook}>
              <option value="">—</option>
              {lib.books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </label>
          <label className="field"><span>Página</span><input inputMode="numeric" value={e.page ?? ''} onChange={(x) => set({ page: Number(x.target.value.replace(/\D/g, '')) || undefined })} /></label>
        </div>
        <div className="row">
          {e.id && <button className="danger" onClick={async () => { if (confirm('Apagar palavra?')) { await db.glossary.delete(e.id!); onClose(); } }}>Apagar</button>}
          <button className="grow" onClick={save} disabled={!e.word?.trim()}>Salvar</button>
        </div>
      </div>
    </Modal>
  );
}

function EntryList({ entries, books, onEdit }: { entries: GlossaryEntry[]; books: Map<string, Book>; onEdit: (e: GlossaryEntry) => void }) {
  if (!entries.length) return <div className="empty"><div className="big">🔤</div>Nenhuma palavra aqui ainda.</div>;
  return (
    <div>
      {entries.map((e) => (
        <button key={e.id} className="card" onClick={() => onEdit(e)}
          style={{ display: 'block', width: '100%', textAlign: 'left', color: 'inherit', fontWeight: 400, borderRadius: 'var(--radius)' }}>
          <div className="row between">
            <b style={{ fontFamily: 'var(--serif)', fontSize: '1.15rem' }}>{e.word}</b>
            <span className="row" style={{ gap: 4 }}>{e.meaningByAI && <span className="badge ai">✨ IA</span>}{e.language && <span className="badge">{e.language}</span>}</span>
          </div>
          {e.meaning && <p className="small pre" style={{ margin: '4px 0' }}>{e.meaning}</p>}
          {e.example && <p className="small muted" style={{ fontStyle: 'italic', margin: 0 }}>“{e.example}”</p>}
          {e.bookId && <p className="small muted" style={{ margin: 0 }}>📖 {books.get(e.bookId)?.title}{e.page ? `, p. ${e.page}` : ''}</p>}
        </button>
      ))}
    </div>
  );
}

function Flashcards({ entries, onClose }: { entries: GlossaryEntry[]; onClose: () => void }) {
  const [onlyDue, setOnlyDue] = useState(true);
  const deck = useMemo(() => {
    const d = entries.filter((e) => !onlyDue || isDue(e.nextReview));
    return d.sort(() => Math.random() - 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyDue]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [score, setScore] = useState({ ok: 0, no: 0 });
  const card = deck[i];

  const answer = async (correct: boolean) => {
    if (!card) return;
    await db.glossary.update(card.id, review(card.box, correct));
    setScore((s) => (correct ? { ...s, ok: s.ok + 1 } : { ...s, no: s.no + 1 }));
    setFlipped(false);
    setI((x) => x + 1);
  };

  return (
    <Modal title="Revisão" onClose={onClose}>
      <div className="stack">
        <label className="row small"><input type="checkbox" checked={onlyDue} onChange={(e) => { setOnlyDue(e.target.checked); setI(0); }} /> Só as palavras do dia</label>
        {!card ? (
          <div className="empty">
            <div className="big">🌷</div>
            {deck.length ? <>Fim da revisão! ✔ {score.ok} · ✘ {score.no}</> : 'Nenhuma palavra para revisar hoje.'}
            <div className="mt"><button onClick={onClose}>Fechar</button></div>
          </div>
        ) : (
          <>
            <div className="small muted center">{i + 1} de {deck.length}</div>
            <div className={`flashcard${flipped ? ' back' : ''}`} onClick={() => setFlipped(!flipped)}>
              {!flipped ? (
                <>
                  <div className="w">{card.word}</div>
                  {card.language && <div className="small" style={{ opacity: 0.85 }}>{card.language}</div>}
                  <div className="small" style={{ opacity: 0.75, marginTop: 16 }}>Toque para ver o significado</div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: '1.3rem' }}>{card.word}</div>
                  <div className="pre">{card.meaning || '(sem significado cadastrado)'}</div>
                  {card.example && <div className="small muted" style={{ fontStyle: 'italic' }}>“{card.example}”</div>}
                </>
              )}
            </div>
            {flipped ? (
              <div className="row">
                <button className="secondary grow" onClick={() => answer(false)}>✘ Errei</button>
                <button className="grow" onClick={() => answer(true)}>✔ Acertei</button>
              </div>
            ) : <button className="secondary block" onClick={() => setFlipped(true)}>Mostrar resposta</button>}
          </>
        )}
      </div>
    </Modal>
  );
}

export default function Glossary() {
  const [params] = useSearchParams();
  const lib = useLibrary();
  const languages = useList('language');
  const all = useLiveQuery(() => db.glossary.toArray(), []) ?? [];
  const [q, setQ] = useState(params.get('q') ?? '');
  const [lang, setLang] = useState('');
  const [bookId, setBookId] = useState('');
  const [edit, setEdit] = useState<Partial<GlossaryEntry> | null>(null);
  const [cards, setCards] = useState(false);

  const shown = all
    .filter((e) => (!lang || e.language === lang) && (!bookId || e.bookId === bookId) && (!q || matches(e.word, q) || matches(e.meaning, q)))
    .sort((a, b) => a.word.localeCompare(b.word, 'pt-BR'));
  const due = shown.filter((e) => isDue(e.nextReview)).length;
  const usedLangs = [...new Set([...all.map((e) => e.language).filter(Boolean) as string[]])];
  const usedBooks = [...new Set(all.map((e) => e.bookId).filter(Boolean) as string[])];

  return (
    <div>
      <PageTitle right={<button onClick={() => setEdit({})}>+ Palavra</button>}>Glossário</PageTitle>
      <button className="block secondary" onClick={() => setCards(true)} disabled={!shown.length}>🃏 Revisar com flashcards {due ? `(${due} para hoje)` : ''}</button>
      <div className="stack mt">
        <input type="search" placeholder="Buscar palavra ou significado" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="grid2">
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="">Todos os idiomas</option>
            {[...new Set([...usedLangs, ...languages.filter((l) => usedLangs.includes(l))])].map((l) => <option key={l}>{l}</option>)}
          </select>
          <select value={bookId} onChange={(e) => setBookId(e.target.value)}>
            <option value="">Todos os livros</option>
            {usedBooks.map((id) => <option key={id} value={id}>{lib.bookMap.get(id)?.title ?? '—'}</option>)}
          </select>
        </div>
      </div>
      <p className="small muted mt">{shown.length} palavra(s)</p>
      <EntryList entries={shown} books={lib.bookMap} onEdit={setEdit} />
      {edit && <EntryForm initial={edit} onClose={() => setEdit(null)} />}
      {cards && <Flashcards entries={shown} onClose={() => setCards(false)} />}
    </div>
  );
}

export function BookGlossaryTab({ book }: { book: Book }) {
  const entries = useLiveQuery(() => db.glossary.where('bookId').equals(book.id).toArray(), [book.id]) ?? [];
  const lib = useLibrary();
  const [edit, setEdit] = useState<Partial<GlossaryEntry> | null>(null);
  const [cards, setCards] = useState(false);
  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="grow" onClick={() => setEdit({})}>+ Palavra deste livro</button>
        <button className="secondary grow" onClick={() => setCards(true)} disabled={!entries.length}>🃏 Revisar</button>
      </div>
      <EntryList entries={[...entries].sort((a, b) => a.word.localeCompare(b.word, 'pt-BR'))} books={lib.bookMap} onEdit={setEdit} />
      <p className="small center"><Link to="/glossario">Ver glossário geral</Link></p>
      {edit && <EntryForm initial={edit} fixedBook={book} onClose={() => setEdit(null)} />}
      {cards && <Flashcards entries={entries} onClose={() => setCards(false)} />}
    </div>
  );
}
