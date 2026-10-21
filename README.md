# 📚 Nina Book's

Gerenciador pessoal de leituras: estante, classificação, sessões de leitura, estatísticas, metas, anotações em texto/áudio/vídeo, citações, fotos de páginas com OCR, glossário com flashcards, empréstimos, lista de desejos, backup e importação/exportação em CSV.

**Abrir o app:** https://marinamfajardo.github.io/nina-books/

## Como instalar no iPhone / iPad

1. Abra o endereço acima no **Safari**.
2. Toque no botão **Compartilhar** (quadrado com a seta ⬆️).
3. Escolha **Adicionar à Tela de Início** › **Adicionar**.
4. Abra o Nina Book's pelo ícone. Ele funciona em tela cheia e também sem internet.

## Mesma estante no celular e no iPad (sincronização)

Os dados ficam no aparelho (o app funciona offline) e, com a sincronização ligada, também numa conta gratuita do **Supabase**. Tudo o que é feito num aparelho aparece no outro: livros, sessões, anotações, citações, glossário, metas e também fotos, áudios e vídeos.

**Preparar a nuvem (uma vez só):**

1. Crie uma conta em https://supabase.com (pode entrar com o GitHub) e um projeto novo (plano Free).
2. No projeto, abra **SQL Editor**, cole o conteúdo de [`supabase/setup.sql`](supabase/setup.sql) e clique em **Run**.
3. Em **Authentication › Sign In / Providers › Email**, desligue **Confirm email** (opcional, simplifica o primeiro acesso).
4. Em **Project Settings › API** copie a **Project URL** e a chave **anon / publishable**.

**Em cada aparelho:** Ajustes › *Mesma estante no celular e no iPad* › cole a URL e a chave › **Salvar projeto**.
No primeiro aparelho toque em **Criar conta**; no outro, **Entrar** com o mesmo e-mail e senha.
Depois de criar a conta, desligue **Allow new users to sign up** (Authentication › Sign In / Providers) para ninguém mais usar o seu projeto.

Como funciona: toda gravação local entra numa fila (`_outbox`, via middleware do Dexie). O app envia a fila e depois baixa o que mudou na nuvem (tabela única `records`, protegida por RLS), ao abrir, ao voltar para o app, a cada 30 s e logo após mudanças. Arquivos vão para o Storage (`media/<usuária>/<id>`) e são baixados no outro aparelho quando aparecem na tela. Limites do plano gratuito: 50 MB por arquivo e 1 GB no total; projetos sem uso por 7 dias são pausados (reative no painel do Supabase).

> Sem a sincronização, os dados ficam só no aparelho: use **Ajustes › Backup e CSV** e não apague o ícone da tela de início sem backup (no iOS isso apaga os dados).

## Onde configurar a IA

A leitura da capa (título, autor e recorte), os resumos, a leitura de texto de fotos e os significados do glossário usam IA. Em **Ajustes › Inteligência artificial** escolha:

- **Gemini (Google) — grátis:** crie a chave em https://aistudio.google.com/apikey (só precisa de conta Google, sem cartão). O plano gratuito tem limite de usos por minuto/dia e o Google pode usar o conteúdo enviado para melhorar os serviços. Se a busca no Google não estiver liberada para a chave, o resumo é feito sem pesquisa (o app avisa).
- **Claude (Anthropic) — pago:** chave em https://console.anthropic.com/settings/keys, cobrada por consumo.

A chave fica no aparelho e, com a sincronização ligada, vai junto para o outro aparelho (fica na sua conta, protegida). Ela nunca é colocada no código.
Sem IA, tudo funciona: no cadastro você ajusta o recorte da capa e digita título e autor; o OCR é feito no próprio aparelho (Tesseract).

## Tecnologia

O pedido original era um app nativo em React Native/Expo. Para instalar no iPhone/iPad **sem pagar a conta de desenvolvedor da Apple**, o projeto foi feito como **PWA** (aplicativo web instalável):

| Necessidade | Solução |
|---|---|
| Interface | React 19 + TypeScript + Vite, React Router (HashRouter) |
| Banco local | IndexedDB com **Dexie** (esquema versionado em `src/db.ts` — cada mudança vira uma nova `version()` com `upgrade()`) |
| Fotos, áudios, vídeos | Guardados como arquivos (Blob) na tabela `media` do banco, referenciados pelos registros |
| Cadastro por foto | Foto da capa → IA (Claude com visão) acha os cantos e lê título/autor → recorte com correção de perspectiva no aparelho (`src/domain/perspective.ts`), cantos ajustáveis com o dedo |
| Áudio / vídeo | `MediaRecorder` (áudio com pausar/continuar) e câmera nativa para vídeo |
| OCR | Claude com visão (melhor com letra à mão) ou Tesseract.js no aparelho |
| Resumo e dados do livro | Claude com busca na web (resumo, editora, ano, páginas), ou resumo escrito pela leitora |
| IA | Gemini (`gemini-flash-latest`, REST, com Google Search) ou Claude (`@anthropic-ai/sdk`, com busca na web) — escolha em Ajustes |
| Gráficos | Recharts |
| Offline | Service worker (vite-plugin-pwa / Workbox) |
| Backup | `.zip` com `data.json` + pasta `media/` (JSZip); CSV com PapaParse |
| Sincronização | Supabase (Postgres + Auth + Storage), fila local com middleware do Dexie |
| Citações por voz | Reconhecimento de fala do navegador (Web Speech API), no idioma do livro |

### Estrutura

```
src/
  db.ts                 modelo de dados e migrações
  domain/               regras puras (páginas, palavras, estatísticas, metas, filtros, flashcards) + testes
  data/                 ações no banco (status ⇄ leituras, sessões, importação) + hooks
  services/             APIs de livros, Claude, OCR, mídia, backup, CSV
  sync/                 sincronização entre aparelhos (fila, motor, Supabase)
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
