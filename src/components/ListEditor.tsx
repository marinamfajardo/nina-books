import { useState } from 'react';
import type { ListKind } from '../db';
import { ensureListItems, renameListItem } from '../data/actions';
import { useList } from '../data/hooks';
import { Modal } from './ui';

/** Editar a lista de gêneros, tags, idiomas ou locais: adicionar, renomear e apagar. */
export function ListEditor({ kind, title, onClose, onChange }: {
  kind: ListKind; title: string; onClose: () => void;
  /** avisa quem está editando um livro: `to` null = apagado */
  onChange?: (from: string, to: string | null) => void;
}) {
  const items = useList(kind);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ from: string; to: string } | null>(null);

  return (
    <Modal title={title} onClose={onClose}>
      <form className="row nowrap" onSubmit={async (e) => { e.preventDefault(); e.stopPropagation(); if (name.trim()) { await ensureListItems(kind, [name]); setName(''); } }}>
        <input placeholder="Adicionar novo…" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="secondary">+</button>
      </form>
      <p className="small muted">Ao renomear ou apagar, os livros que usam esse item também são atualizados.</p>
      <div>
        {!items.length && <p className="small muted">Lista vazia.</p>}
        {items.map((i) => (
          <div key={i} className="row between nowrap" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            {editing?.from === i ? (
              <form className="row nowrap grow" onSubmit={async (e) => {
                // a janela pode abrir dentro do formulário do livro: não deixa o "Salvar" daqui salvar o livro
                e.preventDefault();
                e.stopPropagation();
                const to = editing.to.trim();
                if (to && to !== i) {
                  await renameListItem(kind, i, to);
                  onChange?.(i, to);
                }
                setEditing(null);
              }}>
                <input autoFocus value={editing.to} onChange={(e) => setEditing({ from: i, to: e.target.value })} />
                <button type="submit" className="small">Salvar</button>
                <button type="button" className="ghost small" onClick={() => setEditing(null)}>✕</button>
              </form>
            ) : (
              <>
                <span className="grow">{i}</span>
                <button type="button" className="icon small" aria-label={`Renomear ${i}`} onClick={() => setEditing({ from: i, to: i })}>✎</button>
                <button type="button" className="icon small" aria-label={`Apagar ${i}`} style={{ color: 'var(--danger)' }}
                  onClick={async () => { if (confirm(`Apagar “${i}”? Ele sai também dos livros.`)) { await renameListItem(kind, i, null); onChange?.(i, null); } }}>🗑</button>
              </>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
