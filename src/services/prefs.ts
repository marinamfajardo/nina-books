import { db } from '../db';
import { getApiKey, getProvider, setApiKey, setProvider, type AIProvider } from './claude';
import { getGeminiKey, setGeminiKey } from './gemini';

/** Salva a escolha da IA e as chaves (neste aparelho e, com a sincronização, no outro também). */
export async function saveAIPrefs(p: { provider: AIProvider; geminiKey: string; claudeKey: string }) {
  setProvider(p.provider);
  setGeminiKey(p.geminiKey);
  setApiKey(p.claudeKey);
  await db.prefs.put({ id: 'ai', provider: p.provider, geminiKey: p.geminiKey.trim(), claudeKey: p.claudeKey.trim() });
}

/** Aplica as preferências que vieram do outro aparelho. */
export async function applySyncedPrefs() {
  const ai = await db.prefs.get('ai');
  if (!ai) {
    // primeira vez: guarda o que já existe aqui para ir para o outro aparelho
    if (getGeminiKey() || getApiKey()) await saveAIPrefs({ provider: getProvider(), geminiKey: getGeminiKey(), claudeKey: getApiKey() });
    return;
  }
  setProvider((ai.provider as AIProvider) ?? 'gemini');
  setGeminiKey(String(ai.geminiKey ?? ''));
  setApiKey(String(ai.claudeKey ?? ''));
}
