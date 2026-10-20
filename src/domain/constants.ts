import type { Format, Ownership, Status } from '../db';

export const STATUS_LABEL: Record<Status, string> = {
  quero_ler: 'Quero ler',
  lendo: 'Lendo',
  lido: 'Lido',
  relendo: 'Relendo',
  desisti: 'Desisti',
};
export const STATUSES = Object.keys(STATUS_LABEL) as Status[];

export const FORMAT_LABEL: Record<Format, string> = {
  fisico: 'Físico',
  ebook: 'E-book',
  audio: 'Audiolivro',
};

export const OWNERSHIP_LABEL: Record<Ownership, string> = {
  proprio: 'Próprio',
  emprestado: 'Emprestado',
  biblioteca: 'Biblioteca',
};

export const DEFAULT_GENRES = [
  'Romance', 'Fantasia', 'Ficção científica', 'Suspense', 'Policial', 'Terror',
  'Biografia', 'Autoajuda', 'Poesia', 'Clássicos', 'Não ficção', 'Histórico',
  'Infantojuvenil', 'HQ/Mangá', 'Contos', 'Drama', 'Distopia', 'Young adult',
  'Filosofia', 'Psicologia', 'Negócios', 'Religião', 'Humor', 'Aventura',
];

export const DEFAULT_LANGUAGES = [
  'Português', 'Inglês', 'Espanhol', 'Francês', 'Italiano', 'Alemão',
  'Japonês', 'Coreano', 'Chinês', 'Russo',
];

const LANG_CODES: Record<string, string> = {
  pt: 'Português', en: 'Inglês', es: 'Espanhol', fr: 'Francês', it: 'Italiano',
  de: 'Alemão', ja: 'Japonês', ko: 'Coreano', zh: 'Chinês', ru: 'Russo',
  por: 'Português', eng: 'Inglês', spa: 'Espanhol', fre: 'Francês', fra: 'Francês',
  ita: 'Italiano', ger: 'Alemão', deu: 'Alemão', jpn: 'Japonês',
};
export const languageFromCode = (code?: string) =>
  code ? LANG_CODES[code.toLowerCase().slice(0, 3)] ?? LANG_CODES[code.toLowerCase().slice(0, 2)] ?? code : undefined;

export const DEFAULT_WORDS_PER_PAGE = 250;
