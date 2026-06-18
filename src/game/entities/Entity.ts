/**
 * Entity —— 所有游戏对象的抽象基类。
 *
 * 实体是"纯逻辑 + 物理刚体引用"的容器，不负责绘制（绘制由 Renderer 统一做）。
 * 解耦：实体只持有 EntityDef（来自 manifest），不知道文件路径。
 */

import Matter from 'matter-js';
import type { EntityCategory, EntityDef } from '@game/types';

export abstract class Entity {
  readonly def: EntityDef;
  readonly body: Matter.Body;
  hp: number;
  alive = true;

  constructor(def: EntityDef, body: Matter.Body) {
    this.def = def;
    this.body = body;
    this.hp = def.physics.hp ?? 1;
    // 反向引用，便于碰撞回调从 body 找到实体
    (body as Matter.Body & { entity?: Entity }).entity = this;
  }

  abstract get category(): EntityCategory;

  /** 渲染宽高（实体物理尺寸）。 */
  abstract get renderW(): number;
  abstract get renderH(): number;

  /** 承受伤害；hp 归零时触发死亡。 */
  onDamage(amount: number): void {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  protected die(): void {
    this.alive = false;
  }
}
