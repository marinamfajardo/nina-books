import { hasApiKey, ocrWithClaude } from './claude';
import { blobToBase64 } from './media';

export type OcrEngine = 'auto' | 'aparelho' | 'claude';
const ENGINE_KEY = 'nina.ocrEngine';
export const getOcrEngine = (): OcrEngine => (localStorage.getItem(ENGINE_KEY) as OcrEngine) || 'auto';
export const setOcrEngine = (e: OcrEngine) => localStorage.setItem(ENGINE_KEY, e);

/** OCR no próprio aparelho (Tesseract). Na primeira vez baixa os dados do idioma. */
async function ocrOnDevice(image: Blob, onProgress?: (p: number) => void) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['por', 'eng'], 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}

/**
 * Extrai o texto de uma foto. "auto" usa o Claude (melhor com letra à mão)
 * quando há chave e internet, e o OCR do aparelho nos outros casos.
 */
export async function extractText(image: Blob, onProgress?: (p: number) => void): Promise<string> {
  const engine = getOcrEngine();
  const canClaude = hasApiKey() && navigator.onLine;
  if (engine === 'claude' || (engine === 'auto' && canClaude)) {
    try {
      return await ocrWithClaude(await blobToBase64(image), image.type || 'image/jpeg');
    } catch (e) {
      if (engine === 'claude') throw e;
    }
  }
  return ocrOnDevice(image, onProgress);
}
