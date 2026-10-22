import type { Book, Format, Status } from '../db';
import type { BookMeta } from '../data/hooks';

export type GroupKey = 'genero' | 'idioma' | 'status' | 'autor' | 'ano' | 'tag' | 'formato' | 'serie';

export const GROUP_LABEL: Record<GroupKey, string> = {
  genero: 'Gênero', idioma: 'Idioma', status: 'Status', autor: 'Autor', ano: 'Ano de leitura', tag: 'Tag', formato: 'Formato', serie: 'Série / saga',
};

export interface Filters {
  status?: Status;
  favorite?: boolean;
  language?: string;
  minRating?: number; // 0-10
  format?: Format;
  year?: string;
  genre?: string;
  tag?: string;
  author?: string;
  series?: string;
}

export type SortKey = 'adicao' | 'titulo' | 'autor' | 'conclusao' | 'nota' | 'paginas';
export const SORT_LABEL: Record<SortKey, string> = {
  adicao: 'Data de adição', titulo: 'Título', autor: 'Autor', conclusao: 'Data de conclusão', nota: 'Nota', paginas: 'Nº de páginas',
};

export const groupValues = (b: Book, m: BookMeta | undefined, by: GroupKey): string[] => {
  switch (by) {
    case 'genero': return b.genres;
    case 'idioma': return b.readingLanguage ? [b.readingLanguage] : [];
    case 'status': return [b.status];
    case 'autor': return b.authors;
    case 'ano': return m?.years ?? [];
    case 'tag': return b.tags;
    case 'formato': return b.format ? [b.format] : [];
    case 'serie': return b.series ? [b.series] : [];
  }
};

/** Junta o filtro do grupo (ex.: gênero Fantasia) com os demais filtros. */
export const groupToFilter = (by: GroupKey, value: string): Filters => {
  switch (by) {
    case 'genero': return { genre: value };
    case 'idioma': return { language: value };
    case 'status': return { status: value as Status };
    case 'autor': return { author: value };
    case 'ano': return { year: value };
    case 'tag': return { tag: value };
    case 'formato': return { format: value as Format };
    case 'serie': return { series: value };
  }
};

export function applyFilters(books: Book[], meta: Map<string, BookMeta>, f: Filters) {
  return books.filter((b) => {
    if (f.status && b.status !== f.status) return false;
    if (f.favorite && !b.favorite) return false;
    if (f.language && b.readingLanguage !== f.language) return false;
    if (f.minRating && b.rating < f.minRating) return false;
    if (f.format && b.format !== f.format) return false;
    if (f.genre && !b.genres.includes(f.genre)) return false;
    if (f.tag && !b.tags.includes(f.tag)) return false;
    if (f.author && !b.authors.includes(f.author)) return false;
    if (f.series && b.series !== f.series) return false;
    if (f.year && !meta.get(b.id)?.years.includes(f.year)) return false;
    return true;
  });
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/** Livros da mesma série, em ordem de volume. */
export function seriesBooks(books: Book[], series?: string) {
  if (!series) return [];
  const key = normalize(series).trim();
  return books
    .filter((b) => b.series && normalize(b.series).trim() === key)
    .sort((a, b) => (a.seriesNumber ?? 999) - (b.seriesNumber ?? 999) || a.title.localeCompare(b.title, 'pt-BR'));
}

export function sortBooks(books: Book[], meta: Map<string, BookMeta>, key: SortKey, desc: boolean) {
  const dir = desc ? -1 : 1;
  const val = (b: Book): string | number => {
    switch (key) {
      case 'adicao': return b.createdAt;
      case 'titulo': return b.title;
      case 'autor': return b.authors[0] ?? '';
      case 'conclusao': return meta.get(b.id)?.finishedAt ?? '';
      case 'nota': return b.rating;
      case 'paginas': return b.pageCount ?? 0;
    }
  };
  return [...books].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y));
    return c * dir || collator.compare(a.title, b.title);
  });
}

export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const matches = (text: string | undefined, q: string) => !!text && normalize(text).includes(normalize(q));

export const countActive = (f: Filters) => Object.values(f).filter((v) => v !== undefined && v !== false && v !== 0).length;
