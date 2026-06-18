/**
 * PhysicsWorld —— 对 Matter.js 的封装。
 *
 * 职责：
 *  - 创建/持有 Engine + World，统一配置重力。
 *  - 提供创建刚体（圆/矩形）的工厂方法，物理参数从 manifest 注入。
 *  - 固定步长推进。
 *  - 统一挂接碰撞事件，分发给上层（实体伤害判定等）。
 *
 * 实体创建方法返回 Matter.Body，实体自己保存引用。
 */

import Matter from 'matter-js';
import type { PhysicsDef } from '@game/types';

export interface CollisionHit {
  /** 主动方刚体 id。 */
  bodyA: Matter.Body;
  /** 被动方刚体 id。 */
  bodyB: Matter.Body;
  /** 碰撞冲量大小（用于伤害计算）。 */
  impulse: number;
  /** 碰撞点的相对速度（用于判断是否"砸到"）。 */
  speed: number;
}

export type CollisionHandler = (hit: CollisionHit) => void;

export class PhysicsWorld {
  readonly engine: Matter.Engine;
  readonly world: Matter.World;
  private collisionHandlers: CollisionHandler[] = [];

  constructor() {
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;
    // 使用 Matter 默认重力（y=1, scale=0.001），保证物理量级符合预期。
    this.engine.gravity.y = 1;
    this.engine.gravity.scale = 0.001;
    this.setupCollision();
  }

  /** 固定步长推进物理。dt 单位为毫秒。 */
  step(dt: number): void {
    Matter.Engine.update(this.engine, dt);
  }

  /** 监听碰撞事件（统一分发）。 */
  onCollision(handler: CollisionHandler): void {
    this.collisionHandlers.push(handler);
  }

  /** 创建圆形刚体（鸟 / 猪）。 */
  createCircle(
    x: number,
    y: number,
    radius: number,
    phys: PhysicsDef,
    label: string,
  ): Matter.Body {
    const area = Math.PI * radius * radius;
    const body = Matter.Bodies.circle(x, y, radius, {
      label,
      restitution: phys.restitution ?? 0.3,
      friction: phys.friction ?? 0.5,
      // 用 density 设定质量，确保 mass/inertia 一致（避免 Body.setMass 的 NaN 问题）。
      density: phys.density ?? (phys.mass != null ? phys.mass / area : 0.001),
      frictionAir: 0.005,
    });
    Matter.Composite.add(this.world, body);
    return body;
  }

  /** 创建矩形刚体（方块 / 地面）。 */
  createRect(
    x: number,
    y: number,
    w: number,
    h: number,
    phys: PhysicsDef,
    label: string,
    isStatic = false,
  ): Matter.Body {
    const area = w * h;
    const body = Matter.Bodies.rectangle(x, y, w, h, {
      label,
      isStatic,
      restitution: phys.restitution ?? 0.2,
      friction: phys.friction ?? 0.6,
      density: phys.density ?? (phys.mass != null ? phys.mass / area : 0.001),
      frictionStatic: 0.8,
    });
    Matter.Composite.add(this.world, body);
    return body;
  }

  /** 创建静态地面带（横跨整个世界底部）。地面做厚，防止高速物体穿透。 */
  createGround(y: number, width: number): Matter.Body {
    const ground = Matter.Bodies.rectangle(width / 2, y + 200, width + 800, 400, {
      isStatic: true,
      label: 'ground',
      friction: 0.9,
      restitution: 0,
    });
    Matter.Composite.add(this.world, ground);
    return ground;
  }

  /** 创建左右边界墙（防止飞出世界外消失太久）。 */
  createWalls(width: number, height: number): void {
    const wallOpts = { isStatic: true, label: 'wall', restitution: 0.2 };
    Matter.Composite.add(this.world, [
      Matter.Bodies.rectangle(-60, height / 2, 120, height * 3, wallOpts),
      Matter.Bodies.rectangle(width + 60, height / 2, 120, height * 3, wallOpts),
      // 顶部天花板，避免飞太高
      Matter.Bodies.rectangle(width / 2, -200, width + 400, 120, wallOpts),
    ]);
  }

  removeBody(body: Matter.Body): void {
    Matter.Composite.remove(this.world, body);
  }

  /** 计算某刚体是否近似静止（用于判断回合结束）。 */
  isResting(body: Matter.Body, threshold = 0.6): boolean {
    const v = body.velocity;
    return Math.hypot(v.x, v.y) < threshold && Math.abs(body.angularVelocity) < 0.02;
  }

  private setupCollision(): void {
    Matter.Events.on(this.engine, 'collisionStart', (evt) => {
      for (const pair of evt.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;
        const va = a.velocity;
        const vb = b.velocity;
        const relSpeed = Math.hypot(va.x - vb.x, va.y - vb.y);
        if (relSpeed < 1.2) continue; // 过轻的接触忽略
        const hit: CollisionHit = {
          bodyA: a,
          bodyB: b,
          impulse: relSpeed,
          speed: relSpeed,
        };
        for (const h of this.collisionHandlers) h(hit);
      }
    });
  }

  destroy(): void {
    Matter.World.clear(this.world, false);
    Matter.Engine.clear(this.engine);
    this.collisionHandlers = [];
  }
}
