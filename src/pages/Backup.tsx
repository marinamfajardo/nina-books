import { useRef, useState } from 'react';
import { ErrorBox, PageTitle, fmtDateTime, useToast } from '../components/ui';
import { importBooks } from '../data/actions';
import { useLibrary } from '../data/hooks';
import { today } from '../domain/stats';
import { exportBackup, lastBackupDate, restoreBackup, shareOrDownload } from '../services/backup';
import { booksToCsv, parseCsv } from '../services/csv';

export default function Backup() {
  const lib = useLibrary();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const last = lastBackupDate();

  const run = async (fn: () => Promise<void>) => {
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message || 'Algo deu errado.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageTitle back>Backup e CSV</PageTitle>
      <ErrorBox error={err} />
      {busy && <div className="alert info">⏳ {busy}</div>}

      <div className="card stack">
        <h3>Backup completo (.zip)</h3>
        <p className="small">Guarda tudo: livros, sessões, anotações, citações, glossário <b>e todas as fotos, áudios e vídeos</b>. Use para não perder nada ou para passar seus dados do celular para o iPad.</p>
        <p className="small muted">{last ? `Último backup: ${fmtDateTime(last)}` : 'Você ainda não fez nenhum backup.'}</p>
        <button onClick={() => run(async () => {
          setBusy('Preparando o backup…');
          const blob = await exportBackup(setBusy);
          await shareOrDownload(blob, `nina-books-backup-${today()}.zip`);
          toast('Backup pronto 💾');
        })}>💾 Exportar backup</button>
        <p className="small muted">No iPhone/iPad, escolha “Salvar em Arquivos” (ou envie para o iCloud Drive / AirDrop).</p>
        <button className="secondary" onClick={() => zipInput.current?.click()}>♻️ Restaurar a partir de um backup</button>
        <input ref={zipInput} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          if (!confirm('Restaurar vai SUBSTITUIR todos os dados atuais deste aparelho pelos do backup. Continuar?')) return;
          void run(async () => {
            setBusy('Restaurando…');
            await restoreBackup(f, setBusy);
            toast('Backup restaurado ✔');
          });
        }} />
      </div>

      <div className="card stack">
        <h3>Planilha (CSV)</h3>
        <p className="small">Exporta a lista de livros com status, nota, gêneros e datas — abre no Excel ou Google Planilhas.</p>
        <button className="secondary" disabled={!lib.books.length} onClick={() => run(async () => {
          const dates = new Map([...lib.meta].map(([id, m]) => [id, { start: m.startedAt, end: m.finishedAt }]));
          const csv = booksToCsv(lib.books, dates);
          await shareOrDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `nina-books-estante-${today()}.csv`);
        })}>📄 Exportar estante em CSV</button>

        <p className="small">
          <b>Importar</b> livros de uma planilha. Funciona com o CSV exportado do <b>Goodreads</b> (My Books › Import/Export)
          e com planilhas do <b>Skoob</b> ou feitas por você, desde que tenham colunas como “Título”, “Autor”, “ISBN”, “Páginas”, “Status”, “Nota”.
          Livros com ISBN repetido são pulados.
        </p>
        <button className="secondary" onClick={() => csvInput.current?.click()}>📥 Importar CSV</button>
        <input ref={csvInput} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          void run(async () => {
            setBusy('Lendo a planilha…');
            const rows = parseCsv(await f.text());
            if (!rows.length) throw new Error('Nenhum livro encontrado na planilha.');
            setBusy(`Importando ${rows.length} livros…`);
            const r = await importBooks(rows);
            toast(`${r.added} livros importados${r.skipped ? `, ${r.skipped} já existiam` : ''}`);
          });
        }} />
      </div>
    </div>
  );
}
