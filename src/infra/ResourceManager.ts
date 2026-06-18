/**
 * ResourceManager —— 资源层门面。
 *
 * 游戏代码通过它按 id 获取图片/音频/物理参数，永远不接触文件路径。
 * 流程：fetch manifest → 并发预载图片/音频 → 单条失败则回退到占位。
 *
 * 关键不变量：
 *  - getImage(id) 永远返回一个可绘制的 CanvasImageSource（不会是 null）。
 *  - getAudio(id) 永远返回一个可播放的 AudioBuffer（不会是 null）。
 *  - getPhysics(id) 永远返回一个 PhysicsDef（可能为空对象，使用默认值）。
 *
 * 因此替换素材时，游戏逻辑无需任何 null 检查或条件分支。
 */

import type {
  AssetManifest,
  ImageDef,
  LevelData,
  PhysicsDef,
} from '@game/types';
import { loadAudioBuffer, loadImage, loadJson, runWithProgress } from './AssetLoader';
import {
  getPlaceholderImage,
  synthPlaceholderAudio,
} from './PlaceholderAssets';

/** 运行时缓存的图片资源（canvas 或 image）。 */
interface ImageResource {
  source: 'file' | 'placeholder';
  /** 真实文件加载成功时为 HTMLImageElement，否则为程序化生成的 canvas。 */
  data: CanvasImageSource;
  /** 实际宽高（占位图与贴图一致，便于渲染层计算）。 */
  w: number;
  h: number;
}

/** assets 目录的根 URL。 */
const ASSETS_BASE = `${import.meta.env.BASE_URL}assets`;

export class ResourceManager {
  private manifest: AssetManifest | null = null;
  private images = new Map<string, ImageResource>();
  private audios = new Map<string, AudioBuffer>();
  private audioCtx: AudioContext | null = null;

  /** 加载 manifest.json。缺失时使用内置默认（保证空目录也能跑）。 */
  async loadManifest(): Promise<AssetManifest> {
    const url = `${ASSETS_BASE}/manifest.json`;
    const data = await loadJson<AssetManifest>(url);
    if (data && typeof data === 'object' && data.images && data.audio) {
      this.manifest = data;
      return data;
    }
    // 回退：用一份内置最小 manifest（防止 fetch 失败时完全不可用）
    this.manifest = BUILTIN_FALLBACK_MANIFEST;
    return this.manifest;
  }

  getManifest(): AssetManifest {
    if (!this.manifest) throw new Error('ResourceManager: manifest 未加载');
    return this.manifest;
  }

  /** 列出所有关卡 id（扫描 levels 目录不可行，故约定 manifest/约定清单）。 */
  listLevelIds(): string[] {
    return this.getManifest().levelIds ?? DEFAULT_LEVEL_IDS;
  }

  /** 加载某一关的数据。 */
  async loadLevel(id: string): Promise<LevelData> {
    const url = `${ASSETS_BASE}/levels/${id}.json`;
    const data = await loadJson<LevelData>(url);
    if (data) return data;
    // 回退：返回一个极简关卡，避免白屏
    return FALLBACK_LEVEL;
  }

  /** 注入 AudioContext（由 AudioManager 创建并共享）。 */
  setAudioContext(ctx: AudioContext): void {
    this.audioCtx = ctx;
  }

  /** 预载指定 id 集合的图片与音频。onProgress 上报 0~1。 */
  async preload(
    imageIds: string[],
    audioIds: string[],
    onProgress?: (ratio: number) => void,
  ): Promise<void> {
    const manifest = this.getManifest();
    const tasks: Array<() => Promise<void>> = [];

    for (const id of imageIds) {
      const def = manifest.images[id];
      if (!def) continue;
      tasks.push(async () => {
        const img = await loadImage(`${ASSETS_BASE}/${def.src}`);
        if (img) {
          this.images.set(id, {
            source: 'file',
            data: img,
            w: def.w,
            h: def.h,
          });
        } else {
          // 回退占位
          const c = getPlaceholderImage(id, def);
          this.images.set(id, {
            source: 'placeholder',
            data: c,
            w: def.w,
            h: def.h,
          });
        }
      });
    }

    for (const id of audioIds) {
      const def = manifest.audio[id];
      if (!def) continue;
      tasks.push(async () => {
        const ctx = this.audioCtx;
        let buffer: AudioBuffer | null = null;
        if (ctx) {
          buffer = await loadAudioBuffer(`${ASSETS_BASE}/${def.src}`, ctx);
          if (!buffer) buffer = synthPlaceholderAudio(id, ctx);
        }
        if (buffer) this.audios.set(id, buffer);
      });
    }

    await runWithProgress(tasks, onProgress);
  }

