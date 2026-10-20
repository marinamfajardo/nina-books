import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookBrowser, BookList } from '../components/BookBrowser';
import { Icon } from '../components/ui';
import { db } from '../db';
import { useLibrary } from '../data/hooks';
import { GROUP_LABEL, matches, type GroupKey } from '../domain/filters';
import { lastBackupDate } from '../services/backup';

const GROUPS: GroupKey[] = ['genero', 'idioma', 'status', 'autor', 'ano', 'tag', 'formato'];

function SearchResults({ q }: { q: string }) {
  const lib = useLibrary();
  const quotes = useLiveQuery(() => db.quotes.toArray(), []) ?? [];
  const notes = useLiveQuery(() => db.notes.toArray(), []) ?? [];
  const photos = useLiveQuery(() => db.photos.toArray(), []) ?? [];
  const words = useLiveQuery(() => db.glossary.toArray(), []) ?? [];

  const books = useMemo(
    () => lib.books.filter((b) => matches(b.title, q) || matches(b.subtitle, q) || b.authors.some((a) => matches(a, q)) || matches(b.isbn, q)),
    [lib.books, q],
  );
  const title = (id?: string) => (id ? lib.bookMap.get(id)?.title : undefined);
  const fq = quotes.filter((x) => matches(x.text, q) || matches(x.comment, q));
  const fn = notes.filter((x) => matches(x.text, q) || matches(x.title, q));
  const fp = photos.filter((x) => matches(x.ocrText, q) || matches(x.caption, q));
  const fw = words.filter((x) => matches(x.word, q) || matches(x.meaning, q) || matches(x.example, q));
  const none = !books.length && !fq.length && !fn.length && !fp.length && !fw.length;

  return (
    <div>
      {none && <div className="empty"><div className="big">🔎</div>Nada encontrado para “{q}”.</div>}
      {books.length > 0 && <div className="card"><h3>Livros</h3><BookList books={books} meta={lib.meta} /></div>}
      {fq.length > 0 && (
        <div className="card"><h3>Citações</h3>
          {fq.map((x) => <Link key={x.id} to={`/livro/${x.bookId}?aba=citacoes`} className="list-item" style={{ display: 'block' }}><div className="quote">{x.text}</div><div className="small muted">{title(x.bookId)}{x.page ? ` · p. ${x.page}` : ''}</div></Link>)}
        </div>
      )}
      {fn.length > 0 && (
        <div className="card"><h3>Anotações</h3>
          {fn.map((x) => <Link key={x.id} to={`/livro/${x.bookId}?aba=notas`} className="list-item" style={{ display: 'block' }}><b>{x.title || 'Anotação'}</b><div className="small ellipsis">{x.text}</div><div className="small muted">{title(x.bookId)}</div></Link>)}
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
          <div className="chips scroll" style={{ marginBottom: 10 }}>
            <span className="small muted" style={{ alignSelf: 'center', whiteSpace: 'nowrap' }}>Agrupar:</span>
            {GROUPS.map((g) => <Link key={g} to={`/grupos/${g}`} className="chip" style={{ textDecoration: 'none' }}>{GROUP_LABEL[g]}</Link>)}
            <Link to="/quero-ler" className="chip" style={{ textDecoration: 'none' }}>Fila "Quero ler"</Link>
          </div>
          <BookBrowser />
        </>
      )}
    </div>
  );
}
