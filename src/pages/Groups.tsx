import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookBrowser } from '../components/BookBrowser';
import { PageTitle } from '../components/ui';
import { useLibrary } from '../data/hooks';
import { FORMAT_LABEL, STATUS_LABEL } from '../domain/constants';
import { GROUP_LABEL, groupToFilter, groupValues, type Filters, type GroupKey } from '../domain/filters';

const label = (by: GroupKey, v: string) =>
  by === 'status' ? STATUS_LABEL[v as keyof typeof STATUS_LABEL] : by === 'formato' ? FORMAT_LABEL[v as keyof typeof FORMAT_LABEL] : v;

const PLURAL: Record<GroupKey, string> = {
  genero: 'Gêneros', idioma: 'Idiomas', status: 'Status', autor: 'Autores', ano: 'Anos de leitura', tag: 'Tags', formato: 'Formatos',
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
      <BookBrowser base={base} hide={hide} />
    </div>
  );
}
