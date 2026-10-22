import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { CaptureButton, ErrorBox, fmtDateTime, Modal, useToast } from '../../components/ui';
import { db, nowIso, uid, type Note } from '../../db';
import { saveMedia } from '../../data/actions';
import { formatDuration } from '../../domain/stats';
import { shrinkImage, useMediaUrl } from '../../services/media';

const micError = (e: unknown) => {
  const n = (e as Error)?.name;
  if (n === 'NotAllowedError' || n === 'SecurityError')
    return 'Permissão de microfone negada. No iPhone/iPad: toque em “aA” na barra do Safari › Ajustes do site › Microfone › Permitir.';
  if (n === 'NotFoundError') return 'Nenhum microfone encontrado.';
  return 'Não foi possível usar o microfone.';
};

/** Gravador de áudio com pausar/continuar. */
function AudioRecorder({ onDone }: { onDone: (blob: Blob, sec: number) => void }) {
  const [state, setState] = useState<'idle' | 'rec' | 'paused'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sec, setSec] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const secRef = useRef(0);

  useEffect(() => {
    if (state !== 'rec') return;
    const i = setInterval(() => { secRef.current += 1; setSec(secRef.current); }, 1000);
    return () => clearInterval(i);
  }, [state]);
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  const start = async () => {
    setError(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported?.(t));
      const r = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        onDone(new Blob(chunks.current, { type: r.mimeType || type || 'audio/mp4' }), secRef.current);
      };
      r.start(1000);
      rec.current = r;
      secRef.current = 0;
      setSec(0);
      setState('rec');
    } catch (e) {
      setError(micError(e));
    }
  };

  return (
    <div className="stack center">
      <ErrorBox error={error} />
      <div className="timer">{state !== 'idle' && <span className="rec-dot" style={{ marginRight: 10, animationPlayState: state === 'rec' ? 'running' : 'paused' }} />}{formatDuration(sec)}</div>
      <div className="row" style={{ justifyContent: 'center' }}>
        {state === 'idle' && <button onClick={start}>🎙️ Gravar</button>}
        {state === 'rec' && <button className="secondary" onClick={() => { rec.current?.pause(); setState('paused'); }}>⏸ Pausar</button>}
        {state === 'paused' && <button className="secondary" onClick={() => { rec.current?.resume(); setState('rec'); }}>▶ Continuar</button>}
        {state !== 'idle' && <button onClick={() => { rec.current?.stop(); setState('idle'); }}>⏹ Concluir</button>}
      </div>
    </div>
  );
}

function MediaPlayer({ note }: { note: Note }) {
  const url = useMediaUrl(note.mediaId);
  if (!url) return <p className="small muted">⏳ Carregando arquivo…</p>;
  if (note.kind === 'foto') return <img src={url} alt={note.title ?? 'Foto'} style={{ width: '100%', borderRadius: 12, display: 'block', maxHeight: 520, objectFit: 'contain', background: 'var(--surface-2)' }} />;
  return note.kind === 'audio'
    ? <audio controls src={url} style={{ width: '100%' }} />
    : <video controls playsInline src={url} style={{ width: '100%', borderRadius: 12, maxHeight: 420, background: '#000' }} />;
}

type Draft = { kind: Note['kind']; title: string; text: string; page: string; blob?: Blob; seconds?: number };

