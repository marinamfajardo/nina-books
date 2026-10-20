import { useState } from 'react';
import type { Book, Format, Ownership, Status } from '../db';
import { ensureListItems } from '../data/actions';
import { useList } from '../data/hooks';
import { DEFAULT_WORDS_PER_PAGE, FORMAT_LABEL, OWNERSHIP_LABEL, STATUS_LABEL, STATUSES } from '../domain/constants';
import { shrinkImage } from '../services/media';
import { CaptureButton, ChipSelect, Cover, MultiChips, Stars } from './ui';

export type BookDraft = Partial<Book> & { title: string; authors: string[]; coverBlob?: Blob };

const num = (s: string) => (s.trim() === '' ? undefined : Math.max(0, Number(s)) || undefined);

/** Formulário completo do livro (cadastro e edição). */
export function BookForm({ initial, onSave, onCancel, saveLabel = 'Salvar' }: {
  initial: BookDraft; onSave: (d: BookDraft) => Promise<void> | void; onCancel?: () => void; saveLabel?: string;
}) {
  const [d, setD] = useState<BookDraft>({ status: 'quero_ler', favorite: false, rating: 0, genres: [], tags: [], ...initial });
  const [authors, setAuthors] = useState(initial.authors.join(', '));
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [saving, setSaving] = useState(false);
  const genres = useList('genre');
  const languages = useList('language');
  const tags = useList('tag');
  const set = (p: Partial<BookDraft>) => setD((x) => ({ ...x, ...p }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.title.trim()) return;
    setSaving(true);
    try {
      await onSave({ ...d, title: d.title.trim(), authors: authors.split(',').map((a) => a.trim()).filter(Boolean) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="row nowrap" style={{ alignItems: 'flex-start' }}>
        <div style={{ width: 96, flex: 'none' }}>
          {previewUrl ? (
            <div className="cover"><img src={previewUrl} alt="Capa" /></div>
          ) : (
            <Cover book={{ title: d.title || 'Sem título', authors: authors.split(','), coverId: d.coverId, coverUrl: d.coverUrl, favorite: false }} />
          )}
          <CaptureButton
            accept="image/*"
            className="ghost small"
            onFile={async (f) => {
              const blob = await shrinkImage(f, 1000);
              set({ coverBlob: blob });
              setPreviewUrl(URL.createObjectURL(blob));
            }}
          >📷 Capa</CaptureButton>
        </div>
        <div className="grow stack">
          <label className="field"><span>Título *</span><input required value={d.title} onChange={(e) => set({ title: e.target.value })} /></label>
          <label className="field"><span>Subtítulo</span><input value={d.subtitle ?? ''} onChange={(e) => set({ subtitle: e.target.value || undefined })} /></label>
        </div>
      </div>
      <label className="field"><span>Autor(es) — separe por vírgula</span><input value={authors} onChange={(e) => setAuthors(e.target.value)} /></label>
      <div className="grid2">
        <label className="field"><span>Editora</span><input value={d.publisher ?? ''} onChange={(e) => set({ publisher: e.target.value || undefined })} /></label>
        <label className="field"><span>Ano</span><input inputMode="numeric" value={d.year ?? ''} onChange={(e) => set({ year: num(e.target.value) })} /></label>
        <label className="field"><span>ISBN</span><input inputMode="numeric" value={d.isbn ?? ''} onChange={(e) => set({ isbn: e.target.value.replace(/[^0-9Xx]/g, '') || undefined })} /></label>
        <label className="field"><span>Nº de páginas</span><input inputMode="numeric" value={d.pageCount ?? ''} onChange={(e) => set({ pageCount: num(e.target.value) })} /></label>
      </div>
      <label className="field"><span>Idioma original</span><input value={d.originalLanguage ?? ''} onChange={(e) => set({ originalLanguage: e.target.value || undefined })} list="langs" /></label>
      <datalist id="langs">{languages.map((l) => <option key={l} value={l} />)}</datalist>
      <label className="field"><span>Sinopse da editora</span><textarea value={d.synopsis ?? ''} onChange={(e) => set({ synopsis: e.target.value || undefined })} /></label>

      <h3 className="mt">Classificação</h3>
      <div className="field"><span className="small muted" style={{ fontWeight: 700 }}>Status</span>
        <ChipSelect options={STATUSES} labels={STATUS_LABEL} value={d.status} onChange={(s) => set({ status: (s ?? 'quero_ler') as Status })} />
      </div>
      <div className="row between">
        <label className="row"><input type="checkbox" checked={!!d.favorite} onChange={(e) => set({ favorite: e.target.checked })} /> Favorito ♥</label>
        <Stars value={d.rating ?? 0} onChange={(rating) => set({ rating })} />
      </div>
      <div><span className="small muted" style={{ fontWeight: 700 }}>Gêneros (pode escolher vários)</span>
        <MultiChips options={genres} value={d.genres ?? []} onChange={(g) => set({ genres: g })}
          onCreate={async (n) => { await ensureListItems('genre', [n]); set({ genres: [...(d.genres ?? []), n] }); }} createLabel="+ Novo gênero" />
      </div>
      <label className="field"><span>Idioma em que eu li</span>
        <select value={d.readingLanguage ?? ''} onChange={async (e) => {
          let v = e.target.value;
          if (v === '__novo') {
            v = prompt('Nome do idioma:')?.trim() ?? '';
            if (v) await ensureListItems('language', [v]);
          }
          set({ readingLanguage: v || undefined });
        }}>
          <option value="">—</option>
          {[...new Set([...languages, ...(d.readingLanguage ? [d.readingLanguage] : [])])].map((l) => <option key={l}>{l}</option>)}
          <option value="__novo">+ Adicionar idioma…</option>
        </select>
      </label>
      <div className="grid2">
        <label className="field"><span>Formato</span>
          <select value={d.format ?? ''} onChange={(e) => set({ format: (e.target.value || undefined) as Format | undefined })}>
            <option value="">—</option>
            {(Object.keys(FORMAT_LABEL) as Format[]).map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
          </select>
        </label>
        <label className="field"><span>Exemplar</span>
          <select value={d.ownership ?? ''} onChange={(e) => set({ ownership: (e.target.value || undefined) as Ownership | undefined })}>
            <option value="">—</option>
            {(Object.keys(OWNERSHIP_LABEL) as Ownership[]).map((f) => <option key={f} value={f}>{OWNERSHIP_LABEL[f]}</option>)}
          </select>
        </label>
      </div>
      <div><span className="small muted" style={{ fontWeight: 700 }}>Tags</span>
        <MultiChips options={tags} value={d.tags ?? []} onChange={(t) => set({ tags: t })}
          onCreate={async (n) => { await ensureListItems('tag', [n]); set({ tags: [...(d.tags ?? []), n] }); }} createLabel="+ Nova tag" />
      </div>
      {d.status === 'quero_ler' && (
        <label className="field"><span>Prioridade na fila “Quero ler”</span>
          <select value={d.wantPriority ?? 2} onChange={(e) => set({ wantPriority: Number(e.target.value) })}>
            <option value={1}>Alta</option><option value={2}>Média</option><option value={3}>Baixa</option>
          </select>
        </label>
      )}

      <details>
        <summary className="small" style={{ fontWeight: 700, cursor: 'pointer' }}>Contagem de palavras</summary>
        <div className="grid2 mt">
          <label className="field"><span>Palavras por página</span><input inputMode="numeric" placeholder={String(DEFAULT_WORDS_PER_PAGE)} value={d.wordsPerPage ?? ''} onChange={(e) => set({ wordsPerPage: num(e.target.value) })} /></label>
          <label className="field"><span>Total de palavras do livro</span><input inputMode="numeric" placeholder="opcional" value={d.totalWords ?? ''} onChange={(e) => set({ totalWords: num(e.target.value) })} /></label>
        </div>
        <p className="small muted">Se você informar o total de palavras, ele é usado no lugar da estimativa por página.</p>
      </details>

      <div className="row mt">
        {onCancel && <button type="button" className="secondary grow" onClick={onCancel}>Cancelar</button>}
        <button type="submit" className="grow" disabled={saving || !d.title.trim()}>{saving ? 'Salvando…' : saveLabel}</button>
      </div>
    </form>
  );
}
