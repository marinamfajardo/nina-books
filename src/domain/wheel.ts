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
