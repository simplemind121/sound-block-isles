import { Stroke } from './types';

export type Pt = { x: number; y: number };

/** 把一笔（线段/圆弧/圆点）按固定间距采样成点，坐标仍在 0–1 方框内 */
export function sampleStroke(s: Stroke, step = 0.03): Pt[] {
  if (s.t === 'dot') return [{ x: s.c[0], y: s.c[1] }];
  if (s.t === 'line') {
    const [x1, y1, x2, y2] = s.p;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.round(len / step));
    return Array.from({ length: n + 1 }, (_, i) => ({ x: x1 + ((x2 - x1) * i) / n, y: y1 + ((y2 - y1) * i) / n }));
  }
  const [a0, a1] = s.a.map((d) => (d * Math.PI) / 180);
  const len = Math.abs(a1 - a0) * s.r;
  const n = Math.max(2, Math.round(len / step));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return { x: s.c[0] + Math.cos(a) * s.r, y: s.c[1] + Math.sin(a) * s.r };
  });
}

export function bounds(strokes: Stroke[]): { x0: number; y0: number; x1: number; y1: number } {
  const pts = strokes.flatMap((s) => sampleStroke(s));
  return {
    x0: Math.min(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)),
    x1: Math.max(...pts.map((p) => p.x)),
    y1: Math.max(...pts.map((p) => p.y)),
  };
}
