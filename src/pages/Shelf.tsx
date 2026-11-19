import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookBrowser, BookList } from '../components/BookBrowser';
import { Cover, Icon, Progress } from '../components/ui';
import type { Book } from '../db';
import { SessionForm } from './book/ReadingTab';
import { db } from '../db';
import { useLibrary } from '../data/hooks';
import { GROUP_LABEL, matches, normalize, seriesBooks, type GroupKey } from '../domain/filters';
import { lastBackupDate } from '../services/backup';
import { PillCard, QuoteOfDayCard } from './Inspiration';

const GROUPS: GroupKey[] = ['genero', 'serie', 'local', 'idioma', 'status', 'autor', 'ano', 'tag', 'formato'];

function SearchResults({ q }: { q: string }) {
  const lib = useLibrary();
  const quotes = useLiveQuery(() => db.quotes.toArray(), []) ?? [];
  const notes = useLiveQuery(() => db.notes.toArray(), []) ?? [];
  const photos = useLiveQuery(() => db.photos.toArray(), []) ?? [];
  const words = useLiveQuery(() => db.glossary.toArray(), []) ?? [];

  // compara sem acentos, maiúsculas, espaços e hífens ("off campus" acha "Off-Campus")
  const loose = (t?: string) => (t ? normalize(t).replace(/[^a-z0-9]/g, '') : '');
  const lq = loose(q);
  const hit = (t?: string) => matches(t, q) || (lq.length >= 3 && loose(t).includes(lq));
  const books = useMemo(
    () => lib.books
      .filter((b) => hit(b.title) || hit(b.subtitle) || b.authors.some((a) => hit(a)) || matches(b.isbn, q) || hit(b.series))
      .sort((a, b) => (a.series ?? '').localeCompare(b.series ?? '', 'pt-BR') || (a.seriesNumber ?? 999) - (b.seriesNumber ?? 999) || a.title.localeCompare(b.title, 'pt-BR')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lib.books, q],
  );
  const sagas = [...new Set(lib.books.map((b) => b.series).filter((s): s is string => !!s && hit(s)))];
  const title = (id?: string) => (id ? lib.bookMap.get(id)?.title : undefined);
  const fq = quotes.filter((x) => matches(x.text, q) || matches(x.comment, q));
  const fn = notes.filter((x) => matches(x.text, q) || matches(x.title, q));
  const fp = photos.filter((x) => matches(x.ocrText, q) || matches(x.caption, q));
  const fw = words.filter((x) => matches(x.word, q) || matches(x.meaning, q) || matches(x.example, q));
  const none = !books.length && !sagas.length && !fq.length && !fn.length && !fp.length && !fw.length;

  return (
    <div>
      {none && <div className="empty"><div className="big">🔎</div>Nada encontrado para “{q}”.</div>}
      {sagas.map((sg) => {
        const vols = seriesBooks(lib.books, sg);
        const read = vols.filter((b) => b.status === 'lido' || b.status === 'relendo').length;
        return (
          <Link key={sg} to={`/grupo/serie/${encodeURIComponent(sg)}`} className="group-tile" style={{ marginBottom: 12 }}>
            <span><b>📚 Saga {sg}</b><br /><span className="small muted">{vols.length} livro(s) · {read} lido(s)</span></span>
            <span className="muted">ver todos ›</span>
          </Link>
        );
      })}
      {books.length > 0 && <div className="card"><h3>Livros</h3><BookList books={books} meta={lib.meta} /></div>}
      {fq.length > 0 && (
        <div className="card"><h3>Citações</h3>
          {fq.map((x) => <Link key={x.id} to={`/livro/${x.bookId}?aba=citacoes`} className="list-item" style={{ display: 'block' }}><div className="quote">{x.text}</div><div className="small muted">{title(x.bookId)}{x.page ? ` · p. ${x.page}` : ''}</div></Link>)}
        </div>
      )}
      {fn.length > 0 && (
        <div className="card"><h3>Comentários</h3>
          {fn.map((x) => <Link key={x.id} to={`/livro/${x.bookId}?aba=comentarios`} className="list-item" style={{ display: 'block' }}><b>{x.title || 'Comentário'}</b><div className="small ellipsis">{x.text}</div><div className="small muted">{title(x.bookId)}</div></Link>)}
        </div>
      )}
      {fp.length > 0 && (
        <div className="card"><h3>Texto de fotos</h3>
          {fp.map((x) => <Link key={x.id} to={`/livro/${x.bookId}?aba=fotos`} className="list-item" style={{ display: 'block' }}><div className="small ellipsis">{x.ocrText}</div><div className="small muted">{title(x.bookId)}{x.page ? ` · p. ${x.page}` : ''}</div></Link>)}
        </div>
      )}
      {fw.length > 0 && (
        <div className="card"><h3>Glossário</h3>
          {fw.map((x) => <Link key={x.id} to={`/glossario?q=${encodeURIComponent(x.word)}`} className="list-item" style={{ display: 'block' }}><b>{x.word}</b> <span className="small muted">{x.language}</span><div className="small ellipsis">{x.meaning}</div></Link>)}
        </div>
      )}
    </div>
  );
}

