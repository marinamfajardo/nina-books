import { useEffect, useRef, useState } from 'react';
import { orderCorners, warpToCanvas, type Point } from '../domain/perspective';
import { analyzeCover, hasApiKey, type CoverAnalysis } from '../services/claude';
import { blobToBase64 } from '../services/media';

export const DEFAULT_CORNERS: Point[] = [[0.1, 0.08], [0.9, 0.08], [0.9, 0.92], [0.1, 0.92]];

/** Carrega a foto como bitmap (respeitando a rotação da câmera). */
async function loadImage(blob: Blob) {
  return createImageBitmap(blob, { imageOrientation: 'from-image' });
}

/** Recorta a capa e devolve a imagem já endireitada (JPEG). */
export async function cropCover(photo: Blob, corners: Point[]): Promise<Blob> {
  const img = await loadImage(photo);
  const quad = orderCorners(corners).map(([x, y]) => [x * img.width, y * img.height] as Point);
  const canvas = warpToCanvas(img, quad, 1200);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao recortar'))), 'image/jpeg', 0.9));
}

/**
 * Mostra a foto com os 4 cantos da capa. Arraste os cantos para ajustar o recorte.
 * Os cantos são frações (0–1) da largura e da altura da foto.
 */
export function CoverCropper({ photo, corners, onChange }: { photo: Blob; corners: Point[]; onChange: (c: Point[]) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string>();
  const [ratio, setRatio] = useState(3 / 4);
  const dragging = useRef<number | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(photo);
    setUrl(u);
    void loadImage(photo).then((b) => setRatio(b.width / b.height)).catch(() => {});
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  const move = (e: React.PointerEvent) => {
    const i = dragging.current;
    const r = box.current?.getBoundingClientRect();
    if (i === null || !r) return;
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    const next = corners.map((p, j) => (j === i ? ([x, y] as Point) : p));
    onChange(next);
  };

  const pts = corners.map(([x, y]) => `${x * 100},${y * 100}`).join(' ');

  return (
    <div
      ref={box}
      className="cropper"
      style={{ aspectRatio: String(ratio) }}
      onPointerMove={move}
      onPointerUp={() => (dragging.current = null)}
      onPointerCancel={() => (dragging.current = null)}
    >
      {url && <img src={url} alt="Foto do livro" draggable={false} />}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={`M0 0H100V100H0Z M${corners.map(([x, y]) => `${x * 100} ${y * 100}`).join(' L')}Z`} fill="rgba(20,4,10,.6)" fillRule="evenodd" />
        <polygon points={pts} fill="none" stroke="#f6dde3" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
      </svg>
      {corners.map(([x, y], i) => (
        <div
          key={i}
          className="handle"
          style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
          onPointerDown={(e) => {
            e.preventDefault();
            dragging.current = i;
            box.current?.setPointerCapture(e.pointerId);
          }}
          aria-label={`Canto ${i + 1}`}
        />
      ))}
    </div>
  );
}

/**
 * Etapa de recorte: a IA (se configurada) localiza a capa e lê título/autor;
 * a pessoa ajusta os cantos e confirma.
 */
export function CoverStep({ photo, onDone, onRetake }: {
  photo: Blob;
  onDone: (cover: Blob, analysis: CoverAnalysis | null) => void;
  onRetake: () => void;
}) {
  const [corners, setCorners] = useState<Point[]>(DEFAULT_CORNERS);
  const [analysis, setAnalysis] = useState<CoverAnalysis | null>(null);
  const [status, setStatus] = useState<'ia' | 'pronto'>(hasApiKey() && navigator.onLine ? 'ia' : 'pronto');
  const [msg, setMsg] = useState<string | null>(
    hasApiKey() ? (navigator.onLine ? null : 'Sem internet: ajuste os cantos à mão e preencha o título e o autor.') : 'Sem a chave da IA configurada: ajuste os cantos à mão e preencha o título e o autor. (Ajustes › Inteligência artificial)',
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== 'ia') return;
    let alive = true;
    (async () => {
      try {
        const a = await analyzeCover(await blobToBase64(photo), photo.type || 'image/jpeg');
        if (!alive) return;
        setAnalysis(a);
        if (a.corners) setCorners(a.corners);
        else setMsg('A IA não achou os cantos da capa. Arraste os círculos até os cantos do livro.');
      } catch (e) {
        if (alive) setMsg(`${(e as Error).message} Ajuste os cantos à mão.`);
      } finally {
        if (alive) setStatus('pronto');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async (whole: boolean) => {
    setBusy(true);
    try {
      const blob = whole ? photo : await cropCover(photo, corners);
      onDone(blob, analysis);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      {status === 'ia' ? (
        <div className="alert info">✨ A IA está encontrando a capa e lendo o título e o autor…</div>
      ) : msg ? (
        <div className="alert info small">{msg}</div>
      ) : (
        <div className="alert info small">✂️ Confira o recorte. Se precisar, arraste os círculos até os cantos da capa.</div>
      )}
      <CoverCropper photo={photo} corners={corners} onChange={setCorners} />
      <button type="button" className="block" disabled={status === 'ia' || busy} onClick={() => finish(false)}>
        {status === 'ia' ? '⏳ Aguarde…' : busy ? 'Recortando…' : '✂️ Recortar e continuar'}
      </button>
      <div className="row">
        <button type="button" className="secondary grow" disabled={status === 'ia' || busy} onClick={() => finish(true)}>Usar a foto inteira</button>
        <button type="button" className="ghost grow" onClick={onRetake}>📷 Tirar outra foto</button>
      </div>
    </div>
  );
}
