import { useState } from 'react';
import { useToast } from '../components/ui';
import { getApiKey, getProvider, type AIProvider } from '../services/claude';
import { getGeminiKey } from '../services/gemini';
import { saveAIPrefs } from '../services/prefs';

/** Escolha da IA (Gemini grátis ou Claude pago) e das chaves. */
export default function AISettings() {
  const toast = useToast();
  const [provider, setProv] = useState<AIProvider>(getProvider());
  const [gemini, setGemini] = useState(getGeminiKey());
  const [claude, setClaude] = useState(getApiKey());
  const [show, setShow] = useState(false);
  const key = provider === 'gemini' ? gemini : claude;

  const save = async (p = provider, g = gemini, c = claude) => {
    await saveAIPrefs({ provider: p, geminiKey: g, claudeKey: c });
    toast((p === 'gemini' ? g : c) ? 'IA configurada 🔒✨' : 'Chave removida');
  };

  return (
    <div className="card stack">
      <h3>✨ Inteligência artificial</h3>
      <p className="small">A IA lê a capa (título, autor e recorte), busca resumos, lê o texto das fotos e explica palavras do glossário.</p>

      <div className="summary-choice">
        <button className={provider === 'gemini' ? '' : 'secondary'} onClick={() => setProv('gemini')}>Gemini (Google)<br /><small>grátis</small></button>
        <button className={provider === 'claude' ? '' : 'secondary'} onClick={() => setProv('claude')}>Claude (Anthropic)<br /><small>pago</small></button>
      </div>

      {provider === 'gemini' ? (
        <div className="small stack">
          <p style={{ margin: 0 }}>
            Crie uma chave <b>gratuita</b> (só precisa de uma conta Google, sem cartão) em{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a> e cole aqui.
          </p>
          <p className="muted" style={{ margin: 0 }}>
            O plano gratuito tem um limite de usos por minuto e por dia — de sobra para cadastrar livros. No plano gratuito o Google pode usar
            o conteúdo enviado (fotos de capas, textos) para melhorar os serviços dele.
          </p>
        </div>
      ) : (
        <p className="small" style={{ margin: 0 }}>
          Crie uma chave em <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a> (o uso é cobrado por consumo) e cole aqui.
        </p>
      )}

      <div className="row nowrap">
        <input
          type={show ? 'text' : 'password'}
          placeholder={provider === 'gemini' ? 'AIza…' : 'sk-ant-…'}
          value={key}
          onChange={(e) => (provider === 'gemini' ? setGemini(e.target.value) : setClaude(e.target.value))}
          autoComplete="off" spellCheck={false} autoCapitalize="off"
        />
        <button className="icon" onClick={() => setShow(!show)} aria-label="Mostrar chave">{show ? '🙈' : '👁'}</button>
      </div>
      <div className="row">
        <button className="grow" onClick={() => save()}>Salvar</button>
        {key && (
          <button className="danger" onClick={() => {
            const g = provider === 'gemini' ? '' : gemini;
            const c = provider === 'claude' ? '' : claude;
            setGemini(g);
            setClaude(c);
            void save(provider, g, c);
          }}>Remover</button>
        )}
      </div>
      <p className="small muted">🔒 A chave fica guardada no aparelho (e na sua conta da nuvem, se a sincronização estiver ligada — assim você só cola uma vez).</p>
    </div>
  );
}
