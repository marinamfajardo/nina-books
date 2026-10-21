import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Cover, fmtDate, PageTitle, Stars } from '../components/ui';
import { useLibrary } from '../data/hooks';
import { STATUS_LABEL } from '../domain/constants';
import { authorStats, rankAuthors, rankBooks, type AuthorSort } from '../domain/rankings';
import { countBy, formatDuration, formatNumber } from '../domain/stats';

const MEDALS = ['🥇', '🥈', '🥉'];
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' };

function useYears() {
  const lib = useLibrary();
  return useMemo(() => {
    const ys = new Set<string>();
    for (const r of lib.readings) if (r.finishedAt) ys.add(r.finishedAt.slice(0, 4));
    for (const s of lib.sessions) ys.add(s.date.slice(0, 4));
    return [...ys].sort().reverse();
  }, [lib.readings, lib.sessions]);
}

function YearSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const years = useYears();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 'auto' }}>
      <option value="">Todos os anos</option>
      {years.map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  );
}

const rating = (v: number) => (v / 2).toFixed(1).replace('.', ',');

export default function Ranking() {
  const lib = useLibrary();
  const [year, setYear] = useState('');
  const [tab, setTab] = useState<'livros' | 'autores' | 'generos'>('livros');
  const [by, setBy] = useState<AuthorSort>('livros');
  const books = useMemo(() => rankBooks(lib.books, lib.readings, year || undefined), [lib, year]);
  const authors = useMemo(() => rankAuthors(authorStats(lib.books, lib.readings, lib.sessions, year || undefined), by), [lib, year, by]);
  const genres = useMemo(() => countBy(books.map((x) => x.book), 'genero').filter((g) => g.key !== 'Sem gênero'), [books]);

  return (
    <div>
      <PageTitle back right={<YearSelect value={year} onChange={setYear} />}>Meu ranking</PageTitle>
      <div className="tabs">
        {([['livros', 'Livros'], ['autores', 'Autores'], ['generos', 'Gêneros']] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'livros' && (
        <div>
          <p className="small muted">{year ? `Livros que você terminou em ${year}` : 'Todos os livros lidos'}, do mais bem avaliado para o menos.</p>
          {!books.length && <div className="empty"><div className="big">🏆</div>Marque livros como “Lido” e dê notas para montar seu ranking.</div>}
          {books.map((x, i) => (
            <Link key={x.book.id} to={`/livro/${x.book.id}`} className="list-item">
              <div style={{ width: 34, textAlign: 'center', fontFamily: 'var(--serif)', fontSize: i < 3 ? '1.6rem' : '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>{MEDALS[i] ?? `${i + 1}º`}</div>
              <div style={{ width: 48, flex: 'none' }}><Cover book={x.book} /></div>
              <div className="grow">
                <b>{x.book.title}</b>
                <div className="small muted ellipsis">{x.book.authors.join(', ')}</div>
                <div className="row" style={{ gap: 6 }}>
                  {x.book.rating > 0 ? <Stars value={x.book.rating} /> : <span className="small muted">sem nota</span>}
                  {x.book.favorite && <span style={{ color: 'var(--accent)' }}>♥</span>}
                  {x.times > 1 && <span className="badge">lido {x.times}×</span>}
                </div>
              </div>
              {x.finishedAt && <span className="small muted">{fmtDate(x.finishedAt)}</span>}
            </Link>
          ))}
        </div>
      )}

      {tab === 'autores' && (
        <div>
          <div className="chips" style={{ marginBottom: 10 }}>
            {([['livros', 'Mais livros lidos'], ['paginas', 'Mais páginas'], ['nota', 'Melhor nota média']] as const).map(([k, l]) => (
              <button key={k} className={`chip${by === k ? ' on' : ''}`} onClick={() => setBy(k)}>{l}</button>
            ))}
          </div>
          {!authors.length && <div className="empty">Nenhum autor para mostrar ainda.</div>}
          {authors.slice(0, 50).map((a, i) => (
            <Link key={a.name} to={`/autor/${encodeURIComponent(a.name)}`} className="list-item">
              <div style={{ width: 34, textAlign: 'center', fontFamily: 'var(--serif)', fontSize: i < 3 ? '1.6rem' : '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>{MEDALS[i] ?? `${i + 1}º`}</div>
              <div className="grow">
                <b>{a.name}</b>
                <div className="small muted">{a.booksRead} lido(s) · {formatNumber(a.pages)} páginas{a.avgRating ? ` · ★ ${rating(a.avgRating)}` : ''}</div>
              </div>
              <span className="muted">›</span>
            </Link>
          ))}
        </div>
      )}

      {tab === 'generos' && (
        <div className="card">
          {!genres.length && <p className="small muted">Classifique seus livros por gênero para ver o ranking.</p>}
          {genres.map((g, i) => (
            <Link key={g.key} to={`/grupo/genero/${encodeURIComponent(g.key)}`} className="list-item">
              <div style={{ width: 34, textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>{MEDALS[i] ?? `${i + 1}º`}</div>
              <b className="grow">{g.key}</b>
              <span className="badge">{g.count} livro(s)</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AuthorPage() {
  const name = decodeURIComponent(useParams().name ?? '');
  const lib = useLibrary();
  const st = useMemo(() => authorStats(lib.books, lib.readings, lib.sessions).find((a) => a.name === name), [lib, name]);
  if (!lib.loaded) return <div className="empty">Carregando…</div>;
  if (!st) return <div><PageTitle back>{name}</PageTitle><div className="empty">Nenhum livro desse autor na estante.</div></div>;
  const books = [...st.books].sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title, 'pt-BR'));

  return (
    <div>
      <PageTitle back>{name}</PageTitle>
      <div className="kpis">
        <div className="kpi"><div className="v">{st.books.length}</div><div className="l">livros na estante</div></div>
        <div className="kpi"><div className="v">{st.booksRead}</div><div className="l">lidos{st.readsCount > st.booksRead ? ` (${st.readsCount} leituras)` : ''}</div></div>
        <div className="kpi"><div className="v">{formatNumber(st.pages)}</div><div className="l">páginas lidas</div></div>
        <div className="kpi"><div className="v">{formatNumber(st.words)}</div><div className="l">palavras lidas</div></div>
        <div className="kpi"><div className="v">{st.avgRating ? `★ ${rating(st.avgRating)}` : '—'}</div><div className="l">nota média</div></div>
        <div className="kpi"><div className="v">{st.favorites}</div><div className="l">favoritos ♥</div></div>
        <div className="kpi"><div className="v">{st.seconds ? formatDuration(st.seconds) : '—'}</div><div className="l">tempo lendo</div></div>
        <div className="kpi"><div className="v">{st.avgDaysToFinish ? Math.round(st.avgDaysToFinish) : '—'}</div><div className="l">dias, em média, por livro</div></div>
      </div>

      {(st.firstRead || st.genres.length > 0) && (
        <div className="card small stack">
          {st.firstRead && <div>📅 Primeiro livro concluído: <b>{fmtDate(st.firstRead)}</b>{st.lastRead !== st.firstRead && <> · último: <b>{fmtDate(st.lastRead)}</b></>}</div>}
          {st.genres.length > 0 && <div className="chips">{st.genres.map((g) => <span key={g.key} className="chip static">{g.key} · {g.count}</span>)}</div>}
          {st.languages.length > 0 && <div>🌍 Lido em: {st.languages.map((l) => `${l.key} (${l.count})`).join(', ')}</div>}
        </div>
      )}

      {st.pagesByYear.length > 0 && (
        <div className="card">
          <h3>Páginas por ano</h3>
          <div className="chart" style={{ height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={st.pagesByYear}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="key" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatNumber(Number(v)), 'páginas']} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="pages" fill="#b3263e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Livros</h3>
        {books.map((b) => (
          <Link key={b.id} to={`/livro/${b.id}`} className="list-item">
            <div style={{ width: 48, flex: 'none' }}><Cover book={b} /></div>
            <div className="grow">
              <b>{b.title}</b>
              <div className="row" style={{ gap: 6 }}><span className="badge">{STATUS_LABEL[b.status]}</span>{b.rating > 0 && <Stars value={b.rating} />}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AuthorList() {
  const lib = useLibrary();
  const [q, setQ] = useState('');
  const all = useMemo(() => authorStats(lib.books, lib.readings, lib.sessions).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [lib]);
  const shown = all.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageTitle back>Autores</PageTitle>
      <input type="search" placeholder="Buscar autor" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
      {shown.map((a) => (
        <Link key={a.name} to={`/autor/${encodeURIComponent(a.name)}`} className="list-item">
          <div className="grow"><b>{a.name}</b><div className="small muted">{a.books.length} livro(s) · {a.booksRead} lido(s) · {formatNumber(a.pages)} páginas</div></div>
          <span className="muted">›</span>
        </Link>
      ))}
    </div>
  );
}
