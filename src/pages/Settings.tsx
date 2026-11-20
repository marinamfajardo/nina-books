import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/ui';
import type { ListKind } from '../db';
import { useList } from '../data/hooks';
import { ListEditor } from '../components/ListEditor';
import AISettings from './AISettings';
import { getOcrEngine, setOcrEngine, type OcrEngine } from '../services/ocr';
import { applyTheme, getTheme, type Theme } from '../theme';
import SyncSettings from './SyncSettings';
import NotificationSettings from './NotificationSettings';

function ListManager({ kind, title }: { kind: ListKind; title: string }) {
  const items = useList(kind);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="card group-tile" style={{ width: '100%', color: 'inherit', fontWeight: 400 }} onClick={() => setOpen(true)}>
        <b>{title}</b><span className="muted">{items.length} ✎</span>
      </button>
      {open && <ListEditor kind={kind} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

export default function Settings() {
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const [ocr, setOcr] = useState<OcrEngine>(getOcrEngine());

  return (
    <div>
      <PageTitle>Configurações</PageTitle>

      <SyncSettings />
      <NotificationSettings />

      <div className="card">
        <h3>Mais recursos</h3>
        <div className="group-grid">
          <Link to="/conquistas" className="group-tile"><b>🏅 Conquistas</b></Link>
          <Link to="/citacoes" className="group-tile"><b>❝ Citações</b></Link>
          <Link to="/inspiracao" className="group-tile"><b>🧠 Inspiração</b></Link>
          <Link to="/retrospectiva" className="group-tile"><b>📖 Retrospectiva</b></Link>
          <Link to="/ranking" className="group-tile"><b>🏆 Ranking</b></Link>
          <Link to="/autores" className="group-tile"><b>✍️ Autores / grupos</b></Link>
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
      <ListManager kind="location" title="Locais (onde ficam os livros)" />

      <div className="card small">
        <h3>Sobre</h3>
        <p><b>Nina Book's</b> — sua biblioteca pessoal. Os dados ficam guardados no aparelho e, se você conectar a sincronização, também na sua conta na nuvem.</p>
        <p className="muted">Dica: sem a sincronização, não apague o ícone do app da tela de início — isso apaga os dados.</p>
      </div>
    </div>
  );
}
