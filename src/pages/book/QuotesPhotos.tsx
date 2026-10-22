import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { DictateButton } from '../../components/Dictation';
import { CaptureButton, ErrorBox, fmtDate, Modal, useToast } from '../../components/ui';
import { db, nowIso, uid, type PagePhoto, type Quote } from '../../db';
import { saveMedia } from '../../data/actions';
import { shrinkImage, useMediaUrl } from '../../services/media';
import { extractText } from '../../services/ocr';

function PhotoImg({ mediaId, onClick }: { mediaId: string; onClick?: () => void }) {
  const url = useMediaUrl(mediaId);
  return url ? <img src={url} alt="Foto da página" onClick={onClick} style={{ width: '100%', display: 'block', borderRadius: 10, cursor: onClick ? 'pointer' : undefined }} /> : <div className="cover" />;
}

/**
 * Tira a foto, salva no aparelho e roda o OCR.
 * A foto fica guardada mesmo se o OCR falhar (útil para anotações à mão).
 */
async function capturePagePhoto(bookId: string, file: File, onStatus: (s: string | null) => void) {
  const img = await shrinkImage(file, 2000, 0.85);
  const mediaId = await saveMedia(img, 'pagina');
  const photo: PagePhoto = { id: uid(), bookId, mediaId, createdAt: nowIso() };
  await db.photos.add(photo);
  let error: string | null = null;
  try {
    onStatus('Lendo o texto da foto…');
    const text = await extractText(img, (p) => onStatus(`Lendo o texto da foto… ${Math.round(p * 100)}%`));
    photo.ocrText = text;
    await db.photos.update(photo.id, { ocrText: text });
    if (!text) error = 'Não encontrei texto legível. A foto foi salva mesmo assim.';
  } catch (e) {
    error = `O texto não pôde ser lido (${(e as Error).message}). A foto foi salva mesmo assim.`;
  } finally {
    onStatus(null);
  }
  return { photo, error };
}

/** Mostra o texto da foto para selecionar um trecho e salvar como citação ou anotação. */
function PhotoViewer({ photo, onClose }: { photo: PagePhoto; onClose: () => void }) {
  const toast = useToast();
  const ta = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(photo.ocrText ?? '');
  const [page, setPage] = useState(photo.page ? String(photo.page) : '');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const selection = () => {
    const el = ta.current;
    if (!el) return text.trim();
    const sel = el.value.slice(el.selectionStart, el.selectionEnd).trim();
    return sel || el.value.trim();
  };
  const persist = () => db.photos.update(photo.id, { ocrText: text, page: page ? Number(page) : undefined });

  const asQuote = async () => {
    const t = selection();
    if (!t) return;
    await persist();
    await db.quotes.add({ id: uid(), bookId: photo.bookId, text: t, page: page ? Number(page) : undefined, comment: comment || undefined, photoId: photo.id, createdAt: nowIso() });
    toast('Citação salva ❝');
  };
  const asNote = async () => {
    const t = selection();
    if (!t) return;
    await persist();
    await db.notes.add({ id: uid(), bookId: photo.bookId, kind: 'texto', title: comment || 'Trecho fotografado', text: t, page: page ? Number(page) : undefined, createdAt: nowIso() });
    toast('Comentário salvo');
  };
  const rerun = async () => {
    setErr(null);
    const m = await db.media.get(photo.mediaId);
    if (!m?.blob) return setErr('A foto ainda está sendo baixada da nuvem. Tente de novo em instantes.');
    try {
      setBusy('Lendo o texto…');
      const t = await extractText(m.blob, (p) => setBusy(`Lendo o texto… ${Math.round(p * 100)}%`));
      setText(t);
      await db.photos.update(photo.id, { ocrText: t });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title="Foto da página" onClose={async () => { await persist(); onClose(); }}>
      <div className="stack">
        <div style={{ maxHeight: 340, overflow: 'auto', borderRadius: 12 }}><PhotoImg mediaId={photo.mediaId} /></div>
        <ErrorBox error={err} />
        {busy && <div className="alert info small">⏳ {busy}</div>}
        <label className="field"><span>Texto reconhecido — selecione o trecho que quer guardar</span>
          <textarea ref={ta} value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="(sem texto — você pode digitar aqui)" />
        </label>
        <div className="grid2">
          <label className="field"><span>Página</span><input inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, ''))} /></label>
          <label className="field"><span>Meu comentário</span><input value={comment} onChange={(e) => setComment(e.target.value)} /></label>
        </div>
        <p className="small muted">Se nada estiver selecionado, o texto todo é usado.</p>
        <div className="row">
          <button className="grow" onClick={asQuote}>❝ Salvar como citação</button>
          <button className="secondary grow" onClick={asNote}>✍️ Salvar como comentário</button>
        </div>
        <div className="row">
          <button className="ghost small" onClick={rerun} disabled={!!busy}>↻ Ler o texto de novo</button>
          <button className="ghost small" style={{ color: 'var(--danger)' }} onClick={async () => {
            if (!confirm('Apagar esta foto?')) return;
            await db.media.delete(photo.mediaId);
            await db.photos.delete(photo.id);
            await db.quotes.where('bookId').equals(photo.bookId).filter((q) => q.photoId === photo.id).modify({ photoId: undefined });
            onClose();
          }}>Apagar foto</button>
        </div>
      </div>
    </Modal>
  );
}

