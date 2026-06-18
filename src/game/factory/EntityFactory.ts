/**
 * EntityFactory —— 根据资源 id 与位置创建实体。
 *
 * 把"manifest id + 几何参数"翻译成"实体 + 物理刚体"。
 * 所有物理参数来自 ResourceManager（即 manifest.physics），不硬编码。
 * 这里是关卡 JSON 与运行时实体之间的唯一桥梁。
 */

import Matter from 'matter-js';
import type { ResourceManager } from '@infra/ResourceManager';
import type { BirdKind, EntityCategory, EntityDef, LevelObject } from '@game/types';
import type { PhysicsWorld } from '@game/engine/PhysicsWorld';
import { Block } from '@game/entities/Block';
import { Pig } from '@game/entities/Pig';
import { Bird } from '@game/entities/Bird';

export class EntityFactory {
  constructor(
    private rm: ResourceManager,
    private world: PhysicsWorld,
  ) {}

  /** 从 manifest id 解析实体类别。 */
  static categoryOf(id: string): EntityCategory {
    if (id.startsWith('bird.')) return 'bird';
    if (id.startsWith('block.')) return 'block';
    if (id.startsWith('pig.')) return 'pig';
    return 'block';
  }

  static birdKindOf(id: string): BirdKind {
    if (id === 'bird.yellow') return 'yellow';
    if (id === 'bird.blue') return 'blue';
    return 'red';
  }

  private def(id: string): EntityDef {
    const d = this.rm.getEntityDef(id);
    const category = EntityFactory.categoryOf(id);
    return { id, category, image: d.image, physics: d.physics };
  }

  /** 创建关卡中的一个方块/猪。 */
  createFromLevelObject(o: LevelObject): Block | Pig {
    const def = this.def(o.id);
    const w = o.w ?? def.image.w;
    const h = o.h ?? def.image.h;
    if (def.category === 'block') {
      const body = this.world.createRect(o.x, o.y, w, h, def.physics, 'block');
      if (o.angle) Matter.Body.setAngle(body, o.angle);
      return new Block(def, body, w, h);
    }
    // pig：用圆形，半径取较小边的一半
    const radius = Math.min(w, h) / 2;
    const body = this.world.createCircle(o.x, o.y, radius, def.physics, 'pig');
    return new Pig(def, body, radius);
  }

  /** 创建一只鸟（在弹弓位置，初始静态）。 */
  createBird(id: string, x: number, y: number): Bird {
    const def = this.def(id);
    const radius = def.image.w / 2;
    const body = this.world.createCircle(x, y, radius, def.physics, 'bird');
    Matter.Body.setStatic(body, true);
    const kind = EntityFactory.birdKindOf(id);
    return new Bird(def, body, kind, radius);
  }
}
