/**
 * Renderer —— Canvas 2D 渲染层。
 *
 * 职责：绘制背景 → 实体 → 弹弓/弹带 → 轨迹预测 → 临时特效。
 *
 * 解耦：Renderer 只接收 Renderable 列表，用 ResourceManager.getImage(id) 取图，
 *      不接触任何文件路径或物理参数。它只关心"在哪里、画多大、旋转多少"。
 *
 * 支持：
 *  - 锚点对齐（来自 manifest image.anchor）。
 *  - 九宫格切片（image.slice）：方块贴图能拉伸适配任意 w/h 而不变形。
 *  - 鸟飞行时的朝向旋转与拖尾。
 */

import type { ResourceManager } from '@infra/ResourceManager';
import type { Particle, Renderable, TrajectoryPoint } from '@game/types';

export interface RenderLayer {
  /** 实体绘制列表。 */
  renderables: Renderable[];
  /** 背景 manifest id（可为 null）。 */
  bgId: string | null;
  /** 轨迹预测点（拖拽弹弓时显示）。 */
  trajectory: TrajectoryPoint[];
  /** 待发射的鸟（在弹弓上等待区排队的小图标），按队列顺序。 */
  waitingBirdIds: string[];
  /** 弹弓位置（世界坐标）。 */
  sling?: { x: number; y: number };
  /** 装填中的鸟被拉到的位置（世界坐标），用于画弹带拉伸。 */
  loadedBirdPos?: { x: number; y: number } | null;
  /** 临时粒子（爆炸碎片等）。 */
  particles?: Particle[];
}

const BG_W = 1280;
const BG_H = 720;

export class Renderer {
  constructor(
    private ctx: CanvasRenderingContext2D,
    private rm: ResourceManager,
  ) {}

