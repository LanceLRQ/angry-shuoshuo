/**
 * Block —— 可被摧毁的方块（木头 / 石头 / 玻璃）。
 *
 * 受到足够冲量的碰撞时掉血；血量归零时销毁并产生碎片粒子。
 * 碰撞音效由 AudioManager 根据材质 id 决定（不在实体内硬编码）。
 */

import type Matter from 'matter-js';
import type { EntityCategory, EntityDef } from '@game/types';
import { Entity } from './Entity';

export class Block extends Entity {
  readonly w: number;
  readonly h: number;

  constructor(def: EntityDef, body: Matter.Body, w: number, h: number) {
    super(def, body);
    this.w = w;
    this.h = h;
  }

  get category(): EntityCategory {
    return 'block';
  }
  get renderW(): number {
    return this.w;
  }
  get renderH(): number {
    return this.h;
  }
}
