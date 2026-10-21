import JSZip from 'jszip';
import { db, TABLES, type Media } from '../db';
import { downloadMedia } from '../sync/useSync';

const FORMAT = 'nina-books-backup';
const LAST_BACKUP_KEY = 'nina.lastBackup';

export const lastBackupDate = () => localStorage.getItem(LAST_BACKUP_KEY);

/** Gera um .zip com todos os dados (data.json) e todas as mídias (pasta media/). */
export async function exportBackup(onProgress?: (msg: string) => void): Promise<Blob> {
  const zip = new JSZip();
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  const mediaMeta: { id: string; type: string; name?: string; createdAt: string; file: string }[] = [];
  const media = await db.media.toArray();
  for (const [i, m] of media.entries()) {
    onProgress?.(`Copiando mídia ${i + 1} de ${media.length}…`);
    const blob = m.blob ?? (await downloadMedia(m.id));
    if (!blob) continue; // arquivo que está só na nuvem e não pôde ser baixado
    const file = `media/${m.id}`;
    zip.file(file, blob);
    mediaMeta.push({ id: m.id, type: m.type, name: m.name, createdAt: m.createdAt, file });
  }
  zip.file('data.json', JSON.stringify({ format: FORMAT, version: 1, exportedAt: new Date().toISOString(), data, media: mediaMeta }));
  onProgress?.('Compactando…');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  return blob;
}

/** Substitui todos os dados do app pelos do backup. */
export async function restoreBackup(file: Blob, onProgress?: (msg: string) => void) {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error('Esse arquivo não é um backup válido do Nina Book\'s (.zip).');
  }
  const json = await zip.file('data.json')?.async('string');
  if (!json) throw new Error('Backup sem o arquivo data.json.');
  const parsed = JSON.parse(json);
  if (parsed.format !== FORMAT) throw new Error('Esse .zip não é um backup do Nina Book\'s.');

  const media: Media[] = [];
  for (const [i, m] of (parsed.media ?? []).entries()) {
    onProgress?.(`Lendo mídia ${i + 1} de ${parsed.media.length}…`);
    const raw = await zip.file(m.file)?.async('blob');
    if (raw) media.push({ id: m.id, type: m.type, name: m.name, createdAt: m.createdAt, blob: new Blob([raw], { type: m.type }) });
  }
  onProgress?.('Gravando dados…');
  await db.transaction('rw', [...TABLES.map((t) => db.table(t)), db.media], async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      await db.table(t).bulkAdd(parsed.data[t] ?? []);
    }
    await db.media.clear();
    await db.media.bulkAdd(media);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** No iPhone/iPad abre a folha de compartilhar (salvar em Arquivos, AirDrop…). */
export async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  downloadBlob(blob, filename);
}
