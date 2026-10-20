import { describe, expect, it } from 'vitest';
import type { Book } from '../db';
import { isValidIsbn } from './bookLookup';
import { booksToCsv, parseCsv } from './csv';

describe('CSV', () => {
  it('lê o export do Goodreads', () => {
    const csv = [
      'Book Id,Title,Author,Additional Authors,ISBN,ISBN13,My Rating,Publisher,Number of Pages,Year Published,Date Read,Exclusive Shelf,Bookshelves,My Review',
      '1,Dune,Frank Herbert,,="0441013597",="9780441013593",5,Ace,658,2005,2023/05/14,read,"sci-fi, favorites",Incrível',
      '2,Circe,Madeline Miller,,"","",0,Little,393,2018,,to-read,,',
    ].join('\n');
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].book).toMatchObject({ title: 'Dune', authors: ['Frank Herbert'], isbn: '9780441013593', rating: 10, pageCount: 658, status: 'lido', review: 'Incrível' });
    expect(rows[0].finishedAt).toBe('2023-05-14');
    expect(rows[0].book.tags).toEqual(['sci-fi', 'favorites']);
    expect(rows[1].book.status).toBe('quero_ler');
  });

  it('lê planilha em português com datas dd/mm/aaaa e meia estrela', () => {
    const csv = 'Título;Autor;Páginas;Status;Nota;Conclusão\nTorto Arado;Itamar Vieira Junior;264;Lido;4,5;03/02/2024';
    const [r] = parseCsv(csv);
    expect(r.book).toMatchObject({ title: 'Torto Arado', authors: ['Itamar Vieira Junior'], pageCount: 264, status: 'lido', rating: 9 });
    expect(r.finishedAt).toBe('2024-02-03');
  });

  it('exporta e reimporta a própria estante', () => {
    const b: Book = {
      id: 'x', title: 'A, B "C"', authors: ['Um', 'Dois'], status: 'desisti', favorite: true, rating: 7, genres: ['Romance'], tags: ['clube'],
      pageCount: 200, readingLanguage: 'Inglês', format: 'ebook', createdAt: '', updatedAt: '',
    };
    const csv = booksToCsv([b], new Map([['x', { start: '2026-01-01' }]]));
    const [r] = parseCsv(csv);
    expect(r.book).toMatchObject({ title: 'A, B "C"', authors: ['Um', 'Dois'], status: 'desisti', favorite: true, rating: 7, genres: ['Romance'], tags: ['clube'], readingLanguage: 'Inglês', format: 'ebook' });
    expect(r.startedAt).toBe('2026-01-01');
  });

  it('avisa quando falta a coluna de título', () => {
    expect(() => parseCsv('foo,bar\n1,2')).toThrow(/título/);
  });

  it('valida ISBN', () => {
    expect(isValidIsbn('978-85-359-1484-9')).toBe(true);
    expect(isValidIsbn('9788535914840')).toBe(false);
    expect(isValidIsbn('0441013597')).toBe(true);
  });
});
