import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookBrowser } from '../components/BookBrowser';
import { PageTitle } from '../components/ui';
import { useLibrary } from '../data/hooks';
import { FORMAT_LABEL, STATUS_LABEL } from '../domain/constants';
import { Cover, Stars } from '../components/ui';
import { GROUP_LABEL, groupToFilter, groupValues, seriesBooks, type Filters, type GroupKey } from '../domain/filters';

const label = (by: GroupKey, v: string) =>
  by === 'status' ? STATUS_LABEL[v as keyof typeof STATUS_LABEL] : by === 'formato' ? FORMAT_LABEL[v as keyof typeof FORMAT_LABEL] : v;

const PLURAL: Record<GroupKey, string> = {
  genero: 'Gêneros', idioma: 'Idiomas', status: 'Status', autor: 'Autores', ano: 'Anos de leitura', tag: 'Tags', formato: 'Formatos', serie: 'Séries e sagas',
};

export function GroupList() {
  const by = useParams().by as GroupKey;
  const lib = useLibrary();
  const groups = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of lib.books) for (const v of groupValues(b, lib.meta.get(b.id), by)) map.set(v, (map.get(v) ?? 0) + 1);
    const arr = [...map.entries()];
    return by === 'ano' ? arr.sort((a, b) => b[0].localeCompare(a[0])) : arr.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  }, [lib, by]);

  return (
    <div>
      <PageTitle back>{PLURAL[by]}</PageTitle>
      {lib.loaded && !groups.length && <div className="empty">Nenhum livro classificado por {GROUP_LABEL[by].toLowerCase()} ainda.</div>}
      <div className="group-grid">
        {groups.map(([v, n]) => (
          <Link key={v} to={`/grupo/${by}/${encodeURIComponent(v)}`} className="group-tile">
            <b>{label(by, v)}</b>
            <span className="badge">{n}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function GroupBooks() {
  const params = useParams();
  const by = params.by as GroupKey;
  const value = decodeURIComponent(params.value ?? '');
  const base = useMemo(() => groupToFilter(by, value), [by, value]);
  const hide: (keyof Filters)[] = by === 'status' ? ['status'] : by === 'idioma' ? ['language'] : by === 'ano' ? ['year'] : by === 'formato' ? ['format'] : [];
  return (
    <div>
      <PageTitle back>{label(by, value)}</PageTitle>
      <p className="small muted" style={{ marginTop: -8 }}>{GROUP_LABEL[by]}</p>
      {by === 'serie' ? <SeriesGrid name={value} /> : <BookBrowser base={base} hide={hide} />}
    </div>
  );
}

/** Livros de uma saga, na ordem dos volumes. */
function SeriesGrid({ name }: { name: string }) {
  const lib = useLibrary();
  const list = seriesBooks(lib.books, name);
  const read = list.filter((b) => b.status === 'lido' || b.status === 'relendo').length;
  return (
    <div>
      <p className="small">{read} de {list.length} lido(s){list.length ? ` · ${Math.round((read / list.length) * 100)}% da saga` : ''}</p>
      <div className="shelf-grid">
        {list.map((b) => (
          <Link key={b.id} to={`/livro/${b.id}`} className="shelf-item">
            <Cover book={b} pct={lib.meta.get(b.id)?.pct} />
            <div className="t">{b.seriesNumber ? `${b.seriesNumber}. ` : ''}{b.title}</div>
            {b.rating > 0 ? <Stars value={b.rating} /> : <div className="a">{STATUS_LABEL[b.status]}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
