import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { CaptureButton, ErrorBox, fmtDateTime, Modal, useToast } from '../../components/ui';
import { db, nowIso, uid, type Note } from '../../db';
import { saveMedia } from '../../data/actions';
import { formatDuration } from '../../domain/stats';
import { useMediaUrl } from '../../services/media';

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
  if (!url) return null;
  return note.kind === 'audio'
    ? <audio controls src={url} style={{ width: '100%' }} />
    : <video controls playsInline src={url} style={{ width: '100%', borderRadius: 12, maxHeight: 420, background: '#000' }} />;
}

type Draft = { kind: Note['kind']; title: string; text: string; page: string; blob?: Blob; seconds?: number };

export function NotesTab({ bookId }: { bookId: string }) {
  const notes = useLiveQuery(() => db.notes.where('bookId').equals(bookId).reverse().sortBy('createdAt'), [bookId]) ?? [];
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
    toast('Anotação salva');
  };

  const remove = async (n: Note) => {
    if (!confirm('Apagar esta anotação?')) return;
    if (n.mediaId) await db.media.delete(n.mediaId);
    await db.notes.delete(n.id);
  };

  const blank = (kind: Note['kind']): Draft => ({ kind, title: '', text: '', page: '' });

  return (
    <div>
      <div className="grid3" style={{ marginBottom: 14 }}>
        <button onClick={() => setDraft(blank('texto'))}>✍️ Texto</button>
        <button onClick={() => setDraft(blank('audio'))}>🎙️ Áudio</button>
        <CaptureButton accept="video/*" className="" onFile={(f) => setDraft({ ...blank('video'), blob: f })}>🎥 Vídeo</CaptureButton>
      </div>

      {notes.length === 0 && <div className="empty">Nenhuma anotação ainda. Registre o que você pensou durante a leitura — por texto, áudio ou vídeo.</div>}
      <div className="timeline">
        {notes.map((n) => (
          <div className="ev card" key={n.id}>
            <div className="row between small muted">
              <span>{n.kind === 'texto' ? '✍️' : n.kind === 'audio' ? '🎙️' : '🎥'} {fmtDateTime(n.createdAt)}{n.page ? ` · p. ${n.page}` : ''}</span>
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
        <Modal title={draft.kind === 'texto' ? 'Nova anotação' : draft.kind === 'audio' ? 'Gravar áudio' : 'Vídeo'} onClose={() => setDraft(null)}>
          <div className="stack">
            {draft.kind === 'audio' && !draft.blob && <AudioRecorder onDone={(blob, seconds) => setDraft((d) => d && { ...d, blob, seconds })} />}
            {draft.blob && draft.kind === 'audio' && <audio controls src={URL.createObjectURL(draft.blob)} style={{ width: '100%' }} />}
            {draft.blob && draft.kind === 'video' && <video controls playsInline src={URL.createObjectURL(draft.blob)} style={{ width: '100%', borderRadius: 12 }} />}
            <label className="field"><span>{draft.kind === 'texto' ? 'Título (opcional)' : 'Nome'}</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
            {draft.kind === 'texto' && <label className="field"><span>Anotação</span><textarea autoFocus value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} /></label>}
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
