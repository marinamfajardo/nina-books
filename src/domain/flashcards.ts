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

/**
 * Nova rodada de revisão: todas as palavras, embaralhadas, cada uma uma vez.
 * Evita que a primeira da rodada seja a mesma que acabou de sair.
 */
export function newRound<T extends { id: string }>(words: T[], lastId?: string, random = Math.random): T[] {
  const deck = [...words];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  if (deck.length > 1 && deck[0].id === lastId) [deck[0], deck[1]] = [deck[1], deck[0]];
  return deck;
}
