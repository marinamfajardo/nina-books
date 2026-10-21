import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BookForm } from '../../components/BookForm';
import { ChipSelect, Cover, Modal, Progress, Stars, fmtDate, useToast } from '../../components/ui';
import { db } from '../../db';
import { changeStatus, deleteBook, updateBook } from '../../data/actions';
import { useBook } from '../../data/hooks';
import { updateFromDraft } from '../../data/saveDraft';
import { FORMAT_LABEL, OWNERSHIP_LABEL, STATUS_LABEL, STATUSES } from '../../domain/constants';
import { currentPage, progressPercent, today } from '../../domain/stats';
import { BookGlossaryTab } from '../Glossary';
import { NotesTab } from './NotesTab';
import { PhotosTab, QuotesTab } from './QuotesPhotos';
import { ReadingTab } from './ReadingTab';
import { SummaryTab } from './SummaryTab';

const TABS = [
  ['geral', 'Visão geral'], ['resumo', 'Resumo e resenha'], ['leitura', 'Leitura'], ['midia', 'Fotos, áudios e vídeos'], ['citacoes', 'Citações'],
  ['notas', 'Anotações'], ['fotos', 'Páginas fotografadas'], ['glossario', 'Glossário'],
] as const;
type Tab = (typeof TABS)[number][0];

