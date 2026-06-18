import type Matter from 'matter-js';
import type { ImageDef, PhysicsDef } from './assets';

/** 实体类别。 */
export type EntityCategory = 'bird' | 'block' | 'pig' | 'ground';

/** 鸟的种类（决定技能）。 */
export type BirdKind = 'red' | 'yellow' | 'blue';

/** 方块材质。 */
export type BlockMaterial = 'wood' | 'stone' | 'glass';

/** 猪的变体。 */
export type PigVariant = 'normal' | 'helmet';

/** 鸟的状态机。 */
export type BirdState = 'idle' | 'loaded' | 'aiming' | 'flying' | 'spent';

/**
 * 实体定义：把 manifest 中的资源与物理参数聚合后的运行时视图。
 * 实体只持有这些数据，不直接接触文件系统。
 */
export interface EntityDef {
  /** manifest 资源 id。 */
  id: string;
  /** 实体类别。 */
  category: EntityCategory;
  /** 显示参数（来自 manifest images[id]）。 */
  image: ImageDef;
  /** 物理参数（来自 manifest physics[id]）。 */
  physics: PhysicsDef;
}

/** 鸟技能的描述。 */
export interface BirdSkill {
  kind: BirdKind;
  /** 技能是否已经被使用。 */
  used: boolean;
}

/** 游戏对外的事件回调（上抛给 React 外壳）。 */
export interface GameEvents {
  /** HUD 状态更新（剩余鸟、剩余猪）。 */
  onHud?: (hud: HudState) => void;
  /** 胜利。 */
  onWin?: (result: GameResult) => void;
  /** 失败。 */
  onLose?: (result: GameResult) => void;
  /** 资源加载进度 0~1。 */
  onProgress?: (progress: number) => void;
}

export interface HudState {
  /** 剩余未发射的鸟数量。 */
  birdsRemaining: number;
  /** 当前装填的鸟（如已发射则为 null）。 */
  currentBird: BirdKind | null;
  /** 剩余猪数量。 */
  pigsRemaining: number;
  /** 接下来将要发射的鸟种类序列。 */
  queue: BirdKind[];
}

export interface GameResult {
  levelId: string;
  stars: number;
  birdsLeft: number;
}

/** 每帧渲染需要的可绘制对象，由场景产出，Renderer 消费。 */
export interface Renderable {
  body: Matter.Body;
  def: EntityDef;
  /** 实际渲染宽高（可能与贴图原始尺寸不同，方块可拉伸）。 */
  w: number;
  h: number;
  /** 是否为已发射/飞行中的鸟（用于高亮等）。 */
  highlight?: boolean;
  /** 当前血量（方块/猪），用于绘制血条。 */
  hp?: number;
}

/** 轨迹预测点。 */
export interface TrajectoryPoint {
  x: number;
  y: number;
  alpha: number;
}

/** 临时粒子（爆炸碎片等）。 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}
