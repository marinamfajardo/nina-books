import { addDays, today } from './stats';

/** Intervalo (dias) de cada caixa do sistema Leitner. */
export const BOX_INTERVALS = [0, 1, 2, 4, 8, 16, 32];
export const MAX_BOX = BOX_INTERVALS.length - 1;

/** Acertou: sobe uma caixa. Errou: volta para a caixa 1 e revê amanhã. */
export function review(box: number, correct: boolean, ref = today()) {
  const next = correct ? Math.min(MAX_BOX, box + 1) : 1;
  return { box: next, nextReview: addDays(ref, BOX_INTERVALS[next]) };
}

export const isDue = (nextReview: string, ref = today()) => nextReview <= ref;

function shuffle<T>(arr: T[], random: () => number) {
  const deck = [...arr];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Nova rodada de revisão: todas as palavras, cada uma uma vez.
 * Primeiro as que você errou na última resposta, depois as nunca revisadas e por fim
 * as que acertou — embaralhadas dentro de cada grupo. Evita começar pela palavra que acabou de sair.
 */
export function newRound<T extends { id: string; lastCorrect?: boolean }>(words: T[], lastId?: string, random = Math.random): T[] {
  const wrong = shuffle(words.filter((w) => w.lastCorrect === false), random);
  const fresh = shuffle(words.filter((w) => w.lastCorrect === undefined), random);
  const right = shuffle(words.filter((w) => w.lastCorrect === true), random);
  const groups = [wrong, fresh, right];
  const first = groups.find((g) => g.length);
  if (first && first.length > 1 && first[0].id === lastId) [first[0], first[1]] = [first[1], first[0]];
  return groups.flat();
}
