/** Ângulo (graus) de cada fatia da roleta. */
export const sliceAngle = (n: number) => 360 / Math.max(1, n);

/**
 * Rotação final para a fatia `index` parar embaixo do ponteiro (no topo),
 * dando `turns` voltas completas a partir da rotação atual.
 */
export function spinTarget(current: number, index: number, n: number, turns = 5) {
  const seg = sliceAngle(n);
  const center = (index + 0.5) * seg; // centro da fatia, medido a partir do topo no sentido horário
  const base = current - (((current % 360) + 360) % 360); // volta ao "zero" da volta atual
  return base + 360 * turns + (360 - center);
}

/** Qual fatia está no topo para uma rotação. */
export function sliceAtTop(rotation: number, n: number) {
  const seg = sliceAngle(n);
  const a = (((360 - (rotation % 360)) % 360) + 360) % 360;
  return Math.floor(a / seg) % n;
}

interface WheelBook { id: string; title: string; status: string; series?: string; seriesNumber?: number; wantPriority?: number }
export interface WheelEntry<B> { book: B; label: string; series?: string }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * O que entra na roleta: livros avulsos da fila "Quero ler" e, de cada saga,
 * só o próximo volume ainda não lido (se ele estiver na fila).
 * Se algum volume da saga está sendo lido agora, a saga fica de fora.
 */
export function wheelEntries<B extends WheelBook>(allBooks: B[]): WheelEntry<B>[] {
  const entries: WheelEntry<B>[] = [];
  const series = new Map<string, B[]>();
  for (const b of allBooks) {
    if (b.series?.trim()) {
      const k = norm(b.series);
      if (!series.has(k)) series.set(k, []);
      series.get(k)!.push(b);
    } else if (b.status === 'quero_ler') {
      entries.push({ book: b, label: b.title });
    }
  }
  for (const vols of series.values()) {
    if (vols.some((b) => b.status === 'lendo' || b.status === 'relendo')) continue;
    const ordered = [...vols].sort((a, b) => (a.seriesNumber ?? 999) - (b.seriesNumber ?? 999) || a.title.localeCompare(b.title, 'pt-BR'));
    const next = ordered.find((b) => b.status !== 'lido' && b.status !== 'desisti');
    if (!next || next.status !== 'quero_ler') continue;
    entries.push({ book: next, series: next.series, label: `${next.series}${next.seriesNumber ? ` ${next.seriesNumber}` : ''}` });
  }
  return entries;
}