export default function BookDetail() {
  const { id } = useParams();
  const book = useBook(id);
  const nav = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('aba') as Tab) || 'geral';
  const [editing, setEditing] = useState(false);
  const [finishing, setFinishing] = useState<'lido' | 'desisti' | null>(null);
  const [finishDate, setFinishDate] = useState(today());
  const sessions = useLiveQuery(() => (id ? db.sessions.where('bookId').equals(id).toArray() : []), [id]) ?? [];
  const readings = useLiveQuery(() => (id ? db.readings.where('bookId').equals(id).toArray() : []), [id]) ?? [];
  const loan = useLiveQuery(() => (id ? db.loans.where('bookId').equals(id).filter((l) => !l.returnedAt).first() : undefined), [id]);

  if (book === undefined) return <div className="empty">Carregando…</div>;
  if (!book) return <div className="empty">Livro não encontrado. <Link to="/">Voltar à estante</Link></div>;

  const last = [...readings].sort((a, b) => a.number - b.number).pop();
  const page = last ? currentPage(sessions, last.id) : 0;
  const pct = book.status === 'lido' ? 100 : progressPercent(page, book.pageCount);

  const setStatus = async (s: typeof book.status | undefined) => {
    if (!s || s === book.status) return;
    if (s === 'lido' || s === 'desisti') {
      setFinishDate(today());
      setFinishing(s);
      return;
    }
    await changeStatus(book.id, s);
    toast(`Status: ${STATUS_LABEL[s]}`);
  };

  return (
    <div>
      <div className="row between nowrap" style={{ marginBottom: 8 }}>
        <button className="icon" onClick={() => nav(-1)} aria-label="Voltar" style={{ fontSize: '1.4rem' }}>‹</button>
        <div className="row nowrap" style={{ gap: 2 }}>
          <button className="icon" aria-label="Favorito" style={{ color: 'var(--accent)' }} onClick={() => updateBook(book.id, { favorite: !book.favorite })}>
            {book.favorite ? '♥' : '♡'}
          </button>
          <button className="secondary small" onClick={() => setEditing(true)}>Editar</button>
        </div>
      </div>

      <div className="book-hero">
        <Cover book={book} showFav={false} />
        <div>
          <h1 style={{ marginBottom: 2 }}>{book.title}</h1>
          {book.subtitle && <div className="muted" style={{ marginBottom: 4 }}>{book.subtitle}</div>}
          <div style={{ fontWeight: 700 }}>
            {book.authors.map((a, i) => <span key={a}>{i > 0 && ', '}<Link to={`/autor/${encodeURIComponent(a)}`}>{a}</Link></span>)}
          </div>
          <div className="small muted mt" style={{ marginTop: 6 }}>
            {[book.publisher, book.year, book.pageCount && `${book.pageCount} páginas`, book.isbn && `ISBN ${book.isbn}`].filter(Boolean).join(' · ')}
          </div>
          <div className="mt"><Stars value={book.rating} onChange={(rating) => updateBook(book.id, { rating })} /></div>
          {book.pageCount ? (
            <div className="mt">
              <div className="row between small"><span>Página {book.status === 'lido' ? book.pageCount : page} de {book.pageCount}</span><b>{pct}%</b></div>
              <Progress pct={pct} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt">
        <ChipSelect options={STATUSES} labels={STATUS_LABEL} value={book.status} onChange={setStatus} scroll />
      </div>

      <div className="tabs mt">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setParams({ aba: k }, { replace: true })}>{label}</button>
        ))}
      </div>

      {tab === 'geral' && (
        <div>
          <div className="card stack">
            <div className="chips">
              {book.genres.map((g) => <Link key={g} to={`/grupo/genero/${encodeURIComponent(g)}`} className="chip" style={{ textDecoration: 'none' }}>{g}</Link>)}
              {book.tags.map((t) => <Link key={t} to={`/grupo/tag/${encodeURIComponent(t)}`} className="chip" style={{ textDecoration: 'none' }}>#{t}</Link>)}
              {!book.genres.length && !book.tags.length && <span className="small muted">Sem gênero ou tags — toque em Editar para classificar.</span>}
            </div>
            <div className="grid2 small">
              <div><span className="muted">Li em</span><br /><b>{book.readingLanguage ?? '—'}</b></div>
              <div><span className="muted">Idioma original</span><br /><b>{book.originalLanguage ?? '—'}</b></div>
              <div><span className="muted">Formato</span><br /><b>{book.format ? FORMAT_LABEL[book.format] : '—'}</b></div>
              <div><span className="muted">Exemplar</span><br /><b>{book.ownership ? OWNERSHIP_LABEL[book.ownership] : '—'}</b></div>
              {last && <div><span className="muted">Início</span><br /><b>{fmtDate(last.startedAt)}</b></div>}
              {last?.finishedAt && <div><span className="muted">{last.outcome === 'abandonada' ? 'Desisti em' : 'Conclusão'}</span><br /><b>{fmtDate(last.finishedAt)}</b></div>}
            </div>
            {loan && <div className="alert info small">📤 Emprestado para <b>{loan.person}</b> desde {fmtDate(loan.date)}. <Link to="/emprestimos">Ver empréstimos</Link></div>}
          </div>
          {book.synopsis && (
            <div className="card"><h3>Sinopse da editora</h3><p className="pre">{book.synopsis}</p></div>
          )}
          <div className="row">
            <Link to={`/emprestimos?livro=${book.id}`} className="btn secondary grow">📤 Emprestar</Link>
            <button className="danger grow" onClick={async () => {
              if (confirm(`Apagar “${book.title}” e tudo dele (anotações, fotos, sessões)? Isso não pode ser desfeito.`)) {
                await deleteBook(book.id);
                toast('Livro apagado');
                nav('/', { replace: true });
              }
            }}>Apagar livro</button>
          </div>
        </div>
      )}
      {tab === 'resumo' && <SummaryTab book={book} />}
      {tab === 'leitura' && <ReadingTab book={book} sessions={sessions} readings={readings} />}
      {tab === 'midia' && <NotesTab bookId={book.id} mode="midia" />}
      {tab === 'notas' && <NotesTab bookId={book.id} mode="texto" />}
      {tab === 'citacoes' && <QuotesTab bookId={book.id} language={book.readingLanguage} />}
      {tab === 'fotos' && <PhotosTab bookId={book.id} />}
      {tab === 'glossario' && <BookGlossaryTab book={book} />}

      {editing && (
        <Modal title="Editar livro" onClose={() => setEditing(false)}>
          <BookForm
            initial={book}
            onCancel={() => setEditing(false)}
            onSave={async (d) => {
              if (d.status === 'lido' || d.status === 'desisti') {
                const s = d.status;
                await updateFromDraft(book.id, { ...d, status: book.status });
                setEditing(false);
                if (s !== book.status) { setFinishDate(today()); setFinishing(s); }
                return;
              }
              await updateFromDraft(book.id, d);
              setEditing(false);
              toast('Alterações salvas');
            }}
          />
        </Modal>
      )}

      {finishing && (
        <Modal title={finishing === 'lido' ? 'Terminei! 🎉' : 'Desisti do livro'} onClose={() => setFinishing(null)}>
          <div className="stack">
            <label className="field"><span>{finishing === 'lido' ? 'Quando terminou?' : 'Quando parou?'}</span>
              <input type="date" value={finishDate} max={today()} onChange={(e) => setFinishDate(e.target.value)} />
            </label>
            <p className="small muted">
              {finishing === 'lido'
                ? 'As páginas que ainda não estavam registradas em sessões serão contadas nesta data.'
                : 'Só as páginas que você registrou como lidas entram nas estatísticas.'}
            </p>
            <button className="block" onClick={async () => {
              await changeStatus(book.id, finishing, finishDate || today());
              setFinishing(null);
              toast(finishing === 'lido' ? 'Parabéns pela leitura! 📖' : 'Status: Desisti');
            }}>Confirmar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
