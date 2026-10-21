import type { AskParams, AskResult } from './claude';

/**
 * Gemini (Google AI Studio). A chave gratuita é criada em https://aistudio.google.com/apikey
 * e fica só neste aparelho. "gemini-flash-latest" aponta sempre para o Flash mais recente.
 */
const KEY = 'nina.geminiKey';
const MODEL = 'gemini-flash-latest';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const getGeminiKey = () => localStorage.getItem(KEY) ?? '';
export const setGeminiKey = (k: string) => (k ? localStorage.setItem(KEY, k.trim()) : localStorage.removeItem(KEY));

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

function toParts(content: AskParams['content']): Part[] {
  if (typeof content === 'string') return [{ text: content }];
  return content.flatMap((b): Part[] => {
    if (b.type === 'text') return [{ text: b.text }];
    if (b.type === 'image' && b.source.type === 'base64') return [{ inline_data: { mime_type: b.source.media_type, data: b.source.data } }];
    return [];
  });
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
    groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

function errorMessage(status: number, body: GeminiResponse) {
  const m = body.error?.message ?? '';
  if (/API key not valid|API_KEY_INVALID/i.test(m) || status === 401) return 'Chave do Gemini inválida. Confira em Ajustes.';
  if (status === 429 || body.error?.status === 'RESOURCE_EXHAUSTED') return 'Limite gratuito do Gemini atingido por agora. Espere alguns minutos (ou até amanhã) e tente de novo.';
  if (status === 403) return 'A chave do Gemini não tem permissão. Crie uma nova em aistudio.google.com/apikey.';
  if (/location is not supported|not available in your country/i.test(m)) return 'O Gemini gratuito não está disponível na sua região.';
  return `O Gemini respondeu com erro (${status}). Tente novamente.`;
}

async function call(params: AskParams, withSearch: boolean) {
  const key = getGeminiKey();
  if (!key) throw new Error('Configure a chave gratuita do Gemini em Ajustes para usar a IA.');
  const body = {
    systemInstruction: { parts: [{ text: params.system }] },
    contents: [{ role: 'user', parts: toParts(params.content) }],
    ...(withSearch ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: { maxOutputTokens: Math.max(params.maxTokens ?? 8000, 2048) },
  };
  let res: Response;
  try {
    res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Não foi possível falar com o Gemini. Verifique sua internet.');
  }
  const json = (await res.json().catch(() => ({}))) as GeminiResponse;
  return { ok: res.ok, status: res.status, json };
}

export async function askGemini(params: AskParams): Promise<AskResult> {
  let searched = !!params.webSearch;
  let r = await call(params, searched);
  // Se a busca no Google não estiver liberada para a chave gratuita, tenta sem a busca.
  if (!r.ok && searched && r.status !== 401 && !/API key not valid/i.test(r.json.error?.message ?? '')) {
    searched = false;
    r = await call(params, false);
  }
  if (!r.ok) throw new Error(errorMessage(r.status, r.json));
  if (r.json.promptFeedback?.blockReason) throw new Error('A IA não pôde responder a esse pedido.');
  const cand = r.json.candidates?.[0];
  const text = (cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('').trim();
  const seen = new Map<string, string>();
  for (const c of cand?.groundingMetadata?.groundingChunks ?? []) if (c.web?.uri) seen.set(c.web.uri, c.web.title ?? c.web.uri);
  return { text, sources: [...seen].slice(0, 8).map(([url, title]) => ({ url, title })), searched: searched && seen.size > 0 };
}