/** mode "comentarios": comentários escritos, em áudio ou em vídeo · mode "fotos": fotos do livro */
export function NotesTab({ bookId, mode }: { bookId: string; mode: 'comentarios' | 'fotos' }) {
  const all = useLiveQuery(() => db.notes.where('bookId').equals(bookId).reverse().sortBy('createdAt'), [bookId]) ?? [];
  const notes = all.filter((n) => (mode === 'fotos' ? n.kind === 'foto' : n.kind !== 'foto'));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<Note | null>(null);
  const toast = useToast();

  const save = async () => {
    if (!draft) return;
    if (draft.kind === 'texto' && !draft.text.trim()) return;
    if (draft.kind !== 'texto' && !draft.blob) return;
    const mediaId = draft.blob ? await saveMedia(draft.blob, draft.title) : undefined;
    await db.notes.add({
      id: uid(), bookId, kind: draft.kind, title: draft.title.trim() || undefined, text: draft.text.trim() || undefined,
      mediaId, page: draft.page ? Number(draft.page) : undefined, createdAt: nowIso(),
    });
    setDraft(null);
    toast({ texto: 'Comentário salvo', audio: 'Áudio salvo no livro 🎙️', video: 'Vídeo salvo no livro 🎥', foto: 'Foto salva no livro 📷' }[draft.kind]);
  };

  const remove = async (n: Note) => {
    if (!confirm('Apagar esta anotação?')) return;
    if (n.mediaId) await db.media.delete(n.mediaId);
    await db.notes.delete(n.id);
  };

  const blank = (kind: Note['kind']): Draft => ({ kind, title: '', text: '', page: '' });

  return (
    <div>
      {mode === 'comentarios' ? (
        <div style={{ marginBottom: 14 }}>
          <div className="grid3">
            <button onClick={() => setDraft(blank('texto'))}>✍️ Escrever</button>
            <button onClick={() => setDraft(blank('audio'))}>🎙️ Áudio</button>
            <CaptureButton accept="video/*" className="" onFile={(f) => setDraft({ ...blank('video'), blob: f })}>🎥 Vídeo</CaptureButton>
          </div>
          <div className="center">
            <CaptureButton accept="video/*,audio/*" capture={false} className="ghost small" onFile={(f) => setDraft({ ...blank(f.type.startsWith('audio') ? 'audio' : 'video'), blob: f, title: f.name.replace(/\.[^.]+$/, '') })}>
              ou enviar um áudio/vídeo já gravado
            </CaptureButton>
          </div>
          <p className="small muted center" style={{ margin: 0 }}>Seus comentários sobre o livro — separados das citações.</p>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <div className="grid2">
            <CaptureButton accept="image/*" className="" onFile={async (f) => setDraft({ ...blank('foto'), blob: await shrinkImage(f, 2000) })}>📷 Tirar foto</CaptureButton>
            <CaptureButton accept="image/*" capture={false} className="secondary" onFile={async (f) => setDraft({ ...blank('foto'), blob: await shrinkImage(f, 2000), title: f.name.replace(/\.[^.]+$/, '') })}>🖼️ Da galeria</CaptureButton>
          </div>
        </div>
      )}

      {notes.length === 0 && (
        <div className="empty">
          {mode === 'comentarios'
            ? 'Nenhum comentário ainda. Escreva, grave um áudio ou um vídeo com suas impressões sobre o livro!'
            : 'Nenhuma foto do livro ainda.'}
        </div>
      )}
      <div className="timeline">
        {notes.map((n) => (
          <div className="ev card" key={n.id}>
            <div className="row between small muted">
              <span>{{ texto: '✍️', audio: '🎙️', video: '🎥', foto: '📷' }[n.kind]} {fmtDateTime(n.createdAt)}{n.page ? ` · p. ${n.page}` : ''}</span>
              <span>
                <button className="icon small" onClick={() => setEditing(n)} aria-label="Editar">✎</button>
                <button className="icon small" onClick={() => remove(n)} aria-label="Apagar">✕</button>
              </span>
            </div>
            {n.title && <b>{n.title}</b>}
            {n.text && <p className="pre" style={{ marginTop: 4 }}>{n.text}</p>}
            {n.mediaId && <MediaPlayer note={n} />}
          </div>
        ))}
      </div>

      {draft && (
        <Modal title={{ texto: 'Novo comentário', audio: 'Comentário em áudio', video: 'Comentário em vídeo', foto: 'Foto' }[draft.kind]} onClose={() => setDraft(null)}>
          <div className="stack">
            {draft.kind === 'audio' && !draft.blob && <AudioRecorder onDone={(blob, seconds) => setDraft((d) => d && { ...d, blob, seconds })} />}
            {draft.blob && draft.kind === 'audio' && <audio controls src={URL.createObjectURL(draft.blob)} style={{ width: '100%' }} />}
            {draft.blob && draft.kind === 'foto' && <img src={URL.createObjectURL(draft.blob)} alt="Prévia" style={{ width: '100%', borderRadius: 12, maxHeight: 360, objectFit: 'contain' }} />}
            {draft.blob && draft.kind === 'video' && <video controls playsInline src={URL.createObjectURL(draft.blob)} style={{ width: '100%', borderRadius: 12 }} />}
            <label className="field"><span>{draft.kind === 'texto' ? 'Título (opcional)' : 'Nome'}</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
            {draft.kind === 'texto' && <label className="field"><span>Comentário</span><textarea autoFocus value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} /></label>}
            {draft.kind !== 'texto' && <label className="field"><span>Descrição (opcional)</span><input value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} /></label>}
            <label className="field"><span>Página (opcional)</span><input inputMode="numeric" value={draft.page} onChange={(e) => setDraft({ ...draft, page: e.target.value.replace(/\D/g, '') })} /></label>
            <button className="block" onClick={save} disabled={draft.kind === 'texto' ? !draft.text.trim() : !draft.blob}>Salvar</button>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title="Editar anotação" onClose={() => setEditing(null)}>
          <div className="stack">
            <label className="field"><span>Título</span><input value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></label>
            <label className="field"><span>Texto</span><textarea value={editing.text ?? ''} onChange={(e) => setEditing({ ...editing, text: e.target.value })} /></label>
            <label className="field"><span>Página</span><input inputMode="numeric" value={editing.page ?? ''} onChange={(e) => setEditing({ ...editing, page: Number(e.target.value.replace(/\D/g, '')) || undefined })} /></label>
            <button className="block" onClick={async () => {
              await db.notes.update(editing.id, { title: editing.title || undefined, text: editing.text || undefined, page: editing.page });
              setEditing(null);
            }}>Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
