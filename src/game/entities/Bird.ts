/**
 * Bird —— 弹丸（红鸟 / 黄鸟 / 蓝鸟）。
 *
 * 三种技能：
 *  - red    ：无技能（基础高伤）。
 *  - yellow ：技能 = 瞬时沿当前方向加速（突破防御）。
 *  - blue   ：技能 = 分裂为 3 只小鸟，扩散覆盖更大范围。
 *
 * 状态机：idle（等待）→ loaded（已装填到弹弓）→ aiming（被拖拽）
 *        → flying（已发射）→ spent（用完/落地）。
 *
 * 技能触发由 InputSystem 在飞行中点击屏幕调用 triggerSkill()，
 * 分裂逻辑由 LevelScene 接管（因为要往场景里加新实体）。
 */

import Matter from 'matter-js';
import type { BirdKind, BirdState, EntityCategory, EntityDef } from '@game/types';
import { BIRD_SKILLS } from '@game/types';
import { Entity } from './Entity';

export class Bird extends Entity {
  readonly kind: BirdKind;
  readonly radius: number;
  state: BirdState = 'idle';
  /** 技能是否已使用。 */
  skillUsed = false;
  /** 技能触发回调（分裂时由场景接管，生成新鸟）。 */
  onSplit?: (bird: Bird) => void;

  constructor(def: EntityDef, body: Matter.Body, kind: BirdKind, radius: number) {
    super(def, body);
    this.kind = kind;
    this.radius = radius;
  }

  get category(): EntityCategory {
    return 'bird';
  }
  get renderW(): number {
    return this.radius * 2;
  }
  get renderH(): number {
    return this.radius * 2;
  }

  /** 触发本鸟技能（仅飞行中有效）。返回是否成功触发。 */
  triggerSkill(): boolean {
    if (this.state !== 'flying' || this.skillUsed) return false;
    if (this.kind === 'red') return false;

    this.skillUsed = true;

    if (this.kind === 'yellow') {
      // 沿当前速度方向加速
      const v = this.body.velocity;
      const speed = Math.hypot(v.x, v.y);
      if (speed > 0.1) {
        Matter.Body.setVelocity(this.body, {
          x: v.x * BIRD_SKILLS.yellowSpeedBoost,
          y: v.y * BIRD_SKILLS.yellowSpeedBoost,
        });
      }
      return true;
    }

    if (this.kind === 'blue') {
      // 分裂：交给场景创建额外 2 只鸟
      this.onSplit?.(this);
      return true;
    }

    return false;
  }

  /** 标记为已用完（落地或飞出）。 */
  markSpent(): void {
    if (this.state === 'spent') return;
    this.state = 'spent';
  }

  /** 鸟是否应该被视为"本回合结束"（已用完且基本静止或出界）。 */
  isFinished(worldWidth: number, worldHeight: number): boolean {
    if (this.state !== 'flying' && this.state !== 'spent') return false;
    const p = this.body.position;
    const out = p.x < -100 || p.x > worldWidth + 200 || p.y > worldHeight + 200;
    const v = this.body.velocity;
    const slow = Math.hypot(v.x, v.y) < 0.8;
    return out || (this.state === 'spent' && slow);
  }
}
