/**
 * LevelScene —— 一局的完整运行时状态（场景大脑）。
 *
 * 职责：
 *  - 按关卡 JSON 组装实体（方块/猪/鸟队列/弹弓/地面/边界）。
 *  - 接管输入：弹弓瞄准/发射、飞行中技能触发。
 *  - 处理碰撞：把冲量转为伤害，触发音效与粒子。
 *  - 蓝鸟分裂：在飞行中生成额外 2 只鸟。
 *  - 胜负判定：所有猪死亡=胜利；鸟用光且仍有猪=失败。
 *  - 产出 RenderLayer 供 Renderer 绘制。
 *
 * 与 React 外壳的通信：通过 events 回调上抛 HUD/胜负。
 */

import Matter from 'matter-js';
import type { ResourceManager } from '@infra/ResourceManager';
import type { AudioManager } from '@game/systems/AudioManager';
import type {
  EntityDef,
  GameEvents,
  HudState,
  LevelData,
  Particle,
  Renderable,
} from '@game/types';
import { BIRD_SKILLS, WORLD_HEIGHT, WORLD_WIDTH } from '@game/types';
import { PhysicsWorld } from '@game/engine/PhysicsWorld';
import { EntityFactory } from '@game/factory/EntityFactory';
import { Bird } from '@game/entities/Bird';
import { Block } from '@game/entities/Block';
import { Pig } from '@game/entities/Pig';
import { Slingshot } from '@game/entities/Slingshot';
import { computeStars } from '@game/systems/Scoring';

const GROUND_Y = 700; // 地面顶部 y（世界坐标）

/**
 * Matter.Body 上参与 Verlet 积分的内部字段（@types/matter-js 未暴露）。
 * 发射时需要手动重置它们，否则 setStatic(false) 残留的旧积分状态会让
 * 后续 setVelocity 计算出错。
 */
interface IntegrableBody {
  deltaTime: number;
  positionPrev: { x: number; y: number };
  anglePrev: number;
}

export class LevelScene {
  readonly world: PhysicsWorld;
  private factory: EntityFactory;
  private slingshot: Slingshot;
  private data: LevelData;

  private blocks: Block[] = [];
  private pigs: Pig[] = [];
  /** 当前飞行中的所有鸟（含分裂产生的）。 */
  private flyingBirds: Bird[] = [];
  /** 等待发射的鸟 id 队列。 */
  private waitingQueue: string[] = [];

  private particles: Particle[] = [];
  /** 胜负已结算标记。 */
  private settled = false;
  /** 当前飞行鸟发射后的累计时间（用于判定回合结束）。 */
  private flightTime = 0;
  private startTime = 0;
  private elapsedSec = 0;

  /** 当前装填鸟被拖到的位置（绘制弹带用）。 */
  private loadedBirdPos: { x: number; y: number } | null = null;

  constructor(
    rm: ResourceManager,
    private audio: AudioManager,
    data: LevelData,
    private events: GameEvents = {},
  ) {
    this.data = data;
    this.world = new PhysicsWorld();
    this.factory = new EntityFactory(rm, this.world);
    this.slingshot = new Slingshot(data.sling.x, data.sling.y);
    this.build();
  }

  // ── 组装 ──────────────────────────────────────────────────────────────
  private build(): void {
    // 地面与边界
    this.world.createGround(GROUND_Y, WORLD_WIDTH);
    this.world.createWalls(WORLD_WIDTH, WORLD_HEIGHT);

    // 方块与猪
    for (const o of this.data.objects) {
      const e = this.factory.createFromLevelObject(o);
      if (e instanceof Block) this.blocks.push(e);
      else if (e instanceof Pig) this.pigs.push(e);
    }

    // 鸟队列（按关卡定义的顺序）
    this.waitingQueue = [...this.data.birds];
    this.loadNextBird();

    // 碰撞监听
    this.world.onCollision((hit) => this.handleCollision(hit));

    this.startTime = performance.now();
  }

  private loadNextBird(): void {
    if (this.waitingQueue.length === 0) return;
    const id = this.waitingQueue.shift()!;
    const bird = this.factory.createBird(id, this.slingshot.x, this.slingshot.y - 30);
    bird.onSplit = (b) => this.handleSplit(b);
    this.slingshot.load(bird);
    this.emitHud();
  }

