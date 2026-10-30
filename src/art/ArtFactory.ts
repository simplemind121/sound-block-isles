import Phaser from 'phaser';
import { PALETTE } from './palette';
import { BLOCKS, BlockStyle, SMALL_GLYPHS, SPRITES } from './sprites';
import { Letter, Stroke } from '../core/types';
import { bounds, sampleStroke } from '../core/strokes';

/** 生成全部原创像素贴图（启动时一次，几十毫秒） */
export function buildTextures(scene: Phaser.Scene, letters: Letter[]): void {
  for (const [key, rows] of Object.entries(SPRITES)) pixelTexture(scene, key, rows);
  for (const [key, st] of Object.entries(BLOCKS)) blockTexture(scene, key, st);
  for (const l of letters) {
    letterBlock(scene, `lblock_${l.id}`, l.color, l.strokesLower, SMALL_GLYPHS[l.lower]);
    letterBlock(scene, `ublock_${l.id}`, l.color, l.strokesUpper, SMALL_GLYPHS[l.upper]);
    glyph(scene, `glyph_${l.id}`, l.strokesLower, l.color);
    glyph(scene, `glyphU_${l.id}`, l.strokesUpper, l.color);
    glyph(scene, `tglyph_${l.id}`, l.strokesLower, l.color, TRACE_FIT);
    glyph(scene, `tglyphg_${l.id}`, l.strokesLower, '#c9d3dd', TRACE_FIT);
  }
  tiles(scene);
}

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h)!;
  return { tex, ctx: tex.getContext() };
}

export function pixelTexture(scene: Phaser.Scene, key: string, rows: string[]): void {
  const w = Math.max(...rows.map((r) => r.length));
  const { tex, ctx } = canvasTex(scene, key, w, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = PALETTE[row[x]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  tex.refresh();
}

function bevel(ctx: CanvasRenderingContext2D, st: BlockStyle): void {
  ctx.fillStyle = st.base;
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = st.light;
  ctx.fillRect(0, 0, 16, 2);
  ctx.fillRect(0, 0, 2, 16);
  ctx.fillStyle = st.dark;
  ctx.fillRect(0, 14, 16, 2);
  ctx.fillRect(14, 0, 2, 16);
  ctx.fillStyle = '#2b2d42';
  ctx.globalAlpha = 0.35;
  ctx.strokeRect(0.5, 0.5, 15, 15);
  ctx.globalAlpha = 1;
}

function blockTexture(scene: Phaser.Scene, key: string, st: BlockStyle): void {
  const { tex, ctx } = canvasTex(scene, key, 16, 16);
  bevel(ctx, st);
  ctx.fillStyle = st.dark;
  if (st.pattern === 'planks') {
    ctx.fillRect(2, 5, 12, 1);
    ctx.fillRect(2, 10, 12, 1);
    ctx.fillRect(7, 2, 1, 3);
    ctx.fillRect(4, 6, 1, 4);
    ctx.fillRect(10, 11, 1, 3);
  } else if (st.pattern === 'cobble') {
    for (const [x, y, w, h] of [[3, 3, 4, 3], [9, 4, 3, 3], [4, 9, 3, 3], [9, 10, 4, 2]]) {
      ctx.fillStyle = st.dark;
      ctx.fillRect(x, y + h, w, 1);
      ctx.fillRect(x + w, y, 1, h);
      ctx.fillStyle = st.light;
      ctx.fillRect(x, y, w, 1);
    }
  } else if (st.pattern === 'grass') {
    for (const [x, y] of [[4, 4], [10, 6], [6, 10], [11, 11], [3, 8]]) {
      ctx.fillRect(x, y, 1, 2);
      ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  tex.refresh();
}

export interface Fit {
  x: number;
  y: number;
  size: number;
}

/** 描红用的字形：放大到 32×32 网格里的这个区域 */
export const TRACE_FIT: Fit = { x: 3, y: 3, size: 26 };

/** 把 0–1 方框坐标映射到网格坐标，让字形的包围盒居中放进 fit 区域 */
export function fitMap(strokes: Stroke[], fit: Fit): (x: number, y: number) => [number, number] {
  const b = bounds(strokes);
  const s = fit.size / Math.max(b.x1 - b.x0, b.y1 - b.y0, 0.3);
  const ox = fit.x + (fit.size - (b.x1 - b.x0) * s) / 2;
  const oy = fit.y + (fit.size - (b.y1 - b.y0) * s) / 2;
  return (x, y) => [ox + (x - b.x0) * s, oy + (y - b.y0) * s];
}

/** 把笔画画到 n×n 网格上，再二值化，得到方块像素字形的点阵 */
function rasterize(strokes: Stroke[], n: number, fit?: Fit): boolean[][] {
  const scale = 4;
  const c = document.createElement('canvas');
  c.width = c.height = n * scale;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // fit：把字形的包围盒放进 n×n 里指定区域；否则按 0–1 方框整体缩放（保持基线一致）
  let map = (x: number, y: number) => [x * n * scale, y * n * scale];
  let lw = n * scale * 0.085;
  if (fit) {
    const f = fitMap(strokes, fit);
    map = (x, y) => f(x, y).map((v) => v * scale);
    lw = Math.max(1.4, fit.size * 0.13) * scale;
  }
  ctx.lineWidth = lw;
  for (const st of strokes) {
    const pts = sampleStroke(st, 0.01).map((p) => map(p.x, p.y));
    if (st.t === 'dot') {
      ctx.beginPath();
      ctx.arc(pts[0][0], pts[0][1], lw * 0.65, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  const img = ctx.getImageData(0, 0, n * scale, n * scale).data;
  const grid: boolean[][] = [];
  for (let y = 0; y < n; y++) {
    grid.push([]);
    for (let x = 0; x < n; x++) {
      let sum = 0;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) sum += img[((y * scale + dy) * n * scale + x * scale + dx) * 4 + 3];
      grid[y].push(sum / (scale * scale) > 110);
    }
  }
  return grid;
}

function shade(hex: string, f: number): string {
  const c = Phaser.Display.Color.HexStringToColor(hex);
  const k = (v: number) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))));
  return Phaser.Display.Color.RGBToString(k(c.red), k(c.green), k(c.blue));
}

function letterBlock(scene: Phaser.Scene, key: string, color: string, strokes: Stroke[], rows?: string[]): void {
  const { tex, ctx } = canvasTex(scene, key, 16, 16);
  bevel(ctx, { base: color, light: shade(color, 0.35), dark: shade(color, -0.3) });
  let g: boolean[][];
  if (rows) {
    // 手绘字形：放在方块正中（亮边 2px、暗边 2px，所以中心在 7.5 左右）
    const w = Math.max(...rows.map((r) => r.length));
    const x0 = Math.round(1 + (14 - w) / 2);
    const y0 = Math.round(1 + (14 - rows.length) / 2);
    g = Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => rows[y - y0]?.[x - x0] === '#'));
  } else g = rasterize(strokes, 16, { x: 3.5, y: 3.5, size: 9 });
  // 先画阴影，再画白字，避免阴影盖住字
  for (const [fill, d] of [[shade(color, -0.65), 1], ['#ffffff', 0]] as const) {
    ctx.fillStyle = fill;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (g[y][x]) ctx.fillRect(x + d, y + d, 1, 1);
  }
  tex.refresh();
}

