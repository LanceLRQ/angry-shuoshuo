/**
 * Pig —— 敌人（普通猪 / 戴帽猪）。
 *
 * 圆形刚体。被砸到掉血，死亡时游戏目标进度 +1。
 * 全部猪死亡 = 关卡胜利（由 LevelScene 判定）。
 */

import type Matter from 'matter-js';
import type { EntityCategory, EntityDef } from '@game/types';
import { Entity } from './Entity';

export class Pig extends Entity {
  readonly radius: number;

  constructor(def: EntityDef, body: Matter.Body, radius: number) {
    super(def, body);
    this.radius = radius;
  }

  get category(): EntityCategory {
    return 'pig';
  }
  get renderW(): number {
    return this.radius * 2;
  }
  get renderH(): number {
    return this.radius * 2;
  }
}
