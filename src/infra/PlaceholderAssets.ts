/**
 * PlaceholderAssets —— 程序化占位资源生成。
 *
 * 当 manifest 中的真实文件缺失时，由这里生成占位图/音，
 * 保证游戏在"空 assets 目录"下也能完整运行。
 *
 * 占位图：纯色几何形状 + emoji 标识，并清晰画出物理碰撞边界，
 * 便于调试时一眼看出碰撞框与贴图是否对齐。
 *
 * 替换原创素材时，本文件无需任何改动。
 */

import type { ImageDef } from '@game/types';

/** id → 显示用的主题色与 emoji。集中维护，便于统一风格。 */
const VISUAL: Record<
  string,
  { color: string; emoji: string; shape: 'circle' | 'rect' }
> = {
  'bird.red': { color: '#e23b3b', emoji: '🐦', shape: 'circle' },
  'bird.yellow': { color: '#f5b400', emoji: '🐦', shape: 'circle' },
  'bird.blue': { color: '#3b82f6', emoji: '🐦', shape: 'circle' },
  'block.wood': { color: '#a9743b', emoji: '🪵', shape: 'rect' },
  'block.stone': { color: '#9ca3af', emoji: '🪨', shape: 'rect' },
  'block.glass': { color: '#7dd3fc', emoji: '🧊', shape: 'rect' },
  'pig.normal': { color: '#86c04a', emoji: '🐷', shape: 'circle' },
  'pig.helmet': { color: '#6aa83a', emoji: '🐷', shape: 'circle' },
  'sling': { color: '#7c3a14', emoji: 'Y', shape: 'rect' },
  'sling.band': { color: '#3a2a1a', emoji: '', shape: 'rect' },
  'bg.level1': { color: '#7ec0ee', emoji: '', shape: 'rect' },
  'bg.level2': { color: '#9bb86a', emoji: '', shape: 'rect' },
  'bg.level3': { color: '#c98a5a', emoji: '', shape: 'rect' },
};

const FALLBACK = { color: '#cccccc', emoji: '❓', shape: 'rect' as const };

const canvasCache = new Map<string, HTMLCanvasElement>();

/**
 * 生成一张占位图 canvas，并缓存。
 * 背景图按真实尺寸绘制；实体图绘制形状 + emoji + 物理边界框。
 */
export function getPlaceholderImage(id: string, def: ImageDef): HTMLCanvasElement {
  const cached = canvasCache.get(id);
  if (cached) return cached;

  const vis = VISUAL[id] ?? FALLBACK;
  const w = def.w;
  const h = def.h;
  const canvas = document.createElement('canvas');
  // 高清屏适配
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // 背景图特殊处理：纯渐变填充
  if (id.startsWith('bg.')) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, vis.color);
    g.addColorStop(1, shade(vis.color, -30));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 地平线
    ctx.fillStyle = shade(vis.color, -45);
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
    canvasCache.set(id, canvas);
    return canvas;
  }

  // 实体形状
  if (vis.shape === 'circle') {
    drawCircleEntity(ctx, w, h, vis.color, vis.emoji);
  } else {
    drawRectEntity(ctx, w, h, vis.color, vis.emoji);
  }

  canvasCache.set(id, canvas);
  return canvas;
}

function drawCircleEntity(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  emoji: string,
) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2 - 1;

  // 主体
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
  g.addColorStop(0, shade(color, 35));
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // 物理边界（虚线，便于调试对齐）
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  drawEmoji(ctx, emoji, cx, cy, Math.min(w, h) * 0.7);
}

function drawRectEntity(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  emoji: string,
) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, shade(color, 25));
  g.addColorStop(1, shade(color, -10));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 木纹/石纹纹理（简易）
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  for (let i = 6; i < h; i += 8) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(w, i + (Math.sin(i) * 1.5));
    ctx.stroke();
  }

  // 物理边界
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  ctx.setLineDash([]);

  if (emoji) drawEmoji(ctx, emoji, w / 2, h / 2, Math.min(w, h) * 0.7);
}

function drawEmoji(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  cx: number,
  cy: number,
  size: number,
) {
  if (!emoji) return;
  ctx.font = `${size}px ${'"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui'}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, cx, cy);
}

/** 颜色明暗调整（delta -100~100）。 */
function shade(hex: string, delta: number): string {
  const c = hex.replace('#', '');
  const num = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  let r = (num >> 16) + delta;
  let g = ((num >> 8) & 0xff) + delta;
  let b = (num & 0xff) + delta;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 占位音效（Web Audio 合成）
// ─────────────────────────────────────────────────────────────────────────────

/** 音效合成配方：每种 id 对应一段简单的振荡器/噪声参数。 */
type SynthSpec =
  | { kind: 'tone'; freq: number; dur: number; type: OscillatorType; gain: number }
  | { kind: 'sweep'; from: number; to: number; dur: number; gain: number }
  | { kind: 'noise'; dur: number; gain: number; filterFreq: number };

const AUDIO_SPEC: Record<string, SynthSpec> = {
  'sfx.launch': { kind: 'sweep', from: 220, to: 880, dur: 0.18, gain: 0.35 },
  'sfx.stretch': { kind: 'sweep', from: 180, to: 120, dur: 0.1, gain: 0.15 },
  'sfx.hit_wood': { kind: 'noise', dur: 0.08, gain: 0.25, filterFreq: 1200 },
  'sfx.hit_stone': { kind: 'noise', dur: 0.12, gain: 0.35, filterFreq: 600 },
  'sfx.hit_glass': { kind: 'noise', dur: 0.06, gain: 0.3, filterFreq: 4000 },
  'sfx.block_break': { kind: 'noise', dur: 0.2, gain: 0.35, filterFreq: 1800 },
  'sfx.pig_pop': { kind: 'sweep', from: 600, to: 200, dur: 0.22, gain: 0.35 },
  'sfx.skill': { kind: 'sweep', from: 400, to: 1600, dur: 0.16, gain: 0.3 },
  'sfx.win': { kind: 'tone', freq: 660, dur: 0.5, type: 'triangle', gain: 0.35 },
  'sfx.lose': { kind: 'sweep', from: 300, to: 80, dur: 0.6, gain: 0.35 },
};

/** 合成并预渲染一段占位音效为 AudioBuffer。 */
export function synthPlaceholderAudio(
  id: string,
  ctx: AudioContext,
): AudioBuffer | null {
  const spec = AUDIO_SPEC[id];
  if (!spec) return null;

  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * spec.dur));
  const buffer = ctx.createBuffer(1, len, sr);
  const data = buffer.getChannelData(0);

  if (spec.kind === 'tone') {
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.sin(Math.PI * t); // 起音-衰减包络
      data[i] =
        Math.sin(2 * Math.PI * spec.freq * (i / sr)) * env * spec.gain;
    }
  } else if (spec.kind === 'sweep') {
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const f = spec.from + (spec.to - spec.from) * t;
      const env = Math.sin(Math.PI * t);
      data[i] = Math.sin(2 * Math.PI * f * (i / sr)) * env * spec.gain;
    }
  } else {
    // 带通噪声
    let last = 0;
    const alpha = Math.exp(-2 * Math.PI * spec.filterFreq / sr);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.pow(1 - t, 2);
      const white = Math.random() * 2 - 1;
      last = (1 - alpha) * white + alpha * last;
      data[i] = last * env * spec.gain;
    }
  }
  return buffer;
}