function BackupReminder() {
  const count = useLiveQuery(() => db.books.count(), []) ?? 0;
  const last = lastBackupDate();
  const days = last ? (Date.now() - new Date(last).getTime()) / 86_400_000 : Infinity;
  if (count < 3 || days < 30) return null;
  return (
    <div className="alert info small">
      💾 {last ? 'Faz mais de um mês desde o último backup.' : 'Você ainda não fez backup.'} Seus livros ficam só neste aparelho.{' '}
      <Link to="/backup">Fazer backup agora</Link>
    </div>
  );
}

/** Livros em leitura, sempre no topo da estante, com progresso e registro rápido de páginas. */
function ReadingNow() {
  const lib = useLibrary();
  const [form, setForm] = useState<Book | null>(null);
  const reading = lib.books
    .filter((b) => b.status === 'lendo' || b.status === 'relendo')
    .sort((a, b) => (lib.meta.get(b.id)?.pct ?? 0) - (lib.meta.get(a.id)?.pct ?? 0));
  if (!reading.length) return null;
  return (
    <div className="card reading-now">
      <h3 style={{ margin: '0 0 8px' }}>📖 Lendo agora</h3>
      <div className="strip">
        {reading.map((b) => {
          const m = lib.meta.get(b.id);
          return (
            <div key={b.id} className="reading-item">
              <Link to={`/livro/${b.id}?aba=leitura`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Cover book={b} pct={m?.pct} />
                <div className="small ellipsis" style={{ fontWeight: 700, marginTop: 4 }}>{b.title}</div>
              </Link>
              <div className="small muted">{b.pageCount ? `p. ${m?.page ?? 0} de ${b.pageCount} · ${m?.pct ?? 0}%` : `p. ${m?.page ?? 0}`}</div>
              <Progress pct={m?.pct ?? 0} />
              <button className="secondary small block" style={{ marginTop: 6 }} onClick={() => setForm(b)}>+ páginas</button>
            </div>
          );
        })}
      </div>
      {form && <SessionForm book={form} fromPage={lib.meta.get(form.id)?.page ?? 0} onClose={() => setForm(null)} />}
    </div>
  );
}

export default function Shelf() {
  const [q, setQ] = useState('');
  return (
    <div>
      <BackupReminder />
      <div className="row nowrap" style={{ marginBottom: 12, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, color: 'var(--muted)', display: 'flex' }}>{Icon.search()}</span>
        <input
          type="search"
          placeholder="Buscar título, autor, citação, anotação, palavra…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ paddingLeft: 42 }}
        />
      </div>
      {q.trim().length >= 2 ? (
        <SearchResults q={q.trim()} />
      ) : (
        <>
          <ReadingNow />
          <div className="daily-cards">
            <QuoteOfDayCard />
            <PillCard />
          </div>
          <div className="chips scroll" style={{ marginBottom: 10 }}>
            <span className="small muted" style={{ alignSelf: 'center', whiteSpace: 'nowrap' }}>Agrupar:</span>
            <Link to="/favoritos" className="chip" style={{ textDecoration: 'none' }}>Favoritos</Link>
            {GROUPS.map((g) => <Link key={g} to={`/grupos/${g}`} className="chip" style={{ textDecoration: 'none' }}>{GROUP_LABEL[g]}</Link>)}
            <Link to="/citacoes" className="chip" style={{ textDecoration: 'none' }}>❝ Citações</Link>
          </div>
          <BookBrowser queueLink />
        </>
      )}
    </div>
  );
}
