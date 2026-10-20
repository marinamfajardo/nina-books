# 📚 Nina Book's

Gerenciador pessoal de leituras: estante, classificação, sessões de leitura, estatísticas, metas, anotações em texto/áudio/vídeo, citações, fotos de páginas com OCR, glossário com flashcards, empréstimos, lista de desejos, backup e importação/exportação em CSV.

**Abrir o app:** https://marinamfajardo.github.io/nina-books/

## Como instalar no iPhone / iPad

1. Abra o endereço acima no **Safari**.
2. Toque no botão **Compartilhar** (quadrado com a seta ⬆️).
3. Escolha **Adicionar à Tela de Início** › **Adicionar**.
4. Abra o Nina Book's pelo ícone. Ele funciona em tela cheia e também sem internet.

> ⚠️ Os dados ficam **somente no aparelho**. Celular e iPad têm estantes separadas — use **Ajustes › Backup e CSV** para exportar de um e restaurar no outro.
> Não apague o ícone da tela de início sem fazer backup antes: no iOS isso apaga os dados.

## Onde configurar a chave da API (IA)

Os resumos com IA, a leitura de texto de fotos com IA e os significados do glossário usam o Claude (Anthropic).

1. Crie uma chave em https://console.anthropic.com/settings/keys (o uso é cobrado por consumo pela Anthropic).
2. No app: **Ajustes › Inteligência artificial (Claude)** › cole a chave › **Salvar chave**.

A chave fica guardada apenas no armazenamento local do aparelho e é enviada somente para a API da Anthropic. Ela nunca é colocada no código.
Sem chave, tudo funciona — exceto os recursos de IA. O OCR passa a ser feito no próprio aparelho (Tesseract).

## Tecnologia

O pedido original era um app nativo em React Native/Expo. Para instalar no iPhone/iPad **sem pagar a conta de desenvolvedor da Apple**, o projeto foi feito como **PWA** (aplicativo web instalável):

| Necessidade | Solução |
|---|---|
| Interface | React 19 + TypeScript + Vite, React Router (HashRouter) |
| Banco local | IndexedDB com **Dexie** (esquema versionado em `src/db.ts` — cada mudança vira uma nova `version()` com `upgrade()`) |
| Fotos, áudios, vídeos | Guardados como arquivos (Blob) na tabela `media` do banco, referenciados pelos registros |
| Código de barras | `@zxing/browser` (câmera traseira) |
| Áudio / vídeo | `MediaRecorder` (áudio com pausar/continuar) e câmera nativa para vídeo |
| OCR | Claude com visão (melhor com letra à mão) ou Tesseract.js no aparelho |
| Busca de livros | Google Books API, com Open Library como alternativa |
| IA | `@anthropic-ai/sdk` no navegador, com a ferramenta de busca na web para os resumos |
| Gráficos | Recharts |
| Offline | Service worker (vite-plugin-pwa / Workbox) |
| Backup | `.zip` com `data.json` + pasta `media/` (JSZip); CSV com PapaParse |

### Estrutura

```
src/
  db.ts                 modelo de dados e migrações
  domain/               regras puras (páginas, palavras, estatísticas, metas, filtros, flashcards) + testes
  data/                 ações no banco (status ⇄ leituras, sessões, importação) + hooks
  services/             APIs de livros, Claude, OCR, mídia, backup, CSV
  components/           componentes visuais (capa, estrelas, scanner, formulário)
  pages/                telas (Estante, Adicionar, Livro, Estatísticas, Glossário, Ajustes…)
```

### Regras de cálculo

- Páginas de uma sessão = página final − página inicial.
- Palavras = páginas × palavras por página (padrão 250, editável). Se o total de palavras do livro for informado, usa total ÷ nº de páginas.
- Ao marcar **Lido**, as páginas ainda não registradas entram como uma sessão na data de conclusão.
- Em **Desisti**, contam só as páginas registradas.
- **Relendo** abre uma nova leitura; o histórico de releituras fica guardado.

## Rodar no computador

Requer Node.js 20+.

```bash
npm install
npm run dev        # abre em http://localhost:5173/nina-books/
npm test           # testes de cálculo, filtros, CSV e banco
npm run build      # gera a pasta dist/
npm run deploy     # publica dist/ no branch gh-pages (GitHub Pages)
```

Para testar no celular na mesma rede Wi-Fi: `npm run dev -- --host` e abra o endereço “Network” no Safari. A câmera só funciona em HTTPS ou `localhost`, então para testar a câmera use o endereço publicado.
