import type { Reading } from '../db';

export const BOOKS_PER_MEDAL = 5;

const MEDALS = [
  { emoji: '🥉', name: 'Primeiros capítulos' },
  { emoji: '🥈', name: 'Leitora dedicada' },
  { emoji: '🥇', name: 'Devoradora de livros' },
  { emoji: '🏅', name: 'Maratonista literária' },
  { emoji: '🎖️', name: 'Guardiã da estante' },
  { emoji: '🏆', name: 'Campeã das páginas' },
  { emoji: '🌹', name: 'Rosa de ouro' },
  { emoji: '💎', name: 'Leitora diamante' },
  { emoji: '👑', name: 'Rainha da biblioteca' },
  { emoji: '🌟', name: 'Lenda literária' },
];

export interface Medal {
  /** 5, 10, 15… */
  milestone: number;
  emoji: string;
  name: string;
  /** data em que o livro que completou a medalha foi terminado */
  earnedAt?: string;
}

export const medalFor = (milestone: number): Medal => {
  const i = milestone / BOOKS_PER_MEDAL - 1;
  const base = MEDALS[i % MEDALS.length];
  const round = Math.floor(i / MEDALS.length);
  return { milestone, emoji: base.emoji, name: round ? `${base.name} ${'✦'.repeat(round)}` : base.name };
};

/** Leituras concluídas em ordem (releituras também contam como livro lido). */
const finished = (readings: Reading[]) =>
  readings.filter((r) => r.outcome === 'concluida' && r.finishedAt).sort((a, b) => a.finishedAt!.localeCompare(b.finishedAt!));

export function medals(readings: Reading[]) {
  const done = finished(readings);
  const earned: Medal[] = [];
  for (let m = BOOKS_PER_MEDAL; m <= done.length; m += BOOKS_PER_MEDAL) {
    earned.push({ ...medalFor(m), earnedAt: done[m - 1].finishedAt });
  }
  const next = medalFor((earned.length + 1) * BOOKS_PER_MEDAL);
  return {
    read: done.length,
    earned,
    next,
    remaining: next.milestone - done.length,
    progressPct: Math.round(((done.length % BOOKS_PER_MEDAL) / BOOKS_PER_MEDAL) * 100),
  };
}

export interface RewardsState {
  /** maior medalha já comemorada (para mostrar a comemoração uma vez só) */
  celebrated: number;
  /** vales usados: medalha → livro comprado */
  redeemed: Record<string, { at: string; title?: string }>;
}

export const availableVouchers = (earned: Medal[], state: RewardsState) =>
  earned.filter((m) => !state.redeemed[String(m.milestone)]);