  // ── 输入处理 ──────────────────────────────────────────────────────────
  onPointerDown(x: number, y: number): void {
    if (this.settled) return;
    this.audio.resume();

    // 若有飞行中的鸟，点击=触发技能（而非瞄准）
    if (this.flyingBirds.some((b) => b.state === 'flying')) {
      this.triggerSkillOnFirst();
      return;
    }

    // 瞄准：只要弹弓装填了鸟就开始（放宽命中区，便于触屏）
    if (this.slingshot.loaded) {
      this.slingshot.beginAim();
      const aim = this.slingshot.updateAim(x, y);
      this.loadedBirdPos = { x: aim.x, y: aim.y };
      if (this.slingshot.loaded) {
        Matter.Body.setPosition(this.slingshot.loaded.body, {
          x: aim.x,
          y: aim.y,
        });
      }
      if (aim.power > 0.05) this.audio.play('sfx.stretch', { throttleMs: 120 });
    }
  }

  onPointerMove(x: number, y: number): void {
    if (this.settled || !this.slingshot.aiming || !this.slingshot.loaded) return;
    const aim = this.slingshot.updateAim(x, y);
    this.loadedBirdPos = { x: aim.x, y: aim.y };
    Matter.Body.setPosition(this.slingshot.loaded.body, { x: aim.x, y: aim.y });
  }

  onPointerUp(): void {
    if (this.settled || !this.slingshot.aiming) {
      this.loadedBirdPos = null;
      return;
    }
    const info = this.slingshot.launch();
    this.loadedBirdPos = null;
    if (!info) return;

    const launched = info.bird;
    const body = launched.body as Matter.Body & IntegrableBody;
    // 解除静态。setStatic(false) 会恢复 _original 但不重置 deltaTime/positionPrev，
    // 导致后续 setVelocity 用的 Verlet 基准错误。这里手动重置积分状态。
    Matter.Body.setStatic(body, false);
    body.deltaTime = 1000 / 60;
    // 把鸟放到弹弓释放点，并同步 positionPrev（避免残留位移被当成速度）
    body.position.x = info.x;
    body.position.y = info.y;
    body.positionPrev.x = info.x;
    body.positionPrev.y = info.y;
    body.anglePrev = body.angle;
    Matter.Body.setVelocity(body, { x: info.vx, y: info.vy });
    launched.state = 'flying';
    this.flyingBirds.push(launched);
    this.flightTime = 0;
    this.audio.play('sfx.launch');
    this.emitHud();
  }

  // ── 技能 ──────────────────────────────────────────────────────────────
  private triggerSkillOnFirst(): void {
    const b = this.flyingBirds.find((x) => x.state === 'flying' && !x.skillUsed);
    if (!b) return;
    if (b.triggerSkill()) this.audio.play('sfx.skill');
  }

  triggerSkill(): void {
    this.triggerSkillOnFirst();
  }

  /** 蓝鸟分裂：基于原鸟生成额外小鸟。 */
  private handleSplit(bird: Bird): void {
    const v = bird.body.velocity;
    const speed = Math.hypot(v.x, v.y) || 1;
    const baseAngle = Math.atan2(v.y, v.x);
    const def: EntityDef = bird.def;
    const radius = bird.radius * 0.7;

    for (let i = 1; i < BIRD_SKILLS.blueSplitCount; i++) {
      const offset =
        (i - (BIRD_SKILLS.blueSplitCount - 1) / 2) * BIRD_SKILLS.blueSpreadRad;
      const ang = baseAngle + offset;
      const body = this.world.createCircle(
        bird.body.position.x,
        bird.body.position.y,
        radius,
        def.physics,
        'bird',
      );
      Matter.Body.setVelocity(body, {
        x: Math.cos(ang) * speed,
        y: Math.sin(ang) * speed,
      });
      const newDef: EntityDef = { ...def, image: { ...def.image, w: radius * 2, h: radius * 2 } };
      const nb = new Bird(newDef, body, 'blue', radius);
      nb.state = 'flying';
      nb.skillUsed = true;
      nb.onSplit = (b2) => this.handleSplit(b2);
      this.flyingBirds.push(nb);
    }
    this.audio.play('sfx.skill');
  }

