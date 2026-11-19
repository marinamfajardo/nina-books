/**
 * Avaliação em meias estrelas: 0 = sem nota; 1–10 = ½ a 5 estrelas;
 * 11–14 = acima de 5 (até 7 estrelas); −1 e −2 = −½ e −1 estrela.
 */
export const MIN_RATING = -2;
export const MAX_RATING = 14;
export const NORMAL_MAX = 10;

export const isRated = (r: number) => r !== 0;
export const clampRating = (r: number) => Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(r)));

/** "4,5", "−½", "6" … */
export function ratingLabel(r: number) {
  if (r === -1) return '−½';
  const v = Math.abs(r) / 2;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
  return r < 0 ? `−${s}` : s;
}

export const ratingTitle = (r: number) =>
  r === 0 ? 'Sem nota' : `${ratingLabel(r)} estrela${Math.abs(r) > 2 ? 's' : ''}${r > NORMAL_MAX ? ' ✨' : ''}`;

/** Agrupa livros pela nota, da maior para a menor (negativas no fim, sem nota por último). */
export function ratingSections<T extends { rating: number; title: string }>(items: T[]) {
  const by = new Map<number, T[]>();
  for (const it of items) {
    if (!by.has(it.rating)) by.set(it.rating, []);
    by.get(it.rating)!.push(it);
  }
  const keys = [...by.keys()].filter((k) => k !== 0).sort((a, b) => b - a);
  if (by.has(0)) keys.push(0);
  return keys.map((k) => ({ rating: k, title: ratingTitle(k), items: by.get(k)!.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')) }));
}

/** Favorito: marcado com ❤️ ou com nota de 5 estrelas ou mais. */
export const isFavoriteBook = (b: { favorite: boolean; rating: number }) => b.favorite || b.rating >= NORMAL_MAX;
