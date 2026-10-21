import Anthropic from '@anthropic-ai/sdk';
import type { Book } from '../db';

import { askGemini, getGeminiKey } from './gemini';

const KEY_STORAGE = 'nina.anthropicKey';
const PROVIDER_KEY = 'nina.aiProvider';
const MODEL = 'claude-opus-5-5';

/** Qual IA o app usa: Gemini (Google, tem uso gratuito) ou Claude (Anthropic, pago). */
export type AIProvider = 'gemini' | 'claude';
export const getProvider = (): AIProvider => (localStorage.getItem(PROVIDER_KEY) as AIProvider) || 'gemini';
export const setProvider = (p: AIProvider) => localStorage.setItem(PROVIDER_KEY, p);

// As chaves ficam só neste aparelho (armazenamento local do app). Nunca vão no código.
export const getApiKey = () => localStorage.getItem(KEY_STORAGE) ?? '';
export const setApiKey = (key: string) =>
  key ? localStorage.setItem(KEY_STORAGE, key.trim()) : localStorage.removeItem(KEY_STORAGE);
/** Há uma IA pronta para usar (chave da IA escolhida). */
export const hasApiKey = () => (getProvider() === 'gemini' ? !!getGeminiKey() : !!getApiKey());

export class AIError extends Error {}

function client() {
  const apiKey = getApiKey();
  if (!apiKey) throw new AIError('Configure sua chave da API do Claude em Configurações para usar a IA.');
  if (!navigator.onLine) throw new AIError('Sem internet. A IA precisa de conexão.');
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

function friendly(e: unknown): never {
  if (e instanceof AIError) throw e;
  if (e instanceof Anthropic.AuthenticationError) throw new AIError('Chave da API inválida. Confira em Configurações.');
  if (e instanceof Anthropic.PermissionDeniedError) throw new AIError('Sua chave não tem permissão para esse recurso.');
  if (e instanceof Anthropic.RateLimitError) throw new AIError('Muitas solicitações seguidas. Aguarde um minuto e tente de novo.');
  if (e instanceof Anthropic.APIConnectionError) throw new AIError('Não foi possível falar com a IA. Verifique sua internet.');
  if (e instanceof Anthropic.APIError) {
    if (e.status === 402 || /credit/i.test(e.message)) throw new AIError('Sem créditos na conta da Anthropic. Adicione créditos no console.anthropic.com.');
    throw new AIError(`A IA respondeu com erro (${e.status ?? '?'}). Tente novamente.`);
  }
  throw new AIError('Erro inesperado ao usar a IA.');
}

type Block = Anthropic.Messages.ContentBlock;
const textOf = (content: Block[]) =>
  content.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text').map((b) => b.text).join('').trim();

export interface AskParams {
  system: string;
  content: Anthropic.Messages.MessageParam['content'];
  webSearch?: boolean;
  maxTokens?: number;
}
export interface AskResult { text: string; sources: { title: string; url: string }[]; searched: boolean }

/** Pergunta à IA escolhida em Ajustes. */
async function ask(params: AskParams): Promise<AskResult> {
  if (!navigator.onLine) throw new AIError('Sem internet. A IA precisa de conexão.');
  if (getProvider() === 'gemini') {
    try {
      return await askGemini(params);
    } catch (e) {
      throw new AIError((e as Error).message);
    }
  }
  const { text, blocks } = await askClaude(params);
  return { text, sources: collectSources(blocks), searched: !!params.webSearch };
}

async function askClaude(params: AskParams) {
  const c = client();
  const tools: Anthropic.Messages.ToolUnion[] | undefined = params.webSearch
    ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 } as unknown as Anthropic.Messages.ToolUnion]
    : undefined;
  const messages: Anthropic.Messages.MessageParam[] = [{ role: 'user', content: params.content }];
  const all: Block[] = [];
  try {
    // A busca na web pode pausar o turno (pause_turn); continuamos até terminar.
    for (let i = 0; i < 4; i++) {
      // fallbacks "default": se um filtro de segurança recusar, o servidor tenta outro modelo.
      const stream = c.beta.messages.stream({
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        model: MODEL,
        max_tokens: params.maxTokens ?? 8000,
        system: params.system,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        tools,
        messages,
      } as unknown as Anthropic.Beta.Messages.MessageCreateParamsStreaming);
      const msg = (await stream.finalMessage()) as unknown as Anthropic.Messages.Message;
      all.push(...msg.content);
      if (msg.stop_reason === 'refusal') throw new AIError('A IA não pôde responder a esse pedido.');
      if (msg.stop_reason !== 'pause_turn') return { text: textOf(msg.content), blocks: all };
      messages.push({ role: 'assistant', content: msg.content });
    }
    return { text: textOf(all), blocks: all };
  } catch (e) {
    friendly(e);
  }
}