  // ── 碰撞伤害 ──────────────────────────────────────────────────────────
  private handleCollision(hit: { bodyA: Matter.Body; bodyB: Matter.Body; impulse: number }): void {
    const a = this.entityOf(hit.bodyA);
    const b = this.entityOf(hit.bodyB);
    // 冲量转伤害（调参）
    const dmg = Math.max(0, (hit.impulse - 3) * 6);
    if (dmg < 1) return;

    let hitMaterialId: string | null = null;
    if (a instanceof Block && a.alive) {
      a.onDamage(dmg);
      hitMaterialId = a.def.id;
      this.spawnParticles(a.body.position.x, a.body.position.y, a.def, 4);
    }
    if (b instanceof Block && b.alive) {
      b.onDamage(dmg);
      hitMaterialId = b.def.id;
      this.spawnParticles(b.body.position.x, b.body.position.y, b.def, 4);
    }
    if (a instanceof Pig && a.alive) {
      a.onDamage(dmg);
      if (!a.alive) this.onPigKilled(a);
    }
    if (b instanceof Pig && b.alive) {
      b.onDamage(dmg);
      if (!b.alive) this.onPigKilled(b);
    }

    // 材质碰撞音
    if (hitMaterialId) {
      if (hitMaterialId.includes('wood')) this.audio.play('sfx.hit_wood', { throttleMs: 80 });
      else if (hitMaterialId.includes('stone')) this.audio.play('sfx.hit_stone', { throttleMs: 80 });
      else if (hitMaterialId.includes('glass')) this.audio.play('sfx.hit_glass', { throttleMs: 80 });
    }
  }

  private onPigKilled(pig: Pig): void {
    this.audio.play('sfx.pig_pop');
    this.spawnParticles(pig.body.position.x, pig.body.position.y, pig.def, 12, true);
    this.world.removeBody(pig.body);
    this.emitHud();
  }

  private entityOf(body: Matter.Body): Bird | Block | Pig | null {
    const e = (body as Matter.Body & { entity?: Bird | Block | Pig }).entity;
    return e ?? null;
  }

