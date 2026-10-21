export type Point = [number, number];

/** Resolve A·x = b (eliminação de Gauss com pivotamento). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * Homografia que leva os 4 pontos `from` nos 4 pontos `to`.
 * Retorna [a,b,c,d,e,f,g,h]: x' = (ax+by+c)/(gx+hy+1), y' = (dx+ey+f)/(gx+hy+1).
 */
export function homography(from: Point[], to: Point[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i];
    const [u, v] = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return solve(A, b);
}

export const applyH = (H: number[], [x, y]: Point): Point => {
  const w = H[6] * x + H[7] * y + 1;
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
};

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Tamanho do retângulo de saída para um quadrilátero (cantos: sup-esq, sup-dir, inf-dir, inf-esq). */
export function outputSize(q: Point[], maxSide = 1400) {
  const w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2;
  const h = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
  const s = Math.min(1, maxSide / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

/** Ordena 4 pontos quaisquer como sup-esq, sup-dir, inf-dir, inf-esq. */
export function orderCorners(pts: Point[]): Point[] {
  const sum = (p: Point) => p[0] + p[1];
  const diff = (p: Point) => p[0] - p[1];
  const tl = pts.reduce((a, b) => (sum(b) < sum(a) ? b : a));
  const br = pts.reduce((a, b) => (sum(b) > sum(a) ? b : a));
  const tr = pts.reduce((a, b) => (diff(b) > diff(a) ? b : a));
  const bl = pts.reduce((a, b) => (diff(b) < diff(a) ? b : a));
  return [tl, tr, br, bl];
}

/** Recorta e "endireita" a capa: o quadrilátero vira um retângulo. */
export function warpToCanvas(img: CanvasImageSource & { width: number; height: number }, quad: Point[], maxSide = 1400) {
  const { width, height } = outputSize(quad, maxSide);
  const src = document.createElement('canvas');
  src.width = img.width;
  src.height = img.height;
  const sctx = src.getContext('2d')!;
  sctx.drawImage(img, 0, 0);
  const sdata = sctx.getImageData(0, 0, src.width, src.height).data;

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const octx = out.getContext('2d')!;
  const odata = octx.createImageData(width, height);
  // mapeia cada pixel do retângulo de saída de volta para a foto original
  const H = homography([[0, 0], [width, 0], [width, height], [0, height]], quad);
  const sw = src.width, sh = src.height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const w = H[6] * x + H[7] * y + 1;
      const sx = Math.min(sw - 1, Math.max(0, Math.round((H[0] * x + H[1] * y + H[2]) / w)));
      const sy = Math.min(sh - 1, Math.max(0, Math.round((H[3] * x + H[4] * y + H[5]) / w)));
      const si = (sy * sw + sx) * 4;
      const oi = (y * width + x) * 4;
      odata.data[oi] = sdata[si];
      odata.data[oi + 1] = sdata[si + 1];
      odata.data[oi + 2] = sdata[si + 2];
      odata.data[oi + 3] = 255;
    }
  }
  octx.putImageData(odata, 0, 0);
  return out;
}
