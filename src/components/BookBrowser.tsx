import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Book, Format, Status } from '../db';
import { useLibrary, useList, type BookMeta } from '../data/hooks';
import { FORMAT_LABEL, STATUS_LABEL, STATUSES } from '../domain/constants';
import { applyFilters, countActive, SORT_LABEL, sortBooks, type Filters, type SortKey } from '../domain/filters';
import { ChipSelect, Cover, Icon, Modal, Stars } from './ui';

const VIEW_KEY = 'nina.view';
const SORT_KEY = 'nina.sort';

const loadPref = <T,>(key: string, fallback: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback;
  } catch {
    return fallback;
  }
};

export function BookGrid({ books, meta }: { books: Book[]; meta: Map<string, BookMeta> }) {
  return (
    <div className="shelf-grid">
      {books.map((b) => (
        <Link key={b.id} to={`/livro/${b.id}`} className="shelf-item">
          <Cover book={b} pct={meta.get(b.id)?.pct} />
          <div className="t">{b.title}</div>
          <div className="a ellipsis">{b.authors.join(', ')}</div>
        </Link>
      ))}
    </div>
  );
}

export function BookList({ books, meta }: { books: Book[]; meta: Map<string, BookMeta> }) {
  return (
    <div>
      {books.map((b) => {
        const m = meta.get(b.id);
        return (
          <Link key={b.id} to={`/livro/${b.id}`} className="list-item">
            <Cover book={b} showFav={false} />
            <div className="grow">
              <div style={{ fontWeight: 700 }}>{b.favorite && <span style={{ color: 'var(--accent)' }}>♥ </span>}{b.title}</div>
              <div className="small muted ellipsis">{b.authors.join(', ')}{b.pageCount ? ` · ${b.pageCount} p.` : ''}</div>
              <div className="row" style={{ gap: 6, marginTop: 4 }}>
                <span className="badge">{STATUS_LABEL[b.status]}</span>
                {b.rating > 0 && <Stars value={b.rating} />}
                {m && m.pct > 0 && m.pct < 100 && <span className="small muted">{m.pct}%</span>}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/** Estante com filtros combináveis, ordenação e alternância grade/lista. */
export function BookBrowser({ base = {}, hide = [] }: { base?: Filters; hide?: (keyof Filters)[] }) {
  const lib = useLibrary();
  const languages = useList('language');
  const [view, setView] = useState<'grade' | 'lista'>(() => loadPref(VIEW_KEY, 'grade'));
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>(() => loadPref(SORT_KEY, { key: 'adicao', desc: true }));
  const [filters, setFilters] = useState<Filters>({});
  const [open, setOpen] = useState(false);

  const years = useMemo(() => [...new Set([...lib.meta.values()].flatMap((m) => m.years))].sort().reverse(), [lib.meta]);
  const shown = useMemo(
    () => sortBooks(applyFilters(lib.books, lib.meta, { ...filters, ...base }), lib.meta, sort.key, sort.desc),
    [lib.books, lib.meta, filters, base, sort],
  );

  const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const active = countActive(filters);

  return (
    <div>
      <div className="row between" style={{ marginBottom: 10 }}>
        <ChipSelect
          scroll
          options={STATUSES.filter(() => !hide.includes('status'))}
          labels={STATUS_LABEL}
          value={filters.status}
          onChange={(status) => set({ status })}
        />
      </div>
      <div className="row between nowrap" style={{ marginBottom: 12 }}>
        <span className="small muted">{shown.length} {shown.length === 1 ? 'livro' : 'livros'}</span>
        <div className="row nowrap" style={{ gap: 4 }}>
          <button className="secondary small" onClick={() => setOpen(true)}>Filtros{active ? ` (${active})` : ''}</button>
          <button
            className="icon"
            aria-label={view === 'grade' ? 'Ver em lista' : 'Ver em grade'}
            onClick={() => { const v = view === 'grade' ? 'lista' : 'grade'; setView(v); save(VIEW_KEY, v); }}
          >
            {view === 'grade' ? Icon.list() : Icon.grid()}
          </button>
        </div>
      </div>

      {lib.loaded && shown.length === 0 && (
        <div className="empty">
          <div className="big">📚</div>
          {lib.books.length === 0 ? (
            <>
              <p>Sua estante está vazia.</p>
              <Link className="btn" to="/adicionar">Adicionar o primeiro livro</Link>
            </>
          ) : <p>Nenhum livro com esses filtros.</p>}
        </div>
      )}
      {view === 'grade' ? <BookGrid books={shown} meta={lib.meta} /> : <BookList books={shown} meta={lib.meta} />}

      {open && (
        <Modal title="Filtros e ordem" onClose={() => setOpen(false)}>
          <div className="stack">
            <label className="row"><input type="checkbox" checked={!!filters.favorite} onChange={(e) => set({ favorite: e.target.checked || undefined })} /> Só favoritos ♥</label>
            {!hide.includes('language') && (
              <label className="field"><span>Idioma de leitura</span>
                <select value={filters.language ?? ''} onChange={(e) => set({ language: e.target.value || undefined })}>
                  <option value="">Todos</option>
                  {languages.map((l) => <option key={l}>{l}</option>)}
                </select>
              </label>
            )}
            <label className="field"><span>Nota mínima</span>
              <select value={filters.minRating ?? 0} onChange={(e) => set({ minRating: Number(e.target.value) || undefined })}>
                <option value={0}>Qualquer</option>
                {[2, 4, 6, 8, 9, 10].map((r) => <option key={r} value={r}>{r / 2}★ ou mais</option>)}
              </select>
            </label>
            {!hide.includes('format') && (
              <label className="field"><span>Formato</span>
                <select value={filters.format ?? ''} onChange={(e) => set({ format: (e.target.value || undefined) as Format | undefined })}>
                  <option value="">Todos</option>
                  {(Object.keys(FORMAT_LABEL) as Format[]).map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
                </select>
              </label>
            )}
            {!hide.includes('year') && (
              <label className="field"><span>Ano de leitura</span>
                <select value={filters.year ?? ''} onChange={(e) => set({ year: e.target.value || undefined })}>
                  <option value="">Todos</option>
                  {years.map((y) => <option key={y}>{y}</option>)}
                </select>
              </label>
            )}
            {!hide.includes('status') && (
              <label className="field"><span>Status</span>
                <select value={filters.status ?? ''} onChange={(e) => set({ status: (e.target.value || undefined) as Status | undefined })}>
                  <option value="">Todos</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </label>
            )}
            <div className="grid2">
              <label className="field"><span>Ordenar por</span>
                <select value={sort.key} onChange={(e) => { const s = { ...sort, key: e.target.value as SortKey }; setSort(s); save(SORT_KEY, s); }}>
                  {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
                </select>
              </label>
              <label className="field"><span>Ordem</span>
                <select value={sort.desc ? 'desc' : 'asc'} onChange={(e) => { const s = { ...sort, desc: e.target.value === 'desc' }; setSort(s); save(SORT_KEY, s); }}>
                  <option value="asc">Crescente (A→Z, menor→maior)</option>
                  <option value="desc">Decrescente (Z→A, mais recente)</option>
                </select>
              </label>
            </div>
            <div className="row">
              <button className="secondary grow" onClick={() => setFilters({})}>Limpar filtros</button>
              <button className="grow" onClick={() => setOpen(false)}>Ver {shown.length} livros</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