/** 大号字形的点阵大小 */
export const GLYPH_N = 32;

/** 大号字形（32×32 点阵，保持基线；放大显示） */
function glyph(scene: Phaser.Scene, key: string, strokes: Stroke[], color: string, fit?: Fit): void {
  const n = GLYPH_N;
  const { tex, ctx } = canvasTex(scene, key, n, n);
  const g = rasterize(strokes, n, fit);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (g[y][x]) {
        ctx.fillStyle = g[y - 1]?.[x] ? color : shade(color, 0.35);
        ctx.fillRect(x, y, 1, 1);
        if (!g[y + 1]?.[x]) {
          ctx.fillStyle = shade(color, -0.3);
          ctx.fillRect(x, y, 1, 1);
        }
      }
  tex.refresh();
}

function tiles(scene: Phaser.Scene): void {
  const make = (key: string, base: string, dots: string, seed: number) => {
    const { tex, ctx } = canvasTex(scene, key, 16, 16);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = dots;
    let s = seed;
    for (let i = 0; i < 7; i++) {
      s = (s * 9301 + 49297) % 233280;
      const x = s % 15;
      s = (s * 9301 + 49297) % 233280;
      const y = s % 15;
      ctx.fillRect(x, y, 1, 1 + (i % 2));
    }
    tex.refresh();
  };
  make('tile_grass0', '#8fd694', '#6cc077', 3);
  make('tile_grass1', '#8fd694', '#6cc077', 11);
  make('tile_grass2', '#8fd694', '#a9e3a8', 29);
  make('tile_sand', '#f2d49b', '#d9b46c', 7);
  for (const f of [0, 1]) {
    const { tex, ctx } = canvasTex(scene, `tile_water${f}`, 16, 16);
    ctx.fillStyle = '#5fb3e8';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#8fd0f5';
    ctx.fillRect(2 + f * 6, 4, 4, 1);
    ctx.fillRect(9 - f * 6, 11, 4, 1);
    tex.refresh();
  }
  const { tex, ctx } = canvasTex(scene, 'tile_fog', 16, 16);
  ctx.fillStyle = '#e8eef3';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(3, 3, 6, 3);
  ctx.fillRect(8, 10, 6, 3);
  tex.refresh();
}
