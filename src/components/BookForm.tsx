import { useState } from 'react';
import type { Book, Format, Ownership, Status } from '../db';
import { ensureListItems } from '../data/actions';
import { useList } from '../data/hooks';
import { DEFAULT_WORDS_PER_PAGE, FORMAT_LABEL, OWNERSHIP_LABEL, STATUS_LABEL, STATUSES } from '../domain/constants';
import { hasApiKey, researchBook } from '../services/claude';
import { shrinkImage } from '../services/media';
import { CoverStep } from './CoverCropper';
import { CaptureButton, ChipSelect, Cover, ErrorBox, Modal, MultiChips, Stars } from './ui';

export type BookDraft = Partial<Book> & { title: string; authors: string[]; coverBlob?: Blob };

const num = (s: string) => (s.trim() === '' ? undefined : Math.max(0, Number(s)) || undefined);

/** Formulário completo do livro (cadastro e edição). */
/** Escolha do resumo no cadastro: a IA pesquisa na internet, ou a pessoa escreve. */
function SummaryChooser({ d, set, authors }: { d: BookDraft; set: (p: Partial<BookDraft>) => void; authors: string[] }) {
  const [mode, setMode] = useState<'ia' | 'manual' | null>(d.summaryAI ? 'ia' : d.summaryManual ? 'manual' : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [noWeb, setNoWeb] = useState(false);

  const search = async () => {
    setMode('ia');
    setErr(null);
    setBusy(true);
    try {
      const r = await researchBook(d.title, authors);
      setNoWeb(!r.searchedWeb);
      // só completa os campos que ainda estão vazios
      set({
        summaryAI: r.summary, summaryAISources: r.sources, summaryAIDate: new Date().toISOString(),
        publisher: d.publisher ?? r.publisher, year: d.year ?? r.year, pageCount: d.pageCount ?? r.pageCount,
        originalLanguage: d.originalLanguage ?? r.originalLanguage, synopsis: d.synopsis ?? r.synopsis,
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ background: 'var(--surface-2)', boxShadow: 'none' }}>
      <h3>Resumo do livro</h3>
      <div className="summary-choice">
        <button type="button" className={mode === 'ia' ? '' : 'secondary'} disabled={busy || !d.title.trim() || !hasApiKey()} onClick={search}>
          {busy ? '⏳ Pesquisando…' : '✨ Buscar na internet'}
        </button>
        <button type="button" className={mode === 'manual' ? '' : 'secondary'} onClick={() => setMode('manual')}>✍️ Eu escrevo</button>
      </div>
      {!hasApiKey() && <p className="small muted mt">Para a IA buscar o resumo, cadastre a chave em Ajustes.</p>}
      <ErrorBox error={err} />
      {busy && <p className="small muted mt">A IA está pesquisando “{d.title}” na internet. Pode levar até um minuto…</p>}
      {mode === 'ia' && d.summaryAI && (
        <div className="mt">
          <span className="badge ai">✨ gerado por IA — pode editar</span>
          {noWeb && <p className="small muted" style={{ margin: '6px 0 0' }}>⚠️ Desta vez a IA não conseguiu pesquisar na internet e escreveu com o que já sabe. Confira as informações.</p>}
          <textarea className="mt" rows={10} style={{ minHeight: 220 }} value={d.summaryAI} onChange={(e) => set({ summaryAI: e.target.value })} />
          {d.summaryAISources?.length ? <p className="small muted">Fontes: {d.summaryAISources.map((s) => s.title).slice(0, 3).join(' · ')}</p> : null}
          <p className="small muted">A IA também completou editora, ano e páginas quando encontrou. Confira abaixo.</p>
        </div>
      )}
      {mode === 'manual' && (
        <textarea className="mt" rows={8} autoFocus placeholder="Com suas palavras: do que o livro trata?" value={d.summaryManual ?? ''} onChange={(e) => set({ summaryManual: e.target.value || undefined })} />
      )}
    </div>
  );
}

export function BookForm({ initial, onSave, onCancel, saveLabel = 'Salvar', withSummary = false }: {
  initial: BookDraft; onSave: (d: BookDraft) => Promise<void> | void; onCancel?: () => void; saveLabel?: string; withSummary?: boolean;
}) {
  const [newPhoto, setNewPhoto] = useState<Blob | null>(null);
  const [d, setD] = useState<BookDraft>({ status: 'quero_ler', favorite: false, rating: 0, genres: [], tags: [], ...initial });
  const [authors, setAuthors] = useState(initial.authors.join(', '));
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(() => (initial.coverBlob ? URL.createObjectURL(initial.coverBlob) : undefined));
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
            onFile={async (f) => setNewPhoto(await shrinkImage(f, 1600))}
          >📷 {d.coverBlob || d.coverId || d.coverUrl ? 'Trocar' : 'Capa'}</CaptureButton>
        </div>
        <div className="grow stack">
          <label className="field"><span>Título *</span><input required value={d.title} onChange={(e) => set({ title: e.target.value })} /></label>
          <label className="field"><span>Subtítulo</span><input value={d.subtitle ?? ''} onChange={(e) => set({ subtitle: e.target.value || undefined })} /></label>
        </div>
      </div>
      <label className="field"><span>Autor(es) — separe por vírgula</span><input value={authors} onChange={(e) => setAuthors(e.target.value)} /></label>
      {withSummary && <SummaryChooser d={d} set={set} authors={authors.split(',').map((a) => a.trim()).filter(Boolean)} />}
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

      {newPhoto && (
        <Modal title="Recortar capa" onClose={() => setNewPhoto(null)}>
          <CoverStep
            photo={newPhoto}
            onRetake={() => setNewPhoto(null)}
            onDone={(blob) => {
              set({ coverBlob: blob });
              setPreviewUrl(URL.createObjectURL(blob));
              setNewPhoto(null);
            }}
          />
        </Modal>
      )}

      <div className="row mt">
        {onCancel && <button type="button" className="secondary grow" onClick={onCancel}>Cancelar</button>}
        <button type="submit" className="grow" disabled={saving || !d.title.trim()}>{saving ? 'Salvando…' : saveLabel}</button>
      </div>
    </form>
  );
}