  render(layer: RenderLayer): void {
    const ctx = this.ctx;
    // 背景（拉伸铺满世界）
    if (layer.bgId) {
      const res = this.rm.getImage(layer.bgId);
      ctx.drawImage(res.data as CanvasImageSource, 0, 0, BG_W, BG_H);
    }

    // 粒子（在实体之下，营造爆炸感）
    if (layer.particles) {
      for (const p of layer.particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 实体（方块/猪/鸟）
    for (const r of layer.renderables) {
      this.drawRenderable(r);
    }

    // 弹弓后柱 + 弹带 + 前柱
    if (layer.sling) this.drawSlingshot(layer);

    // 轨迹预测
    if (layer.trajectory.length > 1) {
      for (let i = 0; i < layer.trajectory.length; i++) {
        const p = layer.trajectory[i];
        ctx.globalAlpha = p.alpha * 0.8;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 - (i / layer.trajectory.length) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 等待区鸟图标
    this.drawWaitingQueue(layer.waitingBirdIds, layer.sling);
  }

  private drawRenderable(r: Renderable): void {
    const ctx = this.ctx;
    const res = this.rm.getImage(r.def.id);
    const def = r.def.image;
    const anchor = def.anchor ?? [0.5, 0.5];
    const px = r.body.position.x;
    const py = r.body.position.y;
    const w = r.w;
    const h = r.h;
    const ax = -w * anchor[0];
    const ay = -h * anchor[1];

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(r.body.angle);

    // 高亮（飞行中的鸟）
    if (r.highlight) {
      ctx.shadowColor = 'rgba(255,255,200,0.9)';
      ctx.shadowBlur = 14;
    }

    if (def.slice) {
      // 九宫格拉伸
      this.drawSliced(res.data as CanvasImageSource, def.w, def.h, def.slice, w, h, ax, ay);
    } else {
      ctx.drawImage(res.data as CanvasImageSource, ax, ay, w, h);
    }

    // hp 血条（受伤但未死时，方块/猪）
    if (r.def.category !== 'bird' && r.def.physics.hp && r.hp != null) {
      const maxHp = r.def.physics.hp;
      const ratio = Math.max(0, r.hp / maxHp);
      if (ratio < 0.999) {
        const bw = w * 0.9;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-bw / 2, -h / 2 - 8, bw, 4);
        ctx.fillStyle =
          ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#facc15' : '#ef4444';
        ctx.fillRect(-bw / 2, -h / 2 - 8, bw * ratio, 4);
      }
    }

    ctx.restore();
  }

  /** 九宫格绘制：4 角保持原比例，4 边与中心拉伸。 */
  private drawSliced(
    img: CanvasImageSource,
    srcW: number,
    srcH: number,
    slice: [number, number, number, number],
    dstW: number,
    dstH: number,
    ax: number,
    ay: number,
  ): void {
    const ctx = this.ctx;
    const [t, r, b, l] = slice;
    const dstX = ax;
    const dstY = ay;

    // 当目标尺寸接近源尺寸时直接整图绘制，避免缩放瑕疵
    if (Math.abs(dstW - srcW) < 2 && Math.abs(dstH - srcH) < 2) {
      ctx.drawImage(img, dstX, dstY, dstW, dstH);
      return;
    }

    const midSrcW = srcW - l - r;
    const midSrcH = srcH - t - b;
    const midDstW = dstW - l - r;
    const midDstH = dstH - t - b;

    // 9 段：[sx,sy,sw,sh, dx,dy,dw,dh]
    const segs: Array<[number, number, number, number, number, number, number, number]> = [
      // 四角
      [0, 0, l, t, dstX, dstY, l, t],
      [srcW - r, 0, r, t, dstX + dstW - r, dstY, r, t],
      [0, srcH - b, l, b, dstX, dstY + dstH - b, l, b],
      [srcW - r, srcH - b, r, b, dstX + dstW - r, dstY + dstH - b, r, b],
      // 四边
      [l, 0, midSrcW, t, dstX + l, dstY, midDstW, t],
      [l, srcH - b, midSrcW, b, dstX + l, dstY + dstH - b, midDstW, b],
      [0, t, l, midSrcH, dstX, dstY + t, l, midDstH],
      [srcW - r, t, r, midSrcH, dstX + dstW - r, dstY + t, r, midDstH],
      // 中心
      [l, t, midSrcW, midSrcH, dstX + l, dstY + t, midDstW, midDstH],
    ];
    for (const s of segs) {
      if (s[2] <= 0 || s[3] <= 0 || s[6] <= 0 || s[7] <= 0) continue;
      ctx.drawImage(img, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7]);
    }
  }

  private drawSlingshot(layer: RenderLayer): void {
    const ctx = this.ctx;
    const sling = layer.sling!;
    const slingRes = this.rm.getImage('sling');
    const def = slingRes; // anchor [0.5, 0.92]
    const anchor = (this.rm.getEntityDef('sling').image.anchor ?? [0.5, 0.92]) as [
      number,
      number,
    ];
    const w = def.w;
    const h = def.h;
    const ax = -w * anchor[0];
    const ay = -h * anchor[1];

    // 后柱（先画，鸟在前面）
    ctx.drawImage(slingRes.data as CanvasImageSource, sling.x + ax, sling.y + ay, w, h);

    // 弹带：从弹弓顶部两侧拉到鸟的位置
    if (layer.loadedBirdPos) {
      const bandTopY = sling.y - h * (1 - anchor[1]) + 8;
      this.drawBand(sling.x - 14, bandTopY, layer.loadedBirdPos.x, layer.loadedBirdPos.y);
    }
  }

  /** 在 drawSlingshot 之后单独画"前弹带 + 前柱"，使鸟夹在中间。 */
  drawSlingshotFront(layer: RenderLayer): void {
    const ctx = this.ctx;
    const sling = layer.sling!;
    if (layer.loadedBirdPos) {
      const def = this.rm.getImage('sling');
      const anchor = (this.rm.getEntityDef('sling').image.anchor ?? [0.5, 0.92]) as [
        number,
        number,
      ];
      const bandTopY = sling.y - def.h * (1 - anchor[1]) + 8;
      this.drawBand(sling.x + 14, bandTopY, layer.loadedBirdPos.x, layer.loadedBirdPos.y);
    }
    // 前柱（覆盖鸟的下半部分，制造"鸟在弹叉里"的视觉）
    const slingRes = this.rm.getImage('sling');
    const def = this.rm.getEntityDef('sling').image;
    const anchor = def.anchor ?? [0.5, 0.92];
    const w = def.w;
    const h = def.h;
    ctx.drawImage(
      slingRes.data as CanvasImageSource,
      sling.x - w * anchor[0],
      sling.y - h * anchor[1],
      w,
      h,
    );
  }

  private drawBand(x1: number, y1: number, x2: number, y2: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  private drawWaitingQueue(ids: string[], sling?: { x: number; y: number }): void {
    if (!sling || ids.length === 0) return;
    const ctx = this.ctx;
    let bx = sling.x - 70;
    const by = sling.y + 6;
    for (const id of ids) {
      const res = this.rm.getImage(id);
      const s = Math.min(res.w, res.h) * 0.8;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(
        res.data as CanvasImageSource,
        bx - s / 2,
        by - s / 2,
        s,
        s,
      );
      ctx.globalAlpha = 1;
      bx -= s + 6;
    }
  }
}
