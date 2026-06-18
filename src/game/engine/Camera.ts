/**
 * Camera —— 世界坐标 ↔ 屏幕坐标变换。
 *
 * MVP 实现：把固定的世界尺寸（1280×720）按宽高比 letterbox 填充 canvas，
 * 同时处理 devicePixelRatio 高清屏。
 * 预留 scale/offset 字段，便于后续扩展滚动与缩放（不改动 Renderer）。
 */

import { WORLD_HEIGHT, WORLD_WIDTH } from '@game/types';

export class Camera {
  /** 当前 canvas 的 CSS 像素宽高。 */
  private cssW = 0;
  private cssH = 0;
  /** 世界→屏幕的统一缩放系数。 */
  scale = 1;
  /** 画面偏移（屏幕像素，绘制原点）。 */
  offsetX = 0;
  offsetY = 0;
  /** 设备像素比。 */
  private dpr = 1;

  /** 当 canvas 尺寸变化时调用，重算 letterbox 参数。 */
  resize(cssW: number, cssH: number, dpr: number): void {
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
    this.recompute();
  }

  private recompute(): void {
    const sx = this.cssW / WORLD_WIDTH;
    const sy = this.cssH / WORLD_HEIGHT;
    this.scale = Math.min(sx, sy);
    // 居中
    this.offsetX = (this.cssW - WORLD_WIDTH * this.scale) / 2;
    this.offsetY = (this.cssH - WORLD_HEIGHT * this.scale) / 2;
  }

  get devicePixelRatio(): number {
    return this.dpr;
  }

  /** 屏幕坐标（CSS px）→ 世界坐标。 */
  screenToWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.offsetX) / this.scale,
      y: (y - this.offsetY) / this.scale,
    };
  }

  /**
   * 在 ctx 上应用相机变换。
   * 调用方应在 ctx.save() 后调用，绘制完成后 ctx.restore()。
   */
  apply(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(
      this.dpr * this.scale,
      0,
      0,
      this.dpr * this.scale,
      this.dpr * this.offsetX,
      this.dpr * this.offsetY,
    );
  }

  /** 清屏并绘制 letterbox 黑边（在相机变换之外，使用屏幕坐标）。 */
  clear(ctx: CanvasRenderingContext2D, color = '#0f1020'): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.cssW * this.dpr, this.cssH * this.dpr);
  }
}
