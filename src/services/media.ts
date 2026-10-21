import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { downloadMedia } from '../sync/useSync';

/** URL temporária para exibir uma mídia salva no aparelho. */
export function useMediaUrl(id?: string) {
  const media = useLiveQuery(() => (id ? db.media.get(id) : undefined), [id]);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!media) {
      setUrl(undefined);
      return;
    }
    if (!media.blob) {
      // veio do outro aparelho: baixa da nuvem (a tela atualiza sozinha)
      setUrl(undefined);
      void downloadMedia(media.id);
      return;
    }
    const u = URL.createObjectURL(media.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [media]);
  return url;
}

export const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** Reduz fotos grandes da câmera (economiza espaço e acelera o OCR). */
export async function shrinkImage(file: Blob, maxSide = 1800, quality = 0.85): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', quality));
  } catch {
    return file;
  }
}