/** Resumo do livro em português, pesquisado na web, com as fontes usadas. */
export async function generateSummary(book: Pick<Book, 'title' | 'authors' | 'year' | 'isbn'>) {
  const desc = `"${book.title}"${book.authors.length ? ` de ${book.authors.join(', ')}` : ''}${book.year ? ` (${book.year})` : ''}${book.isbn ? `, ISBN ${book.isbn}` : ''}`;
  const { text, sources } = await ask({
    webSearch: true,
    system:
      'Você ajuda uma leitora a organizar sua biblioteca pessoal. Escreva sempre em português do Brasil, ' +
      'em tom acolhedor e claro. Use a busca na web para confirmar os fatos sobre o livro antes de escrever.',
    content:
      `Pesquise o livro ${desc} e escreva um resumo dele em 3 a 5 parágrafos: premissa, temas principais, ` +
      'estilo e contexto da obra. Avise com "⚠️ Contém spoilers" antes de revelar o final, se for o caso. ' +
      'Responda só com o resumo, sem títulos nem lista de fontes.',
  });
  if (!text) throw new AIError('A IA não conseguiu gerar o resumo. Tente novamente.');
  return { text, sources };
}

function collectSources(blocks: Block[]) {
  const sources = new Map<string, string>();
  for (const b of blocks) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) if (r.type === 'web_search_result') sources.set(r.url, r.title);
    }
    if (b.type === 'text') {
      for (const cit of b.citations ?? []) {
        if (cit.type === 'web_search_result_location') sources.set(cit.url, cit.title ?? cit.url);
      }
    }
  }
  return [...sources].slice(0, 8).map(([url, title]) => ({ url, title }));
}

const imageBlock = (b64: string, mediaType: string) => ({
  type: 'image' as const,
  source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg', data: b64 },
});

/** Transcreve o texto de uma foto de página (inclusive letra à mão). */
export async function ocrWithClaude(b64: string, mediaType: string) {
  const { text } = await ask({
    system: 'Você transcreve fotos de páginas de livros com fidelidade.',
    content: [
      imageBlock(b64, mediaType),
      {
        type: 'text',
        text:
          'Transcreva exatamente o texto desta foto, mantendo parágrafos. Inclua anotações à mão nas margens ' +
          'entre [colchetes]. Não comente nem traduza. Se não houver texto legível, responda apenas: (sem texto legível)',
      },
    ],
  });
  return text === '(sem texto legível)' ? '' : text;
}

/** Extrai o primeiro objeto JSON de uma resposta de texto. */
function parseJson<T>(text: string): T | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

export interface CoverAnalysis {
  title: string;
  authors: string[];
  /** Cantos da capa em frações (0–1) da largura/altura: sup-esq, sup-dir, inf-dir, inf-esq */
  corners: [number, number][] | null;
}

