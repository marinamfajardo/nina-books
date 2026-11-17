/** Como o livro me fez sentir. */
export const FEELINGS: { emoji: string; label: string }[] = [
  { emoji: '😍', label: 'Apaixonada' },
  { emoji: '🥹', label: 'Tocada' },
  { emoji: '😭', label: 'Chorei' },
  { emoji: '💔', label: 'Coração partido' },
  { emoji: '🥰', label: 'Acolhida' },
  { emoji: '😌', label: 'Em paz' },
  { emoji: '😂', label: 'Ri muito' },
  { emoji: '✨', label: 'Inspirada' },
  { emoji: '🤔', label: 'Reflexiva' },
  { emoji: '🤯', label: 'Impressionada' },
  { emoji: '😱', label: 'Tensa' },
  { emoji: '😰', label: 'Ansiosa' },
  { emoji: '😢', label: 'Triste' },
  { emoji: '😡', label: 'Revoltada' },
  { emoji: '😴', label: 'Entediada' },
];
export const feelingLabel = (e: string) => FEELINGS.find((f) => f.emoji === e)?.label ?? e;

/** Quantas vezes cada sentimento aparece nos livros. */
export function countFeelings(books: { feelings?: string[] }[]) {
  const m = new Map<string, number>();
  for (const b of books) for (const e of b.feelings ?? []) m.set(e, (m.get(e) ?? 0) + 1);
  return [...m].map(([emoji, count]) => ({ emoji, label: feelingLabel(emoji), count })).sort((a, b) => b.count - a.count);
}
