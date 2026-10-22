/** Curiosidades sobre leitura com o estudo de origem (links para o artigo ou para a busca dele). */
/** short: frase curta usada na notificação da noite */
export interface Fact { text: string; short: string; source: string; url: string; note?: string }

const doi = (d: string) => `https://doi.org/${d}`;
const pubmed = (q: string) => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(q)}`;
const scholar = (q: string) => `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`;

export const FACTS: Fact[] = [
  {
    short: 'Ler ficção ajuda a entender o que os outros sentem — a base da empatia.',
    text: 'Ler ficção ajuda a entender o que os outros sentem e pensam: uma meta-análise de 14 experimentos encontrou um efeito positivo (pequeno, mas consistente) da ficção sobre a "cognição social" — a base da empatia.',
    source: 'Dodell-Feder & Tamir (2018), Journal of Experimental Psychology: General',
    url: doi('10.1037/xge0000395'),
  },
  {
    short: 'Ler ficção literária treina perceber emoções e intenções das pessoas.',
    text: 'Ler ficção literária, mesmo por poucos minutos, melhorou o desempenho em testes de "teoria da mente" (perceber emoções e intenções alheias).',
    source: 'Kidd & Castano (2013), Science',
    url: doi('10.1126/science.1239918'),
    note: 'Outros pesquisadores não conseguiram repetir o efeito imediato; a meta-análise de 2018 indica que ele existe, mas é pequeno.',
  },
  {
    short: 'Quem lê mais ficção tende a ter mais empatia e sensibilidade social.',
    text: 'Quem lê mais ficção tende a ter mais empatia e sensibilidade social — e quem lê muita não ficção, nem tanto. O estudo derrubou o mito do "leitor isolado".',
    source: 'Mar, Oatley e colegas (2006), Journal of Research in Personality — "Bookworms versus nerds"',
    url: doi('10.1016/j.jrp.2005.08.002'),
  },
  {
    short: 'Leitores de livros viveram, em média, mais: risco de morte ~20% menor em 12 anos.',
    text: 'Em 12 anos de acompanhamento de 3.635 adultos, quem lia livros teve risco de morte cerca de 20% menor que quem não lia — e o efeito apareceu já com cerca de 30 minutos por dia.',
    source: 'Bavishi, Slade & Levy (2016), Social Science & Medicine — "A chapter a day"',
    url: pubmed('A chapter a day: Association of book reading with longevity'),
    note: 'É uma associação (não prova que ler causa vida mais longa).',
  },
  {
    short: 'Ler um romance muda a conectividade do cérebro — e o efeito dura dias.',
    text: 'Ler um romance mudou a conectividade do cérebro em regiões ligadas à linguagem e às sensações do corpo — e parte da mudança continuou dias depois de terminar o livro.',
    source: 'Berns e colegas (2013), Brain Connectivity',
    url: doi('10.1089/brain.2013.0166'),
  },
  {
    short: 'Ler livro de papel em vez de tela à noite melhora o sono.',
    text: 'Ler em tela iluminada antes de dormir atrasou o sono, reduziu a melatonina e deixou as pessoas menos alertas na manhã seguinte, em comparação com ler um livro de papel.',
    source: 'Chang e colegas (2015), PNAS',
    url: doi('10.1073/pnas.1418490112'),
    note: 'Mais um motivo para trocar o celular pelo livro à noite 🌙',
  },
  {
    short: 'Ler por prazer está ligado a melhor saúde mental e mais horas de sono.',
    text: 'Crianças que começaram a ler por prazer cedo tiveram, na adolescência, melhor desempenho cognitivo, melhor saúde mental, menos tempo de tela e mais horas de sono (estudo com mais de 10 mil jovens).',
    source: 'Sun e colegas (2023), Psychological Medicine',
    url: doi('10.1017/S0033291723001381'),
    note: 'Associação observada; o estudo não prova causa e efeito.',
  },
  {
    short: 'Ler ao longo da vida está ligado a um declínio cognitivo mais lento.',
    text: 'Manter atividades mentais como ler e escrever ao longo da vida foi associado a um declínio cognitivo mais lento na velhice.',
    source: 'Wilson e colegas (2013), Neurology',
    url: pubmed('Life-span cognitive activity, neuropathologic burden, and cognitive aging Wilson 2013'),
  },
  {
    short: 'O hábito de ler amplia o vocabulário e a compreensão — e o efeito cresce com os anos.',
    text: 'O hábito de ler por lazer está ligado a um vocabulário maior e melhor compreensão de texto — e esse efeito vai crescendo da infância até a vida adulta.',
    source: 'Mol & Bus (2011), Psychological Bulletin',
    url: doi('10.1037/a0021890'),
  },
  {
    short: 'Ficção treina a mente a conviver com a ambiguidade e a incerteza.',
    text: 'Ler contos literários (em comparação com ensaios) diminuiu a necessidade de "certeza rápida" dos leitores — ficção treina a mente a conviver com ambiguidades.',
    source: 'Djikic, Oatley & Moldoveanu (2013), Creativity Research Journal',
    url: scholar('Djikic Oatley Moldoveanu 2013 Opening the closed mind: The effect of exposure to literature on the need for closure'),
  },
];

export const CHALLENGES = [
  'Leia 20 páginas hoje sem pegar no celular.',
  'Leia 15 minutos antes de dormir, com o celular em outro cômodo.',
  'Comece um livro de um gênero que você quase nunca lê.',
  'Escolha uma frase marcante de hoje e salve como citação.',
  'Leia um capítulo em voz alta.',
  'Termine o capítulo que você está lendo, mesmo que seja longo.',
  'Grave um áudio de 1 minuto contando o que achou da leitura de hoje.',
  'Leia ao ar livre ou perto de uma janela.',
  'Releia sua citação favorita e escreva por que ela importa para você.',
  'Leia 10 páginas logo ao acordar, antes de abrir qualquer rede social.',
  'Anote uma palavra nova no glossário.',
  'Leia por 30 minutos seguidos com o cronômetro do app.',
  'Recomende um livro que você amou para alguém hoje.',
  'Escolha o próximo livro da fila "Quero ler" e coloque ao lado da cama.',
];

export const QUESTIONS = [
  'Qual personagem você convidaria para jantar? Sobre o que conversariam?',
  'Que livro mudou o jeito como você vê o mundo?',
  'Se você pudesse viver dentro de um livro por um dia, qual seria?',
  'Qual final você reescreveria?',
  'Que livro você gostaria de ler de novo pela primeira vez?',
  'Qual personagem é mais parecido com você?',
  'Que frase de um livro você leva para a vida?',
  'Qual livro você daria de presente para a sua versão de 15 anos?',
  'Que livro te fez chorar? E rir?',
  'O que te faz abandonar um livro?',
  'Que lugar de um livro você gostaria de visitar?',
  'Qual foi a leitura mais surpreendente deste ano?',
];

export type Pill = { kind: 'curiosidade'; fact: Fact } | { kind: 'desafio'; text: string } | { kind: 'pergunta'; text: string };

/** Uma "pílula" diferente por dia, alternando curiosidade, desafio e pergunta. */
export function pillOfDay(date = new Date(), offset = 0): Pill {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000) + offset;
  const k = ((day % 3) + 3) % 3;
  const n = Math.floor(day / 3);
  if (k === 0) return { kind: 'curiosidade', fact: FACTS[n % FACTS.length] };
  if (k === 1) return { kind: 'desafio', text: CHALLENGES[n % CHALLENGES.length] };
  return { kind: 'pergunta', text: QUESTIONS[n % QUESTIONS.length] };
}

/** Primeira linha do lembrete das 21h. */
export const REMINDERS = [
  'Saia do celular e vá ler 📚',
  'Hora de ler! Seu livro está esperando 📖',
  'Troque a tela pelas páginas por 20 minutos 🌙',
  'Saia do celular e vá ler — uma página já conta ✨',
  'Seu cérebro agradece: hora da leitura 🧠📚',
];
