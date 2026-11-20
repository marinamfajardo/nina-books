/** Edições/idiomas do mesmo livro: livros com o mesmo `workId`. */
interface Ed { id: string; workId?: string; title: string; editionLanguage?: string; readingLanguage?: string }

/** Outros exemplares do mesmo livro (sem o próprio). */
export function otherEditions<B extends Ed>(book: B, books: B[]): B[] {
  if (!book.workId) return [];
  return books
    .filter((b) => b.id !== book.id && b.workId === book.workId)
    .sort((a, b) => (a.editionLanguage ?? '').localeCompare(b.editionLanguage ?? '', 'pt-BR') || a.title.localeCompare(b.title, 'pt-BR'));
}

/** Id do grupo ao ligar um livro a `target`: usa o grupo dele, ou cria um com o id dele. */
export const workIdFor = (target: Ed) => target.workId ?? target.id;

/** Idioma mostrado para um exemplar. */
export const editionLabel = (b: Ed) => b.editionLanguage ?? b.readingLanguage;
