import { describe, expect, it } from 'vitest';
import { applyH, homography, orderCorners, outputSize, type Point } from './perspective';

describe('recorte em perspectiva', () => {
  it('leva os cantos do retângulo exatamente nos cantos da capa', () => {
    const rect: Point[] = [[0, 0], [100, 0], [100, 150], [0, 150]];
    const quad: Point[] = [[12, 20], [118, 8], [130, 170], [5, 160]];
    const H = homography(rect, quad);
    rect.forEach((p, i) => {
      const [x, y] = applyH(H, p);
      expect(x).toBeCloseTo(quad[i][0], 6);
      expect(y).toBeCloseTo(quad[i][1], 6);
    });
  });

  it('calcula o tamanho da capa endireitada respeitando o limite', () => {
    expect(outputSize([[0, 0], [200, 0], [200, 300], [0, 300]])).toEqual({ width: 200, height: 300 });
    expect(outputSize([[0, 0], [2000, 0], [2000, 3000], [0, 3000]], 1500)).toEqual({ width: 1000, height: 1500 });
  });

  it('ordena cantos fora de ordem', () => {
    expect(orderCorners([[100, 150], [0, 0], [0, 150], [100, 0]])).toEqual([[0, 0], [100, 0], [100, 150], [0, 150]]);
  });
});
