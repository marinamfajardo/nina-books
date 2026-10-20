import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle, useToast } from '../components/ui';
import type { ListKind } from '../db';
import { ensureListItems, renameListItem } from '../data/actions';
import { useList } from '../data/hooks';
import { getApiKey, setApiKey } from '../services/claude';
import { getOcrEngine, setOcrEngine, type OcrEngine } from '../services/ocr';
import { applyTheme, getTheme, type Theme } from '../theme';

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
  const toast = useToast();
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const [key, setKey] = useState(getApiKey());
  const [show, setShow] = useState(false);
  const [ocr, setOcr] = useState<OcrEngine>(getOcrEngine());

  return (
    <div>
      <PageTitle>Configurações</PageTitle>

      <div className="card">
        <h3>Mais recursos</h3>
        <div className="group-grid">
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

      <div className="card stack">
        <h3>Inteligência artificial (Claude)</h3>
        <p className="small">
          A IA gera resumos, lê o texto das fotos e explica palavras do glossário. Para usar, crie uma chave em{' '}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a>{' '}
          (o uso é cobrado pela Anthropic, por consumo) e cole aqui.
        </p>
        <div className="row nowrap">
          <input type={show ? 'text' : 'password'} placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
          <button className="icon" onClick={() => setShow(!show)} aria-label="Mostrar chave">{show ? '🙈' : '👁'}</button>
        </div>
        <div className="row">
          <button className="grow" onClick={() => { setApiKey(key); toast(key ? 'Chave salva neste aparelho 🔒' : 'Chave removida'); }}>Salvar chave</button>
          {getApiKey() && <button className="danger" onClick={() => { setApiKey(''); setKey(''); toast('Chave removida'); }}>Remover</button>}
        </div>
        <p className="small muted">🔒 A chave fica guardada só neste aparelho e é enviada apenas para a Anthropic.</p>

        <label className="field"><span>Leitura de texto das fotos (OCR)</span>
          <select value={ocr} onChange={(e) => { const v = e.target.value as OcrEngine; setOcr(v); setOcrEngine(v); }}>
            <option value="auto">Automático (IA quando houver chave e internet)</option>
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
        <p><b>Nina Book's</b> — sua biblioteca pessoal. Todos os livros, fotos, áudios e vídeos ficam guardados <b>somente neste aparelho</b>.</p>
        <p className="muted">Dica: não apague o ícone do app da tela de início — isso apaga os dados. Faça backups de vez em quando.</p>
      </div>
    </div>
  );
}
