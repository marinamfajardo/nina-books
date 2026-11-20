import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, type Book } from '../db';
import { matches } from '../domain/filters';
import { Cover, Modal } from './ui';

/** Lista todos os livros cadastrados para escolher "o mesmo livro" em outra edição/idioma. */
export function EditionPicker({ excludeId, onPick, onClose }: { excludeId?: string; onPick: (b: Book) => void; onClose: () => void }) {
  const books = useLiveQuery(() => db.books.toArray(), []) ?? [];
  const [q, setQ] = useState('');
  const list = books
    .filter((b) => b.id !== excludeId && (!q || matches(b.title, q) || b.authors.some((a) => matches(a, q)) || matches(b.series, q)))
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  return (
    <Modal title="Qual livro você já tem?" onClose={onClose}>
      <input type="search" autoFocus placeholder="Buscar título, autor/grupo ou saga" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
      {!list.length && <p className="small muted">Nenhum livro encontrado.</p>}
      {list.map((b) => (
        <button key={b.id} type="button" className="list-item" onClick={() => onPick(b)}
          style={{ background: 'none', color: 'inherit', borderRadius: 0, width: '100%', textAlign: 'left', fontWeight: 400, justifyContent: 'flex-start' }}>
          <div style={{ width: 44, flex: 'none' }}><Cover book={b} /></div>
          <div className="grow">
            <b>{b.title}</b>
            <div className="small muted">{b.authors.join(', ')}{b.editionLanguage || b.readingLanguage ? ` · ${b.editionLanguage ?? b.readingLanguage}` : ''}</div>
          </div>
        </button>
      ))}
    </Modal>
  );
}