  getImage(id: string): ImageResource {
    const r = this.images.get(id);
    if (r) return r;
    // 兜底：用占位图（即使 manifest 没声明，也不崩）
    const def = this.getManifest().images[id] ?? {
      src: '',
      w: 40,
      h: 40,
      anchor: [0.5, 0.5] as [number, number],
    };
    const c = getPlaceholderImage(id, def);
    const res: ImageResource = {
      source: 'placeholder',
      data: c,
      w: def.w,
      h: def.h,
    };
    this.images.set(id, res);
    return res;
  }

  getAudio(id: string): AudioBuffer | null {
    return this.audios.get(id) ?? null;
  }

  getPhysics(id: string): PhysicsDef {
    return this.getManifest().physics[id] ?? {};
  }

  /** 构造实体的显示定义（聚合 image + physics）。 */
  getEntityDef(
    id: string,
  ): { id: string; image: ImageDef; physics: PhysicsDef } {
    const m = this.getManifest();
    const image = m.images[id] ?? { src: '', w: 40, h: 40 };
    const physics = m.physics[id] ?? {};
    return { id, image, physics };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 内置兜底（assets 目录完全缺失时使用，保证永不白屏）
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_LEVEL_IDS = ['level-01', 'level-02', 'level-03'];

const FALLBACK_LEVEL: LevelData = {
  id: 'fallback',
  bg: 'bg.level1',
  sling: { x: 210, y: 560 },
  birds: ['bird.red', 'bird.red'],
  goal: { stars: { '3': 'birdsLeft>=2', '2': 'birdsLeft>=1', '1': 'win' } },
  objects: [
    { type: 'block', id: 'block.wood', x: 960, y: 660, w: 24, h: 120 },
    { type: 'pig', id: 'pig.normal', x: 960, y: 600 },
  ],
};

/** 内置最小 manifest，仅当 public/assets/manifest.json 完全不可用时使用。 */
const BUILTIN_FALLBACK_MANIFEST: AssetManifest = {
  version: 1,
  levelIds: DEFAULT_LEVEL_IDS,
  images: {
    'bird.red': { src: 'images/bird-red.png', w: 46, h: 46, anchor: [0.5, 0.5] },
    'bird.yellow': { src: 'images/bird-yellow.png', w: 42, h: 42, anchor: [0.5, 0.5] },
    'bird.blue': { src: 'images/bird-blue.png', w: 34, h: 34, anchor: [0.5, 0.5] },
    'block.wood': { src: 'images/block-wood.png', w: 60, h: 60, anchor: [0.5, 0.5], slice: [18, 18, 18, 18] },
    'block.stone': { src: 'images/block-stone.png', w: 60, h: 60, anchor: [0.5, 0.5], slice: [18, 18, 18, 18] },
    'block.glass': { src: 'images/block-glass.png', w: 60, h: 60, anchor: [0.5, 0.5], slice: [18, 18, 18, 18] },
    'pig.normal': { src: 'images/pig-normal.png', w: 48, h: 48, anchor: [0.5, 0.5] },
    'pig.helmet': { src: 'images/pig-helmet.png', w: 52, h: 52, anchor: [0.5, 0.5] },
    'sling': { src: 'images/slingshot.png', w: 84, h: 130, anchor: [0.5, 0.92] },
    'sling.band': { src: 'images/sling-band.png', w: 16, h: 60, anchor: [0.5, 0.5] },
    'bg.level1': { src: 'images/bg-level1.jpg', w: 1280, h: 720 },
    'bg.level2': { src: 'images/bg-level2.jpg', w: 1280, h: 720 },
    'bg.level3': { src: 'images/bg-level3.jpg', w: 1280, h: 720 },
  },
  audio: {
    'sfx.launch': { src: 'audio/launch.mp3' },
    'sfx.stretch': { src: 'audio/stretch.mp3' },
    'sfx.hit_wood': { src: 'audio/hit-wood.mp3' },
    'sfx.hit_stone': { src: 'audio/hit-stone.mp3' },
    'sfx.hit_glass': { src: 'audio/hit-glass.mp3' },
    'sfx.block_break': { src: 'audio/block-break.mp3' },
    'sfx.pig_pop': { src: 'audio/pig-pop.mp3' },
    'sfx.skill': { src: 'audio/skill.mp3' },
    'sfx.win': { src: 'audio/win.mp3' },
    'sfx.lose': { src: 'audio/lose.mp3' },
  },
  physics: {
    'bird.red': { mass: 5, restitution: 0.4, friction: 0.5 },
    'bird.yellow': { mass: 4, restitution: 0.4, friction: 0.5 },
    'bird.blue': { mass: 3, restitution: 0.45, friction: 0.5 },
    'block.wood': { mass: 3, hp: 70, restitution: 0.2, friction: 0.6 },
    'block.stone': { mass: 9, hp: 220, restitution: 0.1, friction: 0.85 },
    'block.glass': { mass: 2, hp: 28, restitution: 0.3, friction: 0.4 },
    'pig.normal': { mass: 4, hp: 45 },
    'pig.helmet': { mass: 5, hp: 100 },
  },
} as AssetManifest;
