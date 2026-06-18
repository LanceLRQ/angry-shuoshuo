/**
 * 资源 / 关卡数据的 TypeScript 契约。
 *
 * 所有游戏代码只引用这些类型与 manifest id（字符串常量），
 * 永远不出现文件路径。这是"换素材不改代码"的类型层保证。
 */

/** manifest 中单个图片资源的定义。 */
export interface ImageDef {
  /** 相对于 assets 根目录的路径；文件缺失时回退到程序化占位图。 */
  src: string;
  /** 贴图原始宽（px），用于回退占位图与默认渲染。 */
  w: number;
  /** 贴图原始高（px）。 */
  h: number;
  /** 锚点 [x,y]，取值 0~1，默认 [0.5,0.5]（中心对齐物理体）。 */
  anchor?: [number, number];
  /** 九宫格切片 [top,right,bottom,left]，启用后可拉伸适配任意尺寸。 */
  slice?: [number, number, number, number];
}

/** manifest 中单个音频资源的定义。 */
export interface AudioDef {
  /** 相对于 assets 根目录的路径；文件缺失时回退到 Web Audio 合成音。 */
  src: string;
}

/** manifest 中单个实体的物理参数。 */
export interface PhysicsDef {
  /** 质量（影响碰撞冲量分配）。 */
  mass?: number;
  /** 血量（仅 block/pig）。 */
  hp?: number;
  /** 弹性恢复系数 0~1。 */
  restitution?: number;
  /** 摩擦系数 0~1。 */
  friction?: number;
  /** 密度（与质量二选一，matter-js 用）。 */
  density?: number;
}

/** 完整 manifest 结构。 */
export interface AssetManifest {
  version: number;
  /** 可选：可用关卡 id 清单。缺失时使用内置默认清单。 */
  levelIds?: string[];
  images: Record<string, ImageDef>;
  audio: Record<string, AudioDef>;
  physics: Record<string, PhysicsDef>;
}

/** 关卡中的一个对象（方块 / 猪 / 装饰物）。 */
export interface LevelObject {
  /** 实体类别，决定工厂如何创建。 */
  type: 'block' | 'pig';
  /** manifest 中的资源 id，如 'block.wood'。 */
  id: string;
  /** 世界坐标 x（中心点）。 */
  x: number;
  /** 世界坐标 y（中心点）。 */
  y: number;
  /** 宽（px）。缺失时使用贴图 w。 */
  w?: number;
  /** 高（px）。缺失时使用贴图 h。 */
  h?: number;
  /** 初始旋转角度（弧度）。 */
  angle?: number;
}

/** 星级评分规则：键为星级（1/2/3），值为表达式字符串。 */
export type StarGoals = Record<string, string>;

/** 单关数据。 */
export interface LevelData {
  id: string;
  /** 背景 manifest id。 */
  bg: string;
  /** 弹弓位置（世界坐标）。 */
  sling: { x: number; y: number };
  /** 按发射顺序排列的鸟 manifest id。 */
  birds: string[];
  /** 星级评分规则。 */
  goal: { stars: StarGoals };
  /** 关卡中除鸟外的所有对象。 */
  objects: LevelObject[];
}
