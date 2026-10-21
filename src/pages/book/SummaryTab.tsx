import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBox, fmtDateTime, useToast } from '../../components/ui';
import type { Book } from '../../db';
import { updateBook } from '../../data/actions';
import { generateSummary, hasApiKey } from '../../services/claude';

function EditableText({ value, placeholder, onSave, rows = 6 }: { value?: string; placeholder: string; onSave: (v: string) => Promise<void>; rows?: number }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? '');
  if (!editing) {
    return (
      <div>
        {value ? <p className="pre">{value}</p> : <p className="muted small">{placeholder}</p>}
        <button className="secondary small" onClick={() => { setText(value ?? ''); setEditing(true); }}>{value ? 'Editar' : 'Escrever'}</button>
      </div>
    );
  }
  return (
    <div className="stack">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={rows} style={{ minHeight: rows * 24 }} autoFocus />
      <div className="row">
        <button className="secondary grow" onClick={() => setEditing(false)}>Cancelar</button>
        <button className="grow" onClick={async () => { await onSave(text.trim()); setEditing(false); }}>Salvar</button>
      </div>
    </div>
  );
}

export function SummaryTab({ book }: { book: Book }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const generate = async () => {
    if (book.summaryAI && !confirm('Gerar um novo resumo com IA? O atual será substituído.')) return;
    setError(null);
    setLoading(true);
    try {
      const { text, sources } = await generateSummary(book);
      await updateBook(book.id, { summaryAI: text, summaryAISources: sources, summaryAIDate: new Date().toISOString() });
      toast('Resumo gerado ✨');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="row between"><h3 style={{ margin: 0 }}>Resumo da IA</h3><span className="badge ai">✨ gerado por IA</span></div>
        <ErrorBox error={error} />
        {loading && <div className="alert info small mt">⏳ Pesquisando o livro na web e escrevendo o resumo… pode levar até um minuto.</div>}
        {book.summaryAI ? (
          <div className="mt">
            <EditableText value={book.summaryAI} placeholder="" onSave={(v) => updateBook(book.id, { summaryAI: v || undefined })} rows={10} />
            {book.summaryAISources?.length ? (
              <details className="mt">
                <summary className="small" style={{ cursor: 'pointer', fontWeight: 700 }}>Fontes usadas ({book.summaryAISources.length})</summary>
                <ul className="small">{book.summaryAISources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul>
              </details>
            ) : null}
            {book.summaryAIDate && <p className="small muted">Gerado em {fmtDateTime(book.summaryAIDate)}. Confira as informações — a IA pode errar.</p>}
          </div>
        ) : (
          <p className="small muted mt">A IA pesquisa o livro na internet e escreve um resumo em português, com as fontes.</p>
        )}
        {hasApiKey() ? (
          <button className="secondary mt" onClick={generate} disabled={loading}>✨ {book.summaryAI ? 'Gerar de novo' : 'Gerar resumo com IA'}</button>
        ) : (
          <p className="small mt">Para usar a IA, cadastre sua chave em <Link to="/configuracoes">Configurações</Link>.</p>
        )}
      </div>

      <div className="card">
        <h3>Meu resumo</h3>
        <EditableText value={book.summaryManual} placeholder="Escreva com suas palavras do que o livro trata." onSave={(v) => updateBook(book.id, { summaryManual: v || undefined })} />
      </div>

      <div className="card">
        <h3>Minha resenha</h3>
        <EditableText value={book.review} placeholder="O que você achou? Personagens, escrita, o que ficou com você…" onSave={(v) => updateBook(book.id, { review: v || undefined })} rows={12} />
      </div>
    </div>
  );
}
