import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageTitle, Progress } from '../components/ui';
import { db } from '../db';
import { useLibrary } from '../data/hooks';
import { FORMAT_LABEL, STATUS_LABEL } from '../domain/constants';
import {
  averagePagesPerDay, countBy, filterByRange, finishedByPeriod, formatDuration, formatNumber, goalProgress, pagesPerHour,
  ratingDistribution, streaks, today, totals, totalsByGroup, totalsByPeriod, type GroupBy, type Period,
} from '../domain/stats';

const PALETTE = ['#6d1a36', '#b3263e', '#d98897', '#8e2443', '#e8a3b1', '#4a0e23', '#c7354f', '#f2c4ce', '#a0455c', '#7d2a3f'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' };

const fmtKey = (key: string, period: Period) => {
  if (period === 'mes') return `${MONTHS[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`;
  if (period === 'semana') return key.slice(5);
  if (period === 'dia') return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
  return key;
};

const groupLabel = (by: GroupBy, key: string) =>
  by === 'status' ? STATUS_LABEL[key as keyof typeof STATUS_LABEL] ?? key : by === 'formato' ? FORMAT_LABEL[key as keyof typeof FORMAT_LABEL] ?? key : key;

export default function Stats() {
  const lib = useLibrary();
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => {
    const ys = new Set<number>([thisYear]);
    for (const s of lib.sessions) ys.add(Number(s.date.slice(0, 4)));
    return [...ys].sort((a, b) => b - a);
  }, [lib.sessions, thisYear]);
  const [year, setYear] = useState<number | 'todos'>(thisYear);
  const [period, setPeriod] = useState<Period>('mes');
  const [by, setBy] = useState<GroupBy>('genero');
  const [metric, setMetric] = useState<'pages' | 'words'>('pages');

  const from = year === 'todos' ? undefined : `${year}-01-01`;
  const to = year === 'todos' ? undefined : `${year}-12-31`;
  const sessions = useMemo(() => filterByRange(lib.sessions, from, to), [lib.sessions, from, to]);
  const readings = useMemo(() => lib.readings.filter((r) => !from || (r.finishedAt && r.finishedAt >= from && r.finishedAt <= to!)), [lib.readings, from, to]);

  const t = totals(sessions, lib.bookMap);
  const st = streaks(lib.sessions);
  const finished = readings.filter((r) => r.outcome === 'concluida').length;
  const firstDate = sessions.reduce((m, s) => (s.date < m ? s.date : m), today());
  const avgFrom = from ?? firstDate;
  const avgTo = to && to < today() ? to : today();
  const avg = averagePagesPerDay(sessions, avgFrom, avgTo);
  const pph = pagesPerHour(sessions);

  const byPeriod = totalsByPeriod(sessions, lib.bookMap, period).map((x) => ({ ...x, label: fmtKey(x.key, period) }));
  const finishedPeriod = finishedByPeriod(readings, year === 'todos' ? 'ano' : 'mes').map((x) => ({ ...x, label: fmtKey(x.key, year === 'todos' ? 'ano' : 'mes') }));
  const byGroup = totalsByGroup(sessions, lib.bookMap, by).slice(0, 10).map((x) => ({ ...x, label: groupLabel(by, x.key) }));
  const readBooks = lib.books.filter((b) => b.status === 'lido' || b.status === 'relendo');
  const ratings = ratingDistribution(lib.books).map((x) => ({ ...x, label: `${x.rating}★` }));
  const topGenres = countBy(readBooks, 'genero').slice(0, 8);
  const topLangs = countBy(readBooks, 'idioma').slice(0, 8);

  const goalYear = year === 'todos' ? thisYear : year;
  const goal = goals.find((g) => g.year === goalYear);
  const gp = goalProgress(goalYear, lib.readings, lib.sessions, goal);

  if (lib.loaded && !lib.sessions.length && !lib.books.length) {
    return (
      <div>
        <PageTitle>Estatísticas</PageTitle>
        <div className="empty"><div className="big">📊</div>Adicione livros e registre suas leituras para ver as estatísticas.</div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle right={
        <select value={year} onChange={(e) => setYear(e.target.value === 'todos' ? 'todos' : Number(e.target.value))} style={{ width: 'auto' }}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
          <option value="todos">Todos os anos</option>
        </select>
      }>Estatísticas</PageTitle>

      <div className="card">
        <div className="row between"><h3 style={{ margin: 0 }}>Desafio {goalYear}</h3><Link to="/metas" className="small">{goal ? 'Editar meta' : 'Definir meta'}</Link></div>
        {goal?.books ? (
          <div className="mt">
            <div className="row between small"><span>📚 {gp.booksDone} de {goal.books} livros</span><b>{gp.booksPct}%</b></div>
            <Progress pct={gp.booksPct} />
            <p className="small muted" style={{ marginTop: 4 }}>{gp.booksDone >= gp.booksExpected ? 'Você está no ritmo ✨' : `Para estar no ritmo: ${gp.booksExpected} livros até hoje.`}</p>
          </div>
        ) : null}
        {goal?.pages ? (
          <div className="mt">
            <div className="row between small"><span>📄 {formatNumber(gp.pagesDone)} de {formatNumber(goal.pages)} páginas</span><b>{gp.pagesPct}%</b></div>
            <Progress pct={gp.pagesPct} />
          </div>
        ) : null}
        {!goal && <p className="small muted mt">Defina uma meta anual de livros e/ou páginas, como no desafio do Skoob.</p>}
      </div>

      <div className="kpis">
        <div className="kpi"><div className="v">{formatNumber(t.pages)}</div><div className="l">páginas lidas</div></div>
        <div className="kpi"><div className="v">{formatNumber(t.words)}</div><div className="l">palavras lidas</div></div>
        <div className="kpi"><div className="v">{finished}</div><div className="l">livros concluídos</div></div>
        <div className="kpi"><div className="v">{avg.toFixed(1).replace('.', ',')}</div><div className="l">páginas por dia (média do período)</div></div>
        <div className="kpi"><div className="v">{st.current} 🔥</div><div className="l">dias seguidos (recorde {st.best})</div></div>
        <div className="kpi"><div className="v">{pph ? Math.round(pph) : '—'}</div><div className="l">páginas por hora (ritmo)</div></div>
        <div className="kpi"><div className="v">{t.seconds ? formatDuration(t.seconds) : '—'}</div><div className="l">tempo cronometrado</div></div>
        <div className="kpi"><div className="v">{t.sessions}</div><div className="l">sessões de leitura</div></div>
      </div>

      <div className="card">
        <div className="row between">
          <h3 style={{ margin: 0 }}>{metric === 'pages' ? 'Páginas' : 'Palavras'} por período</h3>
          <select value={metric} onChange={(e) => setMetric(e.target.value as 'pages' | 'words')} style={{ width: 'auto' }}>
            <option value="pages">Páginas</option><option value="words">Palavras</option>
          </select>
        </div>
        <div className="chips mt" style={{ marginBottom: 8 }}>
          {(['ano', 'mes', 'semana', 'dia'] as Period[]).map((p) => (
            <button key={p} className={`chip${period === p ? ' on' : ''}`} onClick={() => setPeriod(p)}>{{ ano: 'Ano', mes: 'Mês', semana: 'Semana', dia: 'Dia' }[p]}</button>
          ))}
        </div>
        {byPeriod.length ? (
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={period === 'dia' ? byPeriod.slice(-31) : period === 'semana' ? byPeriod.slice(-26) : byPeriod}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatNumber(Number(v)), metric === 'pages' ? 'páginas' : 'palavras']} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey={metric} fill="#b3263e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="small muted">Sem sessões neste período.</p>}
      </div>

      <div className="card">
        <div className="row between">
          <h3 style={{ margin: 0 }}>{metric === 'pages' ? 'Páginas' : 'Palavras'} por grupo</h3>
          <select value={by} onChange={(e) => setBy(e.target.value as GroupBy)} style={{ width: 'auto' }}>
            <option value="genero">Gênero</option><option value="idioma">Idioma</option><option value="autor">Autor</option>
            <option value="status">Status</option><option value="formato">Formato</option>
          </select>
        </div>
        {byGroup.length ? (
          <div style={{ width: '100%', height: Math.max(160, byGroup.length * 34) }}>
            <ResponsiveContainer>
              <BarChart data={byGroup} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={110} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatNumber(Number(v)), metric === 'pages' ? 'páginas' : 'palavras']} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey={metric} radius={[0, 6, 6, 0]}>
                  {byGroup.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="small muted">Sem dados.</p>}
        {by === 'genero' && <p className="small muted">Livros com mais de um gênero contam em cada um deles.</p>}
      </div>

      <div className="card">
        <h3>Livros concluídos por {year === 'todos' ? 'ano' : 'mês'}</h3>
        {finishedPeriod.length ? (
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={finishedPeriod}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'livros']} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="count" fill="#6d1a36" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="small muted">Nenhum livro concluído neste período.</p>}
      </div>

      <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="card">
          <h3>Distribuição de notas</h3>
          <div className="chart" style={{ height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={ratings}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} fontSize={10} />
                <YAxis allowDecimals={false} hide />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'livros']} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="count" fill="#c7354f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {[['Gêneros mais lidos', topGenres], ['Idiomas mais lidos', topLangs]].map(([title, data]) => (
          <div className="card" key={title as string}>
            <h3>{title as string}</h3>
            {(data as { key: string; count: number }[]).length ? (
              <div className="row nowrap">
                <div style={{ width: 150, height: 150, flex: 'none' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={data as { key: string; count: number }[]} dataKey="count" nameKey="key" innerRadius={38} outerRadius={70} paddingAngle={2} stroke="none">
                        {(data as unknown[]).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="small grow">
                  {(data as { key: string; count: number }[]).map((d, i) => (
                    <div key={d.key} className="row nowrap" style={{ gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: PALETTE[i % PALETTE.length], flex: 'none' }} />
                      <span className="grow ellipsis">{d.key}</span><b>{d.count}</b>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="small muted">Marque livros como lidos para ver.</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
