import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Cover, PageTitle, Stars } from '../components/ui';
import { useLibrary } from '../data/hooks';
import { medals } from '../domain/achievements';
import { authorStats, rankAuthors, rankBooks } from '../domain/rankings';
import { countBy, filterByRange, formatDuration, formatNumber, totals, totalsByPeriod } from '../domain/stats';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export default function Retrospective() {
  const params = useParams();
  const nav = useNavigate();
  const lib = useLibrary();
  const year = params.year ?? String(new Date().getFullYear());

  const data = useMemo(() => {
    const ranked = rankBooks(lib.books, lib.readings, year);
    const sessions = filterByRange(lib.sessions, `${year}-01-01`, `${year}-12-31`);
    const t = totals(sessions, lib.bookMap);
    const months = totalsByPeriod(sessions, lib.bookMap, 'mes');
    const bestMonth = [...months].sort((a, b) => b.pages - a.pages)[0];
    const topAuthor = rankAuthors(authorStats(lib.books, lib.readings, lib.sessions, year), 'livros')[0];
    const topGenre = countBy(ranked.map((x) => x.book), 'genero').filter((g) => g.key !== 'Sem gênero')[0];
    const longest = [...ranked].sort((a, b) => (b.book.pageCount ?? 0) - (a.book.pageCount ?? 0))[0];
    const yearMedals = medals(lib.readings).earned.filter((m) => m.earnedAt?.startsWith(year));
    // grupos de 5★ até ½★, e por último os sem nota
    const groups: { label: string; rating: number; items: typeof ranked }[] = [];
    for (let r = 10; r >= 1; r--) {
      const items = ranked.filter((x) => x.book.rating === r);
      if (items.length) groups.push({ label: `${(r / 2).toString().replace('.', ',')} estrela${r > 2 ? 's' : ''}`, rating: r, items });
    }
    const unrated = ranked.filter((x) => !x.book.rating);
    if (unrated.length) groups.push({ label: 'Sem nota', rating: 0, items: unrated });
    return { ranked, t, bestMonth, topAuthor, topGenre, longest, yearMedals, groups };
  }, [lib, year]);

  const years = [...new Set(lib.readings.filter((r) => r.finishedAt).map((r) => r.finishedAt!.slice(0, 4)))].sort().reverse();

  return (
    <div>
      <PageTitle back right={
        <select value={year} onChange={(e) => nav(`/retrospectiva/${e.target.value}`, { replace: true })} style={{ width: 'auto' }}>
          {[...new Set([year, ...years])].sort().reverse().map((y) => <option key={y}>{y}</option>)}
        </select>
      }>Retrospectiva</PageTitle>

      <div className="retro-hero">
        <div className="small" style={{ opacity: 0.85, letterSpacing: 2 }}>MEU ANO DE LEITURA</div>
        <div className="retro-year">{year}</div>
        <div className="retro-big">{data.ranked.length}</div>
        <div>livro{data.ranked.length === 1 ? '' : 's'} lido{data.ranked.length === 1 ? '' : 's'}</div>
      </div>

      {data.ranked.length === 0 ? (
        <div className="empty"><div className="big">📖</div>Nenhum livro concluído em {year} ainda.</div>
      ) : (
        <>
          <div className="kpis mt">
            <div className="kpi"><div className="v">{formatNumber(data.t.pages)}</div><div className="l">páginas</div></div>
            <div className="kpi"><div className="v">{formatNumber(data.t.words)}</div><div className="l">palavras</div></div>
            {data.t.seconds > 0 && <div className="kpi"><div className="v">{formatDuration(data.t.seconds)}</div><div className="l">lendo (cronometrado)</div></div>}
            {data.bestMonth && <div className="kpi"><div className="v" style={{ fontSize: '1.15rem' }}>{MONTHS[Number(data.bestMonth.key.slice(5, 7)) - 1]}</div><div className="l">mês com mais páginas ({formatNumber(data.bestMonth.pages)})</div></div>}
            {data.topGenre && <div className="kpi"><div className="v" style={{ fontSize: '1.15rem' }}>{data.topGenre.key}</div><div className="l">gênero do ano</div></div>}
            {data.topAuthor && <div className="kpi"><div className="v" style={{ fontSize: '1.15rem' }}>{data.topAuthor.name}</div><div className="l">autor(a) do ano · {data.topAuthor.booksRead} livro(s)</div></div>}
            {data.longest?.book.pageCount && <div className="kpi"><div className="v" style={{ fontSize: '1.15rem' }}>{data.longest.book.title}</div><div className="l">livro mais longo · {data.longest.book.pageCount} p.</div></div>}
            {data.yearMedals.length > 0 && <div className="kpi"><div className="v">{data.yearMedals.map((m) => m.emoji).join('')}</div><div className="l">medalhas conquistadas</div></div>}
          </div>

          {data.groups.map((g) => (
            <div key={g.label} className="card">
              <div className="row between">
                <h3 style={{ margin: 0 }}>{g.label}</h3>
                {g.rating > 0 && <Stars value={g.rating} />}
              </div>
              <div className="shelf-grid mt">
                {g.items.map((x) => (
                  <Link key={x.book.id} to={`/livro/${x.book.id}`} className="shelf-item">
                    <Cover book={x.book} />
                    <div className="t">{x.book.title}</div>
                    <div className="a ellipsis">{x.book.authors.join(', ')}</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
