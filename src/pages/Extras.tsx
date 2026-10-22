import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Cover, ErrorBox, fmtDate, Modal, PageTitle, Progress, useToast } from '../components/ui';
import { db, nowIso, uid, type Loan, type WishItem } from '../db';
import { createBook, updateBook } from '../data/actions';
import { useLibrary } from '../data/hooks';
import { formatNumber, goalProgress, today } from '../domain/stats';
import { downloadCover, searchBooks } from '../services/bookLookup';
import { saveMedia } from '../data/actions';
import { redeemVoucher } from './Achievements';

// ---------- Metas ----------
export function Goals() {
  const lib = useLibrary();
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];
  const year = new Date().getFullYear();
  const [edit, setEdit] = useState<{ year: number; books: string; pages: string } | null>(null);
  const all = [...new Set([year, ...goals.map((g) => g.year)])].sort((a, b) => b - a);
  const toast = useToast();

  return (
    <div>
      <PageTitle back>Metas de leitura</PageTitle>
      {all.map((y) => {
        const g = goals.find((x) => x.year === y);
        const p = goalProgress(y, lib.readings, lib.sessions, g);
        return (
          <div className="card" key={y}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>Desafio {y}</h3>
              <button className="secondary small" onClick={() => setEdit({ year: y, books: String(g?.books ?? ''), pages: String(g?.pages ?? '') })}>{g ? 'Editar' : 'Definir meta'}</button>
            </div>
            {g?.books ? <div className="mt"><div className="row between small"><span>📚 {p.booksDone} de {g.books} livros</span><b>{p.booksPct}%</b></div><Progress pct={p.booksPct} /></div> : null}
            {g?.pages ? <div className="mt"><div className="row between small"><span>📄 {formatNumber(p.pagesDone)} de {formatNumber(g.pages)} páginas</span><b>{p.pagesPct}%</b></div><Progress pct={p.pagesPct} /></div> : null}
            {y === year && g?.books ? (
              <p className="small muted mt">
                {p.booksDone >= g.books ? 'Meta cumprida! 🎉' : p.booksDone >= p.booksExpected ? 'No ritmo certo ✨' : `Faltam ${p.booksExpected - p.booksDone} livro(s) para alcançar o ritmo esperado.`}
              </p>
            ) : null}
            {!g && <p className="small muted mt">{p.booksDone} livros e {formatNumber(p.pagesDone)} páginas em {y}.</p>}
          </div>
        );
      })}
      <button className="secondary block" onClick={() => setEdit({ year: year + 1, books: '', pages: '' })}>+ Meta para outro ano</button>
      {edit && (
        <Modal title="Meta anual" onClose={() => setEdit(null)}>
          <div className="stack">
            <label className="field"><span>Ano</span><input inputMode="numeric" value={edit.year} onChange={(e) => setEdit({ ...edit, year: Number(e.target.value) || year })} /></label>
            <label className="field"><span>Quantos livros?</span><input inputMode="numeric" value={edit.books} onChange={(e) => setEdit({ ...edit, books: e.target.value.replace(/\D/g, '') })} /></label>
            <label className="field"><span>Quantas páginas? (opcional)</span><input inputMode="numeric" value={edit.pages} onChange={(e) => setEdit({ ...edit, pages: e.target.value.replace(/\D/g, '') })} /></label>
            <div className="row">
              <button className="danger" onClick={async () => { await db.goals.delete(edit.year); setEdit(null); }}>Remover</button>
              <button className="grow" onClick={async () => {
                await db.goals.put({ year: edit.year, books: Number(edit.books) || undefined, pages: Number(edit.pages) || undefined });
                setEdit(null);
                toast('Meta salva 🎯');
              }}>Salvar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- Fila "Quero ler" com prioridade ----------
const PRIORITY = { 1: 'Alta', 2: 'Média', 3: 'Baixa' } as Record<number, string>;
export function WantToRead() {
  const lib = useLibrary();
  const list = lib.books.filter((b) => b.status === 'quero_ler').sort((a, b) => (a.wantPriority ?? 2) - (b.wantPriority ?? 2) || a.createdAt.localeCompare(b.createdAt));
  return (
    <div>
      <PageTitle back>Quero ler</PageTitle>
      {lib.loaded && !list.length && <div className="empty">Nenhum livro na fila.</div>}
      {[1, 2, 3].map((p) => {
        const items = list.filter((b) => (b.wantPriority ?? 2) === p);
        if (!items.length) return null;
        return (
          <div className="card" key={p}>
            <h3>Prioridade {PRIORITY[p].toLowerCase()}</h3>
            {items.map((b) => (
              <div key={b.id} className="list-item">
                <Link to={`/livro/${b.id}`} style={{ width: 52, flex: 'none' }}><Cover book={b} /></Link>
                <Link to={`/livro/${b.id}`} className="grow" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <b>{b.title}</b><div className="small muted">{b.authors.join(', ')}{b.pageCount ? ` · ${b.pageCount} p.` : ''}</div>
                </Link>
                <select value={b.wantPriority ?? 2} onChange={(e) => updateBook(b.id, { wantPriority: Number(e.target.value) })} style={{ width: 'auto' }}>
                  <option value={1}>Alta</option><option value={2}>Média</option><option value={3}>Baixa</option>
                </select>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Empréstimos ----------
export function Loans() {
  const lib = useLibrary();
  const [params] = useSearchParams();
  const loans = useLiveQuery(() => db.loans.toArray(), []) ?? [];
  const [edit, setEdit] = useState<Partial<Loan> | null>(() => (params.get('livro') ? { bookId: params.get('livro')!, date: today() } : null));
  const open = loans.filter((l) => !l.returnedAt).sort((a, b) => a.date.localeCompare(b.date));
  const closed = loans.filter((l) => l.returnedAt).sort((a, b) => b.returnedAt!.localeCompare(a.returnedAt!));
  const title = (id: string) => lib.bookMap.get(id)?.title ?? 'Livro apagado';

  const row = (l: Loan) => (
    <div key={l.id} className="list-item">
      <div className="grow">
        <b>{title(l.bookId)}</b>
        <div className="small">para <b>{l.person}</b> em {fmtDate(l.date)}</div>
        {l.dueDate && !l.returnedAt && <div className={`small${l.dueDate < today() ? '' : ' muted'}`} style={l.dueDate < today() ? { color: 'var(--danger)', fontWeight: 700 } : undefined}>Devolver até {fmtDate(l.dueDate)}</div>}
        {l.returnedAt && <div className="small muted">Devolvido em {fmtDate(l.returnedAt)}</div>}
        {l.notes && <div className="small muted">{l.notes}</div>}
      </div>
      {!l.returnedAt && <button className="small" onClick={() => db.loans.update(l.id, { returnedAt: today() })}>Devolvido</button>}
      <button className="icon small" onClick={() => setEdit(l)}>✎</button>
    </div>
  );

  return (
    <div>
      <PageTitle back right={<button onClick={() => setEdit({ date: today() })}>+ Empréstimo</button>}>Empréstimos</PageTitle>
      <div className="card"><h3>Emprestados agora ({open.length})</h3>{open.length ? open.map(row) : <p className="small muted">Nenhum livro emprestado.</p>}</div>
      {closed.length > 0 && <div className="card"><h3>Histórico</h3>{closed.map(row)}</div>}
      {edit && (
        <Modal title="Empréstimo" onClose={() => setEdit(null)}>
          <div className="stack">
            <label className="field"><span>Livro</span>
              <select value={edit.bookId ?? ''} onChange={(e) => setEdit({ ...edit, bookId: e.target.value })}>
                <option value="">Escolha…</option>
                {[...lib.books].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')).map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select>
            </label>
            <label className="field"><span>Para quem?</span><input value={edit.person ?? ''} onChange={(e) => setEdit({ ...edit, person: e.target.value })} /></label>
            <div className="grid2">
              <label className="field"><span>Data</span><input type="date" value={edit.date ?? ''} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></label>
              <label className="field"><span>Devolver até</span><input type="date" value={edit.dueDate ?? ''} onChange={(e) => setEdit({ ...edit, dueDate: e.target.value || undefined })} /></label>
            </div>
            {edit.id && <label className="field"><span>Devolvido em</span><input type="date" value={edit.returnedAt ?? ''} onChange={(e) => setEdit({ ...edit, returnedAt: e.target.value || undefined })} /></label>}
            <label className="field"><span>Observações</span><input value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
            <div className="row">
              {edit.id && <button className="danger" onClick={async () => { await db.loans.delete(edit.id!); setEdit(null); }}>Apagar</button>}
              <button className="grow" disabled={!edit.bookId || !edit.person?.trim()} onClick={async () => {
                const data = { bookId: edit.bookId!, person: edit.person!.trim(), date: edit.date || today(), dueDate: edit.dueDate, returnedAt: edit.returnedAt, notes: edit.notes || undefined };
                if (edit.id) await db.loans.update(edit.id, data);
                else await db.loans.add({ id: uid(), ...data });
                setEdit(null);
              }}>Salvar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- Lista de desejos ----------
export function Wishlist() {
  const items = useLiveQuery(() => db.wishlist.toArray(), []) ?? [];
  const nav = useNavigate();
  const toast = useToast();
  const [edit, setEdit] = useState<Partial<WishItem> | null>(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const sorted = useMemo(() => [...items].sort((a, b) => a.priority - b.priority || b.createdAt.localeCompare(a.createdAt)), [items]);

  const quickAdd = async () => {
    setErr(null);
    try {
      const r = await searchBooks(q);
      if (!r[0]) return setErr('Nada encontrado. Preencha manualmente.');
      setEdit({ title: r[0].title, author: r[0].authors.join(', '), isbn: r[0].isbn, coverUrl: r[0].coverUrl, priority: 2 });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const bought = async (w: WishItem) => {
    if (!confirm(`Mover “${w.title}” para a estante como “Quero ler”?`)) return;
    let coverId: string | undefined;
    if (w.coverUrl) {
      const blob = await downloadCover(w.coverUrl);
      if (blob) coverId = await saveMedia(blob, 'capa');
    }
    const id = await createBook({ title: w.title, authors: w.author ? w.author.split(',').map((s) => s.trim()) : [], isbn: w.isbn, coverUrl: w.coverUrl, coverId, ownership: 'proprio', status: 'quero_ler' });
    await db.wishlist.delete(w.id);
    const used = await redeemVoucher(w.title);
    toast(used ? 'Vale-livro usado! Livro na estante 📚🎟️' : 'Livro na estante! 📚');
    nav(`/livro/${id}`);
  };

  return (
    <div>
      <PageTitle back right={<button onClick={() => setEdit({ priority: 2 })}>+ Desejo</button>}>Lista de desejos</PageTitle>
      <form className="row nowrap" onSubmit={(e) => { e.preventDefault(); if (q.trim()) void quickAdd(); }} style={{ marginBottom: 12 }}>
        <input type="search" placeholder="Buscar livro para adicionar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="secondary">Buscar</button>
      </form>
      <ErrorBox error={err} />
      {!sorted.length && <div className="empty"><div className="big">🛍️</div>Nenhum livro na lista de desejos.</div>}
      {sorted.map((w) => (
        <div className="list-item" key={w.id}>
          <div style={{ width: 52, flex: 'none' }}><Cover book={{ title: w.title, authors: [w.author ?? ''], coverUrl: w.coverUrl, favorite: false }} /></div>
          <div className="grow">
            <b>{w.title}</b>
            <div className="small muted">{w.author}</div>
            <div className="small">{PRIORITY[w.priority]}{w.price ? ` · ${w.price}` : ''}{w.store ? ` · ${w.store}` : ''}</div>
          </div>
          <button className="small" onClick={() => bought(w)}>Comprei</button>
          <button className="icon small" onClick={() => setEdit(w)}>✎</button>
        </div>
      ))}
      {edit && (
        <Modal title="Desejo" onClose={() => setEdit(null)}>
          <div className="stack">
            <label className="field"><span>Título *</span><input value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
            <label className="field"><span>Autor</span><input value={edit.author ?? ''} onChange={(e) => setEdit({ ...edit, author: e.target.value })} /></label>
            <div className="grid2">
              <label className="field"><span>Prioridade</span>
                <select value={edit.priority ?? 2} onChange={(e) => setEdit({ ...edit, priority: Number(e.target.value) })}>
                  <option value={1}>Alta</option><option value={2}>Média</option><option value={3}>Baixa</option>
                </select>
              </label>
              <label className="field"><span>Preço</span><input value={edit.price ?? ''} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></label>
            </div>
            <label className="field"><span>Onde comprar</span><input value={edit.store ?? ''} onChange={(e) => setEdit({ ...edit, store: e.target.value })} /></label>
            <label className="field"><span>Observações</span><input value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
            <div className="row">
              {edit.id && <button className="danger" onClick={async () => { await db.wishlist.delete(edit.id!); setEdit(null); }}>Apagar</button>}
              <button className="grow" disabled={!edit.title?.trim()} onClick={async () => {
                const data = { title: edit.title!.trim(), author: edit.author || undefined, isbn: edit.isbn, coverUrl: edit.coverUrl, priority: edit.priority ?? 2, price: edit.price || undefined, store: edit.store || undefined, notes: edit.notes || undefined };
                if (edit.id) await db.wishlist.update(edit.id, data);
                else await db.wishlist.add({ id: uid(), ...data, createdAt: nowIso() });
                setEdit(null);
                setQ('');
              }}>Salvar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
