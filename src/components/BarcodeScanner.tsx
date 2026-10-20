import { useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';

export function cameraErrorMessage(e: unknown) {
  const name = (e as Error)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Permissão de câmera negada. No iPhone/iPad: Ajustes › Safari › Câmera › Permitir (ou toque em “aA” na barra do Safari › Ajustes do site).';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Nenhuma câmera encontrada neste aparelho.';
  if (name === 'NotReadableError') return 'A câmera está sendo usada por outro app. Feche-o e tente de novo.';
  return 'Não foi possível abrir a câmera.';
}

/** Lê o código de barras (ISBN/EAN-13) pela câmera traseira. */
export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const { BarcodeFormat, DecodeHintType } = await import('@zxing/library');
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
        const c = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          video.current!,
          (result) => {
            if (result && !done.current) {
              done.current = true;
              navigator.vibrate?.(60);
              cb.current(result.getText());
            }
          },
        );
        if (cancelled) c.stop();
        else controls = c;
      } catch (e) {
        if (!cancelled) setError(cameraErrorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  if (error) return <div className="alert">{error}</div>;
  return (
    <div className="scanner">
      <video ref={video} muted playsInline autoPlay />
      <div className="frame" />
    </div>
  );
}

/** Tenta ler um código de barras numa foto já tirada. */
export async function decodeBarcodeFromImage(file: Blob) {
  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  const url = URL.createObjectURL(file);
  try {
    const r = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
    return r.getText();
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
