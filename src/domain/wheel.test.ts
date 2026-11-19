import { describe, expect, it } from 'vitest';
import { sliceAtTop, spinTarget } from './wheel';

describe('roleta', () => {
  it('para exatamente na fatia sorteada', () => {
    for (const n of [1, 2, 5, 7, 23]) {
      let rot = 0;
      for (let i = 0; i < n; i++) {
        rot = spinTarget(rot, i, n);
        expect(sliceAtTop(rot, n)).toBe(i);
      }
    }
  });
  it('sempre gira para frente, com pelo menos 5 voltas', () => {
    const t = spinTarget(1000, 2, 6);
    expect(t - 1000).toBeGreaterThanOrEqual(360 * 4);
  });
});
