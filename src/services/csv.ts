import Papa from 'papaparse';
import type { Book, Status } from '../db';
import { FORMAT_LABEL, STATUS_LABEL } from '../domain/constants';
import { cleanIsbn } from './bookLookup';

const COLUMNS = [
  'Título', 'Subtítulo', 'Autores', 'Editora', 'Ano', 'ISBN', 'Páginas', 'Status', 'Favorito', 'Nota',
  'Gêneros', 'Tags', 'Idioma de leitura', 'Idioma original', 'Formato', 'Início', 'Conclusão', 'Resenha',
];

export interface CsvBookRow {
  book: Partial<Book> & { title: string; authors: string[] };
  startedAt?: string;
  finishedAt?: string;
}

export function booksToCsv(books: Book[], dates: Map<string, { start?: string; end?: string }>) {
  const rows = books.map((b) => [
    b.title, b.subtitle ?? '', b.authors.join('; '), b.publisher ?? '', b.year ?? '', b.isbn ?? '',
    b.pageCount ?? '', STATUS_LABEL[b.status], b.favorite ? 'Sim' : 'Não', b.rating / 2,
    b.genres.join('; '), b.tags.join('; '), b.readingLanguage ?? '', b.originalLanguage ?? '',
    b.format ? FORMAT_LABEL[b.format] : '', dates.get(b.id)?.start ?? '', dates.get(b.id)?.end ?? '', b.review ?? '',
  ]);
  // BOM para o Excel abrir os acentos corretamente
  return '﻿' + Papa.unparse({ fields: COLUMNS, data: rows });
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Nomes de coluna aceitos (nosso CSV, Goodreads e planilhas do Skoob). */
const ALIASES: Record<string, string[]> = {
  title: ['titulo', 'title', 'nome', 'livro'],
  subtitle: ['subtitulo', 'subtitle'],
  authors: ['autores', 'autor', 'author', 'authors', 'autora'],
  extraAuthors: ['additionalauthors'],
  publisher: ['editora', 'publisher'],
  year: ['ano', 'year', 'yearpublished', 'anopublicacao', 'originalpublicationyear'],
  isbn13: ['isbn13'],
  isbn: ['isbn', 'isbn10'],
  pages: ['paginas', 'numberofpages', 'pages', 'numpaginas', 'numerodepaginas'],
  status: ['status', 'exclusiveshelf', 'estante', 'situacao'],
  favorite: ['favorito', 'favorite'],
  rating: ['nota', 'myrating', 'rating', 'avaliacao'],
  genres: ['generos', 'genero', 'genre', 'genres'],
  tags: ['tags', 'bookshelves'],
  readingLanguage: ['idiomadeleitura', 'idioma'],
  originalLanguage: ['idiomaoriginal'],
  format: ['formato', 'binding', 'format'],
  start: ['inicio', 'datadeinicio', 'datestarted'],
  end: ['conclusao', 'datadeconclusao', 'dateread', 'lido em', 'lidoem'],
  review: ['resenha', 'myreview', 'review'],
};

const STATUS_WORDS: [RegExp, Status][] = [
  [/^(read|lido|lidos|concluido)$/, 'lido'],
  [/^(currentlyreading|lendo|reading)$/, 'lendo'],
  [/^(toread|queroler|wanttoread)$/, 'quero_ler'],
  [/^(relendo|rereading)$/, 'relendo'],
  [/^(desisti|abandonado|abandonei|dnf|didnotfinish)$/, 'desisti'],
];

const toDateKey = (s?: string) => {
  if (!s) return undefined;
  const t = s.trim();
  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // dd/mm/aaaa
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return undefined;
};

const list = (s?: string) => (s ? s.split(/[;,]/).map((x) => x.trim()).filter(Boolean) : []);

export function parseCsv(text: string): CsvBookRow[] {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: true });
  const headers = parsed.meta.fields ?? [];
  const col: Record<string, string | undefined> = {};
  for (const [key, names] of Object.entries(ALIASES)) col[key] = headers.find((h) => names.includes(norm(h)));
  if (!col.title) throw new Error('Não encontrei a coluna de título no CSV (ex.: "Título" ou "Title").');

  const get = (r: Record<string, string>, key: string) => (col[key] ? r[col[key]!]?.trim() : undefined) || undefined;

  return parsed.data
    .filter((r) => get(r, 'title'))
    .map((r) => {
      const statusRaw = norm(get(r, 'status') ?? '');
      let status: Status = STATUS_WORDS.find(([re]) => re.test(statusRaw))?.[1] ?? 'quero_ler';
      const end = toDateKey(get(r, 'end'));
      if (end && status === 'quero_ler') status = 'lido';
      const ratingRaw = Number((get(r, 'rating') ?? '0').replace(',', '.'));
      const formatRaw = norm(get(r, 'format') ?? '');
      const isbn = cleanIsbn(get(r, 'isbn13') ?? get(r, 'isbn') ?? '');
      const pages = Number(get(r, 'pages'));
      const year = Number(get(r, 'year'));
      const tags = list(get(r, 'tags')).filter((t) => !['read', 'to-read', 'currently-reading'].includes(t));
      return {
        book: {
          title: get(r, 'title')!,
          subtitle: get(r, 'subtitle'),
          authors: [...list(get(r, 'authors')), ...list(get(r, 'extraAuthors'))],
          publisher: get(r, 'publisher'),
          year: year > 0 ? year : undefined,
          isbn: isbn || undefined,
          pageCount: pages > 0 ? pages : undefined,
          status,
          favorite: /^(sim|yes|true|1|x)$/i.test(get(r, 'favorite') ?? ''),
          rating: Math.max(0, Math.min(10, Math.round(ratingRaw * 2))),
          genres: list(get(r, 'genres')),
          tags,
          readingLanguage: get(r, 'readingLanguage'),
          originalLanguage: get(r, 'originalLanguage'),
          format: /ebook|kindle|digital/.test(formatRaw) ? 'ebook' : /audio/.test(formatRaw) ? 'audio' : formatRaw ? 'fisico' : undefined,
          review: get(r, 'review'),
        },
        startedAt: toDateKey(get(r, 'start')),
        finishedAt: end,
      };
    });
}