/** Lê título e autor e localiza os cantos da capa na foto. */
export async function analyzeCover(b64: string, mediaType: string): Promise<CoverAnalysis> {
  const { text } = await ask({
    system: 'Você identifica livros a partir de fotos e localiza a capa na imagem com precisão.',
    maxTokens: 4000,
    content: [
      imageBlock(b64, mediaType),
      {
        type: 'text',
        text:
          'Esta é a foto de um livro. Responda só com JSON neste formato:\n' +
          '{"titulo": "...", "autores": ["..."], "cantos": [[x,y],[x,y],[x,y],[x,y]]}\n' +
          '- titulo e autores: exatamente como aparecem na capa (sem inventar; use "" ou [] se não der para ler).\n' +
          '- cantos: os 4 cantos da CAPA do livro (só a capa da frente, sem o fundo, a mesa ou a mão), na ordem ' +
          'superior esquerdo, superior direito, inferior direito, inferior esquerdo, com x e y como frações de 0 a 1 ' +
          'da largura e da altura da foto. Use null se não encontrar a capa.',
      },
    ],
  });
  const j = parseJson<{ titulo?: string; autores?: string[] | string; cantos?: [number, number][] | null }>(text);
  if (!j) throw new AIError('A IA não conseguiu ler a capa. Preencha o título e o autor à mão.');
  const authors = Array.isArray(j.autores) ? j.autores : j.autores ? [j.autores] : [];
  const ok = Array.isArray(j.cantos) && j.cantos.length === 4 &&
    j.cantos.every((p) => Array.isArray(p) && p.every((v) => typeof v === 'number' && v >= -0.05 && v <= 1.05));
  return {
    title: (j.titulo ?? '').trim(),
    authors: authors.map((a) => a.trim()).filter(Boolean),
    corners: ok ? j.cantos!.map(([x, y]) => [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))] as [number, number]) : null,
  };
}

export interface BookResearch {
  summary: string;
  /** false quando a IA não conseguiu pesquisar na internet e escreveu só com o que sabe */
  searchedWeb: boolean;
  sources: { title: string; url: string }[];
  publisher?: string;
  year?: number;
  pageCount?: number;
  originalLanguage?: string;
  synopsis?: string;
}

/** Pesquisa o livro na internet: resumo em português e dados da edição. */
export async function researchBook(title: string, authors: string[]): Promise<BookResearch> {
  const desc = `"${title}"${authors.length ? ` de ${authors.join(', ')}` : ''}`;
  const { text, sources, searched } = await ask({
    webSearch: true,
    system:
      'Você ajuda uma leitora a organizar sua biblioteca pessoal. Escreva sempre em português do Brasil, ' +
      'em tom acolhedor e claro. Use a busca na web para confirmar os fatos sobre o livro antes de escrever.',
    content:
      `Pesquise o livro ${desc}. Depois responda só com JSON neste formato:\n` +
      '{"resumo": "...", "editora": "...", "ano": 0, "paginas": 0, "idioma_original": "...", "sinopse": "..."}\n' +
      '- resumo: 3 a 5 parágrafos (separados por \\n\\n) sobre premissa, temas, estilo e contexto da obra; ' +
      'avise "⚠️ Contém spoilers" antes de revelar o final, se for o caso.\n' +
      '- editora, ano e paginas: da edição brasileira, se existir; senão da original. Use null se não souber.\n' +
      '- idioma_original em português (ex.: "Inglês"). sinopse: a sinopse oficial curta, se encontrar, senão null.',
  });
  const j = parseJson<{ resumo?: string; editora?: string | null; ano?: number | null; paginas?: number | null; idioma_original?: string | null; sinopse?: string | null }>(text);
  const summary = (j?.resumo ?? (j ? '' : text)).trim();
  if (!summary) throw new AIError('A IA não encontrou informações sobre esse livro. Você pode escrever o resumo.');
  return {
    summary,
    sources,
    searchedWeb: searched,
    publisher: j?.editora || undefined,
    year: j?.ano && j.ano > 0 ? j.ano : undefined,
    pageCount: j?.paginas && j.paginas > 0 ? j.paginas : undefined,
    originalLanguage: j?.idioma_original || undefined,
    synopsis: j?.sinopse || undefined,
  };
}

/** Significado de uma palavra para o glossário. */
export async function defineWord(word: string, language?: string, example?: string, bookTitle?: string) {
  const { text } = await ask({
    system: 'Você é um dicionário bilíngue que explica palavras para uma leitora brasileira. Responda em português do Brasil, de forma curta.',
    maxTokens: 2000,
    content:
      `Palavra: "${word}"${language ? ` (idioma: ${language})` : ''}.` +
      (example ? ` Frase onde apareceu: "${example}".` : '') +
      (bookTitle ? ` Livro: ${bookTitle}.` : '') +
      ' Dê o significado nesse contexto em 1 a 3 frases e, se for de outro idioma, a tradução. Sem títulos.',
  });
  return text;
}