export function PhotosTab({ bookId }: { bookId: string }) {
  const photos = useLiveQuery(() => db.photos.where('bookId').equals(bookId).reverse().sortBy('createdAt'), [bookId]) ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<PagePhoto | null>(null);

  return (
    <div>
      <CaptureButton accept="image/*" className="block" onFile={async (f) => {
        setErr(null);
        const { photo, error } = await capturePagePhoto(bookId, f, setBusy);
        setErr(error);
        setOpen(photo);
      }}>📷 Fotografar página ou anotação</CaptureButton>
      <p className="small muted">O texto da foto vira pesquisável. Funciona com trechos impressos e anotações à mão.</p>
      <ErrorBox error={err} />
      {busy && <div className="alert info small">⏳ {busy}</div>}
      {photos.length === 0 && <div className="empty">Nenhuma foto ainda.</div>}
      <div className="photo-grid">
        {photos.map((p) => (
          <div key={p.id}>
            <PhotoImg mediaId={p.mediaId} onClick={() => setOpen(p)} />
            <div className="small muted">{fmtDate(p.createdAt)}{p.page ? ` · p. ${p.page}` : ''}</div>
          </div>
        ))}
      </div>
      {open && <PhotoViewer photo={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function QuotesTab({ bookId, language }: { bookId: string; language?: string }) {
  const [interim, setInterim] = useState('');
  const quotes = useLiveQuery(() => db.quotes.where('bookId').equals(bookId).reverse().sortBy('createdAt'), [bookId]) ?? [];
  const [edit, setEdit] = useState<Partial<Quote> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [photo, setPhoto] = useState<PagePhoto | null>(null);
  const [showPhoto, setShowPhoto] = useState<string | null>(null);

  const save = async () => {
    if (!edit?.text?.trim()) return;
    const data = { text: edit.text.trim(), page: edit.page, comment: edit.comment?.trim() || undefined };
    if (edit.id) await db.quotes.update(edit.id, data);
    else await db.quotes.add({ id: uid(), bookId, ...data, createdAt: nowIso() });
    setEdit(null);
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="grow" onClick={() => setEdit({})}>✍️ Escrever ou 🎤 falar</button>
        <CaptureButton accept="image/*" className="secondary grow" onFile={async (f) => {
          setErr(null);
          const r = await capturePagePhoto(bookId, f, setBusy);
          setErr(r.error);
          setPhoto(r.photo);
        }}>📷 Extrair de foto</CaptureButton>
      </div>
      <ErrorBox error={err} />
      {busy && <div className="alert info small">⏳ {busy}</div>}
      {quotes.length === 0 && <div className="empty">Nenhuma citação favorita ainda.</div>}
      {quotes.map((q) => (
        <div className="card" key={q.id}>
          <div className="quote pre">{q.text}</div>
          {q.comment && <p className="small mt" style={{ marginTop: 8 }}>💬 {q.comment}</p>}
          <div className="row between small muted">
            <span>{q.page ? `p. ${q.page} · ` : ''}{fmtDate(q.createdAt)}</span>
            <span>
              {q.photoId && <button className="icon small" onClick={() => setShowPhoto(q.photoId!)}>📷</button>}
              <button className="icon small" onClick={() => navigator.clipboard?.writeText(`“${q.text}”${q.page ? ` (p. ${q.page})` : ''}`)} aria-label="Copiar">⧉</button>
              <button className="icon small" onClick={() => setEdit(q)} aria-label="Editar">✎</button>
              <button className="icon small" onClick={() => confirm('Apagar citação?') && db.quotes.delete(q.id)} aria-label="Apagar">✕</button>
            </span>
          </div>
        </div>
      ))}

      {edit && (
        <Modal title={edit.id ? 'Editar citação' : 'Nova citação'} onClose={() => setEdit(null)}>
          <div className="stack">
            <DictateButton
              language={language}
              onInterim={setInterim}
              onText={(t) => setEdit((cur) => cur && { ...cur, text: cur.text?.trim() ? `${cur.text.trim()} ${t}` : t })}
            />
            <label className="field"><span>Citação (escreva ou fale)</span>
              <textarea value={edit.text ?? ''} onChange={(e) => setEdit({ ...edit, text: e.target.value })} placeholder="Digite aqui ou toque em “Falar a citação”" />
            </label>
            {interim && <p className="small muted" style={{ margin: 0, fontStyle: 'italic' }}>…{interim}</p>}
            <label className="field"><span>Página</span><input inputMode="numeric" value={edit.page ?? ''} onChange={(e) => setEdit({ ...edit, page: Number(e.target.value.replace(/\D/g, '')) || undefined })} /></label>
            <label className="field"><span>Meu comentário</span><textarea value={edit.comment ?? ''} onChange={(e) => setEdit({ ...edit, comment: e.target.value })} /></label>
            <button className="block" onClick={save} disabled={!edit.text?.trim()}>Salvar</button>
          </div>
        </Modal>
      )}
      {photo && <PhotoViewer photo={photo} onClose={() => setPhoto(null)} />}
      {showPhoto && <PhotoById id={showPhoto} onClose={() => setShowPhoto(null)} />}
    </div>
  );
}

function PhotoById({ id, onClose }: { id: string; onClose: () => void }) {
  const p = useLiveQuery(() => db.photos.get(id), [id]);
  if (!p) return null;
  return <Modal title="Foto original" onClose={onClose}><PhotoImg mediaId={p.mediaId} /></Modal>;
}
