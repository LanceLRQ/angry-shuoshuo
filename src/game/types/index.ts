export * from './assets';
export * from './entities';

/** 游戏世界尺寸（世界坐标系，固定值）。 */
export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;

/** 物理世界的 y 方向重力加速度（matter-js 用，正值向下）。 */
export const GRAVITY_Y = 1.6;

/** 固定物理步长（秒）。主循环用累加器保证稳定。 */
export const FIXED_DT = 1000 / 60;

/** 弹弓相关调参（游戏手感，与美术资源无关）。 */
export const SLINGSHOT = {
  /** 最大拉伸距离（px，世界坐标）。 */
  maxStretch: 130,
  /** 发射力度系数：速度 = 拉伸向量 * 该系数。 */
  powerScale: 0.22,
  /** 限制发射角度扇区（仅允许朝右发射）。 */
  minAngleDeg: -85,
  maxAngleDeg: 85,
} as const;

/** 鸟技能参数。 */
export const BIRD_SKILLS = {
  /** 黄鸟：技能触发后水平加速倍数。 */
  yellowSpeedBoost: 2.4,
  /** 蓝鸟：分裂后产生的鸟数量（含原鸟）。 */
  blueSplitCount: 3,
  /** 蓝鸟分裂后的扩散角度（弧度）。 */
  blueSpreadRad: 0.35,
} as const;
