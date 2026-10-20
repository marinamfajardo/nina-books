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
