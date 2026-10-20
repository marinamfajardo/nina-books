import { languageFromCode } from '../domain/constants';

export interface FoundBook {
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  year?: number;
  isbn?: string;
  pageCount?: number;
  coverUrl?: string;
  originalLanguage?: string;
  synopsis?: string;
  source: 'Google Books' | 'Open Library';
}

export class LookupError extends Error {}

export const cleanIsbn = (s: string) => s.replace(/[^0-9Xx]/g, '').toUpperCase();
export const isValidIsbn = (s: string) => {
  const v = cleanIsbn(s);
  if (v.length === 13) {
    const sum = [...v].reduce((acc, c, i) => acc + Number(c) * (i % 2 ? 3 : 1), 0);
    return sum % 10 === 0;
  }
  if (v.length === 10) {
    const sum = [...v].reduce((acc, c, i) => acc + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
    return sum % 11 === 0;
  }
  return false;
};

async function getJson(url: string) {
  if (!navigator.onLine) throw new LookupError('Sem internet. Conecte-se para buscar o livro, ou cadastre manualmente.');
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new LookupError('Não foi possível conectar ao serviço de busca. Verifique sua internet.');
  }
  if (!res.ok) throw new LookupError(`O serviço de busca respondeu com erro (${res.status}).`);
  return res.json();
}

const https = (u?: string) => u?.replace(/^http:/, 'https:');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromGoogle(item: any): FoundBook {
  const v = item.volumeInfo ?? {};
  const ids: { type: string; identifier: string }[] = v.industryIdentifiers ?? [];
  const isbn = ids.find((i) => i.type === 'ISBN_13')?.identifier ?? ids.find((i) => i.type === 'ISBN_10')?.identifier;
  const img = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail;
  return {
    title: v.title ?? 'Sem título',
    subtitle: v.subtitle,
    authors: v.authors ?? [],
    publisher: v.publisher,
    year: v.publishedDate ? Number(String(v.publishedDate).slice(0, 4)) || undefined : undefined,
    isbn,
    pageCount: v.pageCount || undefined,
    // zoom=0 pede uma imagem maior que a miniatura
    coverUrl: https(img)?.replace('&edge=curl', '').replace('zoom=1', 'zoom=0'),
    originalLanguage: languageFromCode(v.language),
    synopsis: v.description,
    source: 'Google Books',
  };
}

async function googleSearch(q: string, max = 10): Promise<FoundBook[]> {
  const data = await getJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=${max}&printType=books`);
  return (data.items ?? []).map(fromGoogle);
}

async function openLibraryIsbn(isbn: string): Promise<FoundBook | null> {
  const data = await getJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
  const b = data[`ISBN:${isbn}`];
  if (!b) return null;
  let synopsis: string | undefined;
  try {
    const work = await getJson(`https://openlibrary.org/isbn/${isbn}.json`);
    const wk = work.works?.[0]?.key;
    if (wk) {
      const w = await getJson(`https://openlibrary.org${wk}.json`);
      synopsis = typeof w.description === 'string' ? w.description : w.description?.value;
    }
  } catch { /* sinopse é opcional */ }
  return {
    title: b.title,
    subtitle: b.subtitle,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authors: (b.authors ?? []).map((a: any) => a.name),
    publisher: b.publishers?.[0]?.name,
    year: b.publish_date ? Number(String(b.publish_date).match(/\d{4}/)?.[0]) || undefined : undefined,
    isbn,
    pageCount: b.number_of_pages,
    coverUrl: b.cover?.large ?? b.cover?.medium,
    synopsis,
    source: 'Open Library',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromOpenLibraryDoc(d: any): FoundBook {
  return {
    title: d.title,
    subtitle: d.subtitle,
    authors: d.author_name ?? [],
    publisher: d.publisher?.[0],
    year: d.first_publish_year,
    isbn: d.isbn?.find((i: string) => i.length === 13) ?? d.isbn?.[0],
    pageCount: d.number_of_pages_median,
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : undefined,
    originalLanguage: languageFromCode(d.language?.[0]),
    source: 'Open Library',
  };
}

/** Busca por ISBN: Google Books primeiro, Open Library como alternativa. */
export async function lookupIsbn(raw: string): Promise<FoundBook> {
  const isbn = cleanIsbn(raw);
  let google: FoundBook[] = [];
  try {
    google = await googleSearch(`isbn:${isbn}`, 1);
  } catch (e) {
    if (!navigator.onLine) throw e;
  }
  if (google[0]) {
    const g = { ...google[0], isbn: google[0].isbn ?? isbn };
    // completa capa/páginas que o Google às vezes não tem
    if (!g.coverUrl || !g.pageCount) {
      const ol = await openLibraryIsbn(isbn).catch(() => null);
      if (ol) {
        g.coverUrl ??= ol.coverUrl;
        g.pageCount ??= ol.pageCount;
      }
    }
    return g;
  }
  const ol = await openLibraryIsbn(isbn);
  if (ol) return ol;
  throw new LookupError('Livro não encontrado para esse ISBN. Tente buscar pelo título ou cadastre manualmente.');
}

/** Busca por título/autor nas duas fontes, sem repetir resultados. */
export async function searchBooks(query: string): Promise<FoundBook[]> {
  const q = query.trim();
  if (!q) return [];
  const [g, o] = await Promise.allSettled([
    googleSearch(q, 12),
    getJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8`).then((d) => (d.docs ?? []).map(fromOpenLibraryDoc)),
  ]);
  const results = [...(g.status === 'fulfilled' ? g.value : []), ...(o.status === 'fulfilled' ? o.value : [])];
  if (!results.length) {
    const err = g.status === 'rejected' ? g.reason : null;
    if (err instanceof LookupError && !navigator.onLine) throw err;
    if (g.status === 'rejected' && o.status === 'rejected') throw err;
  }
  const seen = new Set<string>();
  return results.filter((b) => {
    const key = b.isbn ?? `${b.title}|${b.authors[0]}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Tenta baixar a capa para guardar no aparelho (funciona offline depois). */
export async function downloadCover(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    // Open Library devolve uma imagem 1x1 quando não tem capa
    if (blob.size < 1000 || !blob.type.startsWith('image/')) return null;
    return blob;
  } catch {
    return null;
  }
}
