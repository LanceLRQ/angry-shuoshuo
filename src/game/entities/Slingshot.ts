/**
 * Slingshot —— 弹弓（非物理实体）。
 *
 * 管理：
 *  - 当前装填的鸟。
 *  - 拖拽瞄准时的拉伸向量（带最大拉力与角度限制）。
 *  - 发射：把拉伸向量转换为初速度。
 *
 * 不持有 Matter.Body。装填的鸟的 body 由场景创建，
 * 装填期间设为静态/固定位置，发射时解锁并赋予速度。
 */

import type { Bird } from './Bird';
import { SLINGSHOT } from '@game/types';

export interface LaunchInfo {
  /** 发射位置（鸟当前被拉到的位置）。 */
  x: number;
  y: number;
  /** 初速度向量。 */
  vx: number;
  vy: number;
  /** 拉伸力度 0~1（用于音效/特效强度）。 */
  power: number;
  /** 被发射的鸟。 */
  bird: Bird;
}

export class Slingshot {
  readonly x: number;
  readonly y: number;
  /** 当前装填的鸟（null 表示空）。 */
  loaded: Bird | null = null;
  /** 是否正在瞄准（拖拽中）。 */
  aiming = false;
  /** 当前拉伸到的世界坐标（瞄准中），未瞄准时为弹叉中心。 */
  pullX: number;
  pullY: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.pullX = x;
    this.pullY = y;
  }

  load(bird: Bird): void {
    this.loaded = bird;
    bird.state = 'loaded';
    this.pullX = this.x;
    this.pullY = this.y;
  }

  /** 开始瞄准（按下弹弓区域）。 */
  beginAim(): void {
    if (!this.loaded) return;
    this.aiming = true;
    this.loaded.state = 'aiming';
  }

  /**
   * 拖拽更新：把目标点钳制到合法扇区与最大拉力内。
   * 返回实际生效的拉伸点。
   */
  updateAim(worldX: number, worldY: number): { x: number; y: number; power: number } {
    let dx = worldX - this.x;
    let dy = worldY - this.y;
    let dist = Math.hypot(dx, dy);

    // 限制最大拉伸
    if (dist > SLINGSHOT.maxStretch) {
      dx = (dx / dist) * SLINGSHOT.maxStretch;
      dy = (dy / dist) * SLINGSHOT.maxStretch;
      dist = SLINGSHOT.maxStretch;
    }

    // 角度限制：仅允许朝右发射 → 拉伸方向必须朝左
    // 即 dx 应为负（鸟在弹弓左侧）。若用户拖到右侧，镜像钳制。
    if (dx > 0) dx = 0;

    this.pullX = this.x + dx;
    this.pullY = this.y + dy;
    const power = Math.min(1, dist / SLINGSHOT.maxStretch);
    return { x: this.pullX, y: this.pullY, power };
  }

  /** 预测发射后的初速度（用于绘制轨迹，不实际发射）。 */
  predictVelocity(): { vx: number; vy: number } {
    const dx = this.x - this.pullX;
    const dy = this.y - this.pullY;
    return {
      vx: dx * SLINGSHOT.powerScale,
      vy: dy * SLINGSHOT.powerScale,
    };
  }

  /** 发射。返回发射信息（含被发射的鸟），并把鸟移出弹弓。 */
  launch(): LaunchInfo | null {
    if (!this.loaded) return null;
    const bird = this.loaded;
    const v = this.predictVelocity();
    const dist = Math.hypot(this.pullX - this.x, this.pullY - this.y);
    if (dist < 12) {
      // 拉力太小，取消发射，鸟留在弹弓
      this.aiming = false;
      bird.state = 'loaded';
      this.pullX = this.x;
      this.pullY = this.y;
      return null;
    }
    const power = Math.min(1, dist / SLINGSHOT.maxStretch);
    this.loaded = null;
    this.aiming = false;
    return { x: this.pullX, y: this.pullY, vx: v.vx, vy: v.vy, power, bird };
  }

  /** 预测若干个轨迹采样点（用于虚线提示）。 */
  predictTrajectory(samples = 18, dtMs = 60): Array<{ x: number; y: number }> {
    const v = this.predictVelocity();
    const pts: Array<{ x: number; y: number }> = [];
    let x = this.pullX;
    let y = this.pullY;
    let vx = v.vx;
    let vy = v.vy;
    // 重力近似（与 PhysicsWorld 配置匹配）
    const g = 1.6 * 0.0014 * 1000; // 经验值，使轨迹与实际接近
    const dt = dtMs / 1000;
    for (let i = 0; i < samples; i++) {
      vy += g * dt;
      x += vx * (dtMs / (1000 / 60));
      y += vy * (dtMs / (1000 / 60));
      pts.push({ x, y });
    }
    return pts;
  }
}