  // ── 粒子 ──────────────────────────────────────────────────────────────
  private spawnParticles(
    x: number,
    y: number,
    def: EntityDef,
    count: number,
    big = false,
  ): void {
    const color = this.colorFor(def.id);
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = (big ? 4 : 2) + Math.random() * (big ? 4 : 2);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - (big ? 2 : 0),
        life: 1,
        color,
        size: (big ? 4 : 2) + Math.random() * 3,
      });
    }
  }

  private colorFor(id: string): string {
    if (id.includes('wood')) return '#a9743b';
    if (id.includes('stone')) return '#9ca3af';
    if (id.includes('glass')) return '#7dd3fc';
    if (id.includes('pig')) return '#86c04a';
    return '#cccccc';
  }

  // ── 主循环更新 ────────────────────────────────────────────────────────
  update(dtMs: number): void {
    if (this.settled) {
      this.updateParticles(dtMs);
      return;
    }
    this.elapsedSec = (performance.now() - this.startTime) / 1000;

    this.world.step(dtMs);
    this.updateParticles(dtMs);

    // 清理死亡方块（碰撞致死的方块需移除刚体）
    for (const blk of this.blocks) {
      if (!blk.alive && this.world) {
        // 只移除一次
        if ((blk.body as Matter.Body & { removed?: boolean }).removed) continue;
        (blk.body as Matter.Body & { removed?: boolean }).removed = true;
        this.audio.play('sfx.block_break', { throttleMs: 70 });
        this.spawnParticles(blk.body.position.x, blk.body.position.y, blk.def, 10);
        this.world.removeBody(blk.body);
      }
    }

    // 飞行鸟状态推进
    if (this.flyingBirds.length > 0) {
      this.flightTime += dtMs;
      for (const b of this.flyingBirds) {
        if (b.state !== 'flying') continue;
        if (b.isFinished(WORLD_WIDTH, WORLD_HEIGHT)) {
          b.markSpent();
        }
      }
      // 所有飞行鸟都结束 → 装填下一只或判负
      const allDone = this.flyingBirds.every((b) => b.state === 'spent');
      if (allDone && this.flightTime > 200) {
        for (const b of this.flyingBirds) this.world.removeBody(b.body);
        this.flyingBirds = [];
        if (this.waitingQueue.length > 0) {
          this.loadNextBird();
        } else {
          // 没鸟了，延迟一下再判负（等物体静止）
          this.checkLose();
        }
      }
    }

    this.checkWin();
  }

  private updateParticles(dtMs: number): void {
    const dt = dtMs / 16;
    for (const p of this.particles) {
      p.vy += 0.3 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= 0.03 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  // ── 胜负 ──────────────────────────────────────────────────────────────
  private checkWin(): void {
    if (this.settled) return;
    const alive = this.pigs.filter((p) => p.alive).length;
    if (alive === 0) {
      this.settled = true;
      const birdsLeft = this.waitingQueue.length + (this.slingshot.loaded ? 1 : 0);
      const stars = computeStars(this.data.goal.stars, {
        birdsLeft,
        timeSec: this.elapsedSec,
      });
      this.audio.play('sfx.win');
      this.events.onWin?.({
        levelId: this.data.id,
        stars,
        birdsLeft,
      });
    }
  }

  private checkLose(): void {
    if (this.settled) return;
    // 鸟已用光，等所有物体基本静止后判负
    const allRest = [...this.blocks, ...this.pigs].every((e) => {
      if (!e.alive) return true;
      return this.world.isResting(e.body, 0.8);
    });
    if (allRest && this.pigs.some((p) => p.alive)) {
      this.settled = true;
      this.audio.play('sfx.lose');
      this.events.onLose?.({
        levelId: this.data.id,
        stars: 0,
        birdsLeft: 0,
      });
    }
  }

  // ── HUD / 渲染数据 ────────────────────────────────────────────────────
  private emitHud(): void {
    if (!this.events.onHud) return;
    const queue = this.waitingQueue.map((id) =>
      id === 'bird.yellow' ? 'yellow' : id === 'bird.blue' ? 'blue' : 'red',
    );
    const current = this.slingshot.loaded
      ? this.slingshot.loaded.kind
      : (this.flyingBirds.find((b) => b.state === 'flying')?.kind ?? null);
    const hud: HudState = {
      birdsRemaining: this.waitingQueue.length + (this.slingshot.loaded ? 1 : 0),
      currentBird: current,
      pigsRemaining: this.pigs.filter((p) => p.alive).length,
      queue,
    };
    this.events.onHud(hud);
  }

  /** 产出本帧的渲染层。 */
  getRenderLayer() {
    const renderables: Renderable[] = [];

    for (const b of this.blocks) {
      if (!b.alive) continue;
      renderables.push({
        body: b.body,
        def: b.def,
        w: b.renderW,
        h: b.renderH,
        hp: b.hp,
      });
    }
    for (const p of this.pigs) {
      if (!p.alive) continue;
      renderables.push({
        body: p.body,
        def: p.def,
        w: p.renderW,
        h: p.renderH,
        hp: p.hp,
      });
    }
    // 装填鸟
    if (this.slingshot.loaded) {
      renderables.push({
        body: this.slingshot.loaded.body,
        def: this.slingshot.loaded.def,
        w: this.slingshot.loaded.renderW,
        h: this.slingshot.loaded.renderH,
        highlight: this.slingshot.aiming,
      });
    }
    // 飞行鸟
    for (const b of this.flyingBirds) {
      if (b.state === 'spent') continue;
      renderables.push({
        body: b.body,
        def: b.def,
        w: b.renderW,
        h: b.renderH,
        highlight: true,
      });
    }

    // 轨迹预测
    const trajectory =
      this.slingshot.aiming && this.slingshot.loaded
        ? this.slingshot.predictTrajectory().map((p, i, arr) => ({
            x: p.x,
            y: p.y,
            alpha: 1 - i / arr.length,
          }))
        : [];

    // 等待区鸟 id（不含当前装填的）
    const waitingBirdIds = [...this.waitingQueue];

    return {
      renderables,
      bgId: this.data.bg,
      trajectory,
      waitingBirdIds,
      sling: { x: this.slingshot.x, y: this.slingshot.y },
      loadedBirdPos: this.loadedBirdPos,
      particles: this.particles,
    };
  }

  // ── 重置 ──────────────────────────────────────────────────────────────
  destroy(): void {
    this.world.destroy();
    this.blocks = [];
    this.pigs = [];
    this.flyingBirds = [];
    this.particles = [];
  }
}
