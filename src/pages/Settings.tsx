import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/ui';
import type { ListKind } from '../db';
import { ensureListItems, renameListItem } from '../data/actions';
import { useList } from '../data/hooks';
import AISettings from './AISettings';
import { getOcrEngine, setOcrEngine, type OcrEngine } from '../services/ocr';
import { applyTheme, getTheme, type Theme } from '../theme';
import SyncSettings from './SyncSettings';

function ListManager({ kind, title }: { kind: ListKind; title: string }) {
  const items = useList(kind);
  const [name, setName] = useState('');
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{title} ({items.length})</summary>
      <form className="row nowrap mt" onSubmit={async (e) => { e.preventDefault(); if (name.trim()) { await ensureListItems(kind, [name]); setName(''); } }}>
        <input placeholder="Adicionar…" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="secondary">+</button>
      </form>
      <div className="mt">
        {items.map((i) => (
          <div key={i} className="row between nowrap" style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
            <span className="grow">{i}</span>
            <button className="icon small" onClick={async () => { const n = prompt('Novo nome:', i)?.trim(); if (n && n !== i) await renameListItem(kind, i, n); }}>✎</button>
            <button className="icon small" onClick={async () => { if (confirm(`Remover “${i}”? Ele sai também dos livros.`)) await renameListItem(kind, i, null); }}>✕</button>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function Settings() {
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const [ocr, setOcr] = useState<OcrEngine>(getOcrEngine());

  return (
    <div>
      <PageTitle>Configurações</PageTitle>

      <SyncSettings />

      <div className="card">
        <h3>Mais recursos</h3>
        <div className="group-grid">
          <Link to="/ranking" className="group-tile"><b>🏆 Ranking</b></Link>
          <Link to="/autores" className="group-tile"><b>✍️ Autores</b></Link>
          <Link to="/metas" className="group-tile"><b>🎯 Metas</b></Link>
          <Link to="/quero-ler" className="group-tile"><b>📌 Quero ler</b></Link>
          <Link to="/emprestimos" className="group-tile"><b>📤 Empréstimos</b></Link>
          <Link to="/desejos" className="group-tile"><b>🛍️ Desejos</b></Link>
          <Link to="/backup" className="group-tile"><b>💾 Backup e CSV</b></Link>
        </div>
      </div>

      <div className="card">
        <h3>Aparência</h3>
        <div className="chips">
          {([['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']] as [Theme, string][]).map(([t, l]) => (
            <button key={t} className={`chip${theme === t ? ' on' : ''}`} onClick={() => { applyTheme(t); setThemeState(t); }}>{l}</button>
          ))}
        </div>
      </div>

      <AISettings />

      <div className="card stack">
        <label className="field"><span>Leitura de texto das fotos (OCR)</span>
          <select value={ocr} onChange={(e) => { const v = e.target.value as OcrEngine; setOcr(v); setOcrEngine(v); }}>
            <option value="auto">Automático (IA quando estiver configurada e com internet)</option>
            <option value="aparelho">Sempre no aparelho (grátis, funciona offline após a 1ª vez)</option>
            <option value="claude">Sempre com a IA (melhor para letra à mão)</option>
          </select>
        </label>
      </div>

      <ListManager kind="genre" title="Gêneros" />
      <ListManager kind="language" title="Idiomas" />
      <ListManager kind="tag" title="Tags" />

      <div className="card small">
        <h3>Sobre</h3>
        <p><b>Nina Book's</b> — sua biblioteca pessoal. Os dados ficam guardados no aparelho e, se você conectar a sincronização, também na sua conta na nuvem.</p>
        <p className="muted">Dica: sem a sincronização, não apague o ícone do app da tela de início — isso apaga os dados.</p>
      </div>
    </div>
  );
}
