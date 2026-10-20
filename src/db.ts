import Dexie, { type EntityTable } from 'dexie';

export type Status = 'quero_ler' | 'lendo' | 'lido' | 'relendo' | 'desisti';
export type Format = 'fisico' | 'ebook' | 'audio';
export type Ownership = 'proprio' | 'emprestado' | 'biblioteca';
export type ListKind = 'genre' | 'language' | 'tag';

export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  year?: number;
  isbn?: string;
  pageCount?: number;
  /** Capa salva no aparelho (id na tabela media) */
  coverId?: string;
  /** Capa remota, usada quando não foi possível baixar a imagem */
  coverUrl?: string;
  originalLanguage?: string;
  synopsis?: string;
  status: Status;
  favorite: boolean;
  /** 0 a 10 (meias estrelas) */
  rating: number;
  genres: string[];
  tags: string[];
  readingLanguage?: string;
  format?: Format;
  ownership?: Ownership;
  wordsPerPage?: number;
  totalWords?: number;
  /** Prioridade na lista "Quero ler": 1 alta, 2 média, 3 baixa */
  wantPriority?: number;
  review?: string;
  summaryManual?: string;
  summaryAI?: string;
  summaryAISources?: { title: string; url: string }[];
  summaryAIDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reading {
  id: string;
  bookId: string;
  number: number;
  startedAt: string; // AAAA-MM-DD
  finishedAt?: string;
  outcome: 'andamento' | 'concluida' | 'abandonada';
}

export interface Session {
  id: string;
  bookId: string;
  readingId: string;
  date: string; // AAAA-MM-DD
  startPage: number;
  endPage: number;
  durationSec?: number;
  /** Sessão criada automaticamente ao marcar como Lido */
  auto?: boolean;
  createdAt: string;
}

export interface Note {
  id: string;
  bookId: string;
  kind: 'texto' | 'audio' | 'video';
  title?: string;
  text?: string;
  mediaId?: string;
  page?: number;
  createdAt: string;
}

export interface Quote {
  id: string;
  bookId: string;
  text: string;
  page?: number;
  comment?: string;
  photoId?: string;
  createdAt: string;
}

export interface PagePhoto {
  id: string;
  bookId: string;
  mediaId: string;
  ocrText?: string;
  page?: number;
  caption?: string;
  createdAt: string;
}

export interface GlossaryEntry {
  id: string;
  word: string;
  language?: string;
  meaning?: string;
  meaningByAI?: boolean;
  example?: string;
  page?: number;
  bookId?: string;
  box: number;
  nextReview: string; // AAAA-MM-DD
  createdAt: string;
}

export interface Goal {
  year: number;
  books?: number;
  pages?: number;
}

export interface Loan {
  id: string;
  bookId: string;
  person: string;
  date: string;
  dueDate?: string;
  returnedAt?: string;
  notes?: string;
}

export interface WishItem {
  id: string;
  title: string;
  author?: string;
  isbn?: string;
  coverUrl?: string;
  priority: number;
  price?: string;
  store?: string;
  notes?: string;
  createdAt: string;
}

export interface Media {
  id: string;
  blob: Blob;
  type: string;
  name?: string;
  createdAt: string;
}

export interface ListItem {
  id: string;
  kind: ListKind;
  name: string;
}

export class NinaDB extends Dexie {
  books!: EntityTable<Book, 'id'>;
  readings!: EntityTable<Reading, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  notes!: EntityTable<Note, 'id'>;
  quotes!: EntityTable<Quote, 'id'>;
  photos!: EntityTable<PagePhoto, 'id'>;
  glossary!: EntityTable<GlossaryEntry, 'id'>;
  goals!: EntityTable<Goal, 'year'>;
  loans!: EntityTable<Loan, 'id'>;
  wishlist!: EntityTable<WishItem, 'id'>;
  media!: EntityTable<Media, 'id'>;
  lists!: EntityTable<ListItem, 'id'>;

  constructor(name = 'nina-books') {
    super(name);
    // Migrações versionadas: ao mudar o esquema, crie uma nova .version(n)
    // com o esquema completo e, se precisar, um .upgrade() para converter dados.
    this.version(1).stores({
      books: 'id, title, isbn, status, favorite, rating, createdAt, *authors, *genres, *tags, readingLanguage, format',
      readings: 'id, bookId, startedAt, finishedAt',
      sessions: 'id, bookId, readingId, date',
      notes: 'id, bookId, createdAt',
      quotes: 'id, bookId, createdAt',
      photos: 'id, bookId, createdAt',
      glossary: 'id, word, language, bookId, nextReview',
      goals: 'year',
      loans: 'id, bookId, returnedAt',
      wishlist: 'id, priority, createdAt',
      media: 'id',
      lists: 'id, kind, name, [kind+name]',
    });
  }
}

export const db = new NinaDB();

export const TABLES = [
  'books', 'readings', 'sessions', 'notes', 'quotes', 'photos',
  'glossary', 'goals', 'loans', 'wishlist', 'lists',
] as const;

export const uid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
