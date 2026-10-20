import Anthropic from '@anthropic-ai/sdk';
import type { Book } from '../db';

const KEY_STORAGE = 'nina.anthropicKey';
const MODEL = 'claude-opus-5-5';

// A chave fica só neste aparelho (armazenamento local do app). Nunca vai no código.
export const getApiKey = () => localStorage.getItem(KEY_STORAGE) ?? '';
export const setApiKey = (key: string) =>
  key ? localStorage.setItem(KEY_STORAGE, key.trim()) : localStorage.removeItem(KEY_STORAGE);
export const hasApiKey = () => !!getApiKey();

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

async function ask(params: {
  system: string;
  content: Anthropic.Messages.MessageParam['content'];
  webSearch?: boolean;
  maxTokens?: number;
}) {
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
  const { text, blocks } = await ask({
    webSearch: true,
    system:
      'Você ajuda uma leitora a organizar sua biblioteca pessoal. Escreva sempre em português do Brasil, ' +
      'em tom acolhedor e claro. Use a busca na web para confirmar os fatos sobre o livro antes de escrever.',
    content:
      `Pesquise o livro ${desc} e escreva um resumo dele em 3 a 5 parágrafos: premissa, temas principais, ` +
      'estilo e contexto da obra. Avise com "⚠️ Contém spoilers" antes de revelar o final, se for o caso. ' +
      'Responda só com o resumo, sem títulos nem lista de fontes.',
  });
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
  if (!text) throw new AIError('A IA não conseguiu gerar o resumo. Tente novamente.');
  return { text, sources: [...sources].slice(0, 8).map(([url, title]) => ({ url, title })) };
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

/** Lê título e autor de uma foto de capa. */
export async function readCover(b64: string, mediaType: string) {
  const { text } = await ask({
    system: 'Você identifica livros a partir de fotos de capa.',
    maxTokens: 2000,
    content: [
      imageBlock(b64, mediaType),
      { type: 'text', text: 'Qual é o título e o autor deste livro? Responda numa única linha no formato: título | autor' },
    ],
  });
  const [title, author] = text.split('|').map((s) => s.trim());
  return { title: title ?? '', author: author ?? '' };
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
