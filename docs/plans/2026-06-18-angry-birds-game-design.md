# 愤怒的硕硕（Angry Shuoshuo）— 游戏设计文档

> 类《愤怒的小鸟》HTML5 网页游戏。Matter.js + Canvas 2D + React 19 + Vite + TS。
> 核心约束：游戏逻辑与资源完全解耦，美术/音效/关卡数据可后期替换且无需修改代码。

## 1. 技术栈

| 层 | 选型 |
|----|------|
| 构建 | Vite 5 + TypeScript 5（strict） |
| 页面基底 | React 19 + React Router |
| 状态管理 | Zustand（跨页面共享进度/设置） |
| 游戏引擎 | Matter.js（物理）+ 自研 Canvas 2D 渲染层 |
| 音效 | Web Audio API（合成占位音 + manifest 加载真实音，统一接口） |
| 样式 | Tailwind CSS（仅 UI 外壳，不污染 Canvas） |
| 包管理 | pnpm |

**关键决策**：不引入游戏框架（Phaser 等）。自己拥有渲染管线和资源层，是"换素材不改代码"这一硬约束最可靠的保证。

## 2. 目录结构（三层分离）

```
src/
├── app/                      # React 外壳层（页面、路由、UI 组件）
│   ├── routes/               # 首页/选关/游戏/设置
│   ├── components/ui/        # 按钮、HUD、对话框等
│   └── store/                # Zustand: 进度、设置
├── game/                     # 游戏核心层（纯 TS，不依赖 React）
│   ├── engine/               # Matter.js 封装、主循环、相机
│   │   ├── GameLoop.ts
│   │   ├── PhysicsWorld.ts
│   │   ├── Renderer.ts
│   │   └── Camera.ts
│   ├── entities/             # 游戏对象（只用 manifest id）
│   │   ├── Bird.ts
│   │   ├── Block.ts
│   │   ├── Pig.ts
│   │   └── Slingshot.ts
│   ├── factory/              # 从关卡 JSON 构建实体
│   ├── systems/              # 输入(键鼠+触摸)、技能、评分、音效触发
│   ├── scene/                # LevelScene：组装一关的所有内容
│   └── types/                # 实体/关卡/manifest 的 TS 类型
├── assets/                   # 资源层（所有可替换内容都在这）
│   ├── manifest.json         # id→路径+显示参数（替换素材改这里）
│   ├── levels/               # level-01.json, level-02.json ...
│   ├── images/               # 原创素材放这（占位阶段可空）
│   └── audio/                # 原创音效放这（占位阶段可空）
└── infra/                    # 资源加载与解耦的关键
    ├── ResourceManager.ts    # 加载 manifest + 资源，按 id 查询
    ├── PlaceholderAssets.ts  # 程序化生成占位图/音（manifest 引用时才生成）
    └── AssetLoader.ts        # 异步加载图片/音频，带进度
```

**核心解耦点**：`game/` 下所有代码**只引用 manifest id**（如 `'bird.red'`），**永远不出现文件路径**。`infra/ResourceManager.ts` 是唯一接触文件的地方。替换素材 = 改 `assets/manifest.json`，零代码改动。

## 3. 资源 manifest 格式

`assets/manifest.json` —— 资源注册表：

```jsonc
{
  "version": 1,
  "images": {
    "bird.red":    { "src": "images/bird-red.png", "w": 42, "h": 42, "anchor": [0.5, 0.5] },
    "block.wood":  { "src": "images/block-wood.png", "w": 60, "h": 60, "anchor": [0.5, 0.5], "slice": [20,20,20,20] },
    "block.stone": { "src": "images/block-stone.png", "w": 60, "h": 60, "anchor": [0.5, 0.5], "slice": [20,20,20,20] },
    "block.glass": { "src": "images/block-glass.png", "w": 60, "h": 60, "anchor": [0.5, 0.5], "slice": [20,20,20,20] },
    "pig.normal":  { "src": "images/pig-normal.png", "w": 44, "h": 44, "anchor": [0.5, 0.5] },
    "pig.helmet":  { "src": "images/pig-helmet.png", "w": 48, "h": 48, "anchor": [0.5, 0.5] },
    "sling":       { "src": "images/slingshot.png", "w": 80, "h": 120, "anchor": [0.5, 0.92] },
    "bg.level1":   { "src": "images/bg-level1.jpg", "w": 1280, "h": 720 }
  },
  "audio": {
    "sfx.launch":    { "src": "audio/launch.mp3" },
    "sfx.hit_wood":  { "src": "audio/hit-wood.mp3" },
    "sfx.hit_stone": { "src": "audio/hit-stone.mp3" },
    "sfx.hit_glass": { "src": "audio/hit-glass.mp3" },
    "sfx.pig_pop":   { "src": "audio/pig-pop.mp3" },
    "sfx.win":       { "src": "audio/win.mp3" },
    "sfx.lose":      { "src": "audio/lose.mp3" }
  },
  "physics": {
    "bird.red":    { "mass": 5, "restitution": 0.4, "friction": 0.5 },
    "block.wood":  { "mass": 3, "hp": 60,  "restitution": 0.2, "friction": 0.6 },
    "block.stone": { "mass": 8, "hp": 200, "restitution": 0.1, "friction": 0.8 },
    "block.glass": { "mass": 2, "hp": 25,  "restitution": 0.3, "friction": 0.4 },
    "pig.normal":  { "mass": 4, "hp": 40 },
    "pig.helmet":  { "mass": 4, "hp": 90 }
  }
}
```

要点：
- 代码只用 id，路径/尺寸/锚点/九宫格切片/物理参数全部在 manifest。
- `slice`（九宫格）让方块贴图能拉伸适配任意尺寸。
- 缺失的 `src` 文件 → 自动回退到程序化占位资源（纯色 + emoji），保证未就位时游戏仍可运行。

## 4. 关卡数据格式

`assets/levels/level-01.json`：

```jsonc
{
  "id": "level-01",
  "bg": "bg.level1",
  "sling": { "x": 200, "y": 540 },
  "birds": ["bird.red", "bird.yellow", "bird.red"],
  "goal": { "stars": { "3": "birdsLeft>=2", "2": "birdsLeft>=1", "1": "win" } },
  "objects": [
    { "type": "block", "id": "block.wood",  "x": 900, "y": 600, "w": 20, "h": 120, "angle": 0 },
    { "type": "block", "id": "block.wood",  "x": 1000,"y": 600, "w": 20, "h": 120, "angle": 0 },
    { "type": "block", "id": "block.glass", "x": 950, "y": 530, "w": 140,"h": 20,  "angle": 0 },
    { "type": "pig",   "id": "pig.normal",  "x": 950, "y": 480 },
    { "type": "pig",   "id": "pig.helmet",  "x": 870, "y": 600 }
  ]
}
```

要点：
- 实体用 `type` + `id` 引用，关卡 JSON 里不出现任何美术/物理常量。
- `w/h/angle` 是关卡空间布局，与贴图尺寸解耦（贴图按九宫格拉伸）。
- `birds` 是 id 数组，决定本关弹丸种类和顺序，加新鸟种只需在 manifest 注册。
- 评分用简单表达式，引擎解析。

## 5. 运行时架构

```
┌─────────────────────────────────────────────────────┐
│  React 外壳 (app/)                                   │
│  GamePage → <GameCanvas manifestId levelId />        │
└───────────────┬─────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────┐
│  GameShell (game/GameShell.ts)                       │
│  - 持有 canvas / ResourceManager / AudioManager      │
│  - 生命周期: load → start → pause → resume → destroy │
│  - 对外只暴露事件回调 (onWin/onLose/onStars/onHud)    │
└───────┬───────────────────────────┬─────────────────┘
        ▼                           ▼
┌──────────────────┐   ┌──────────────────────────────┐
│ ResourceManager  │   │ LevelScene                   │
│ (infra/)         │   │ - 按关卡 JSON 组装实体         │
│ 按 id 返回资源    │   │ - 持有 Slingshot/Bird[]/Pig[] │
│ (图片/音频/物理)  │   │ - 持有 PhysicsWorld 实例       │
└──────────────────┘   └──────────┬───────────────────┘
                                  ▼
                       ┌──────────────────────────────┐
                       │ 主循环 (GameLoop.ts)          │
                       │ - 固定步长物理 (Matter.js)    │
                       │ - 插值渲染 (Renderer.ts)      │
                       │ - 输入轮询 (InputSystem)      │
                       └──────────────────────────────┘
```

### 模块职责

| 模块 | 职责 | 解耦要点 |
|------|------|----------|
| PhysicsWorld | 封装 Matter.js Engine/World，统一创建刚体，挂钩碰撞 | 物理参数全从 manifest 读 |
| Renderer | Canvas 2D 绘制：背景→实体→弹弓→轨迹→UI 叠层 | 只用 manifest id 取图 |
| Camera | 世界坐标 ↔ 屏幕坐标；预留滚动/缩放 | 独立模块，扩展不碰 Renderer |
| GameLoop | requestAnimationFrame；固定步长累加器 | 与场景解耦 |
| InputSystem | 鼠标+触摸归一为指针；识别弹弓手势 | 屏蔽设备差异 |
| ResourceManager | 加载 manifest、预载资源、按 id 查询；缺失回退占位 | 唯一接触文件路径处 |
| AudioManager | Web Audio；占位用合成器，真实音用解码 buffer；统一 `play(id)` | 换音效不改调用方 |

### 实体模型

所有实体是纯逻辑对象，渲染由 Renderer 统一做，实体自己不画：

```ts
abstract class Entity {
  readonly body: Matter.Body;
  readonly def: EntityDef;   // 来自 manifest 的 id/物理/显示参数
  hp: number;
  alive = true;
  onDamage(amount: number, from: Entity | null): void;
}

class Bird   extends Entity { kind: 'red'|'yellow'|'blue'; state: 'idle'|'flying'|'spent'; triggerSkill(): void; }
class Block  extends Entity { material: 'wood'|'stone'|'glass'; onDestroy(): void; }
class Pig    extends Entity { variant: 'normal'|'helmet'; onPop(): void; }
class Slingshot { load(bird); launch(angle, power); }   // 非物理实体
```

### 生命周期

```
loadLevel(id) ──▶ ResourceManager.preload(manifest, level)
              ──▶ LevelScene.build()
              ──▶ GameLoop.start()
                     │ 每帧: input → 物理步进 → 实体更新 → 检查胜负 → 渲染
              ┌──────┴─────── 胜负判定 ─────────┐
              ▼                                  ▼
     所有猪死亡 → onWin(stars)          鸟用光且有猪存活 → onLose
```

- **胜利**：所有 `Pig.alive === false`。
- **失败**：`birds` 队列空 + 场上静止后仍有猪存活。
- **星级**：胜利后按关卡 JSON `goal.stars` 表达式求值（支持 `birdsLeft>=N` 和 `win`）。

## 6. 输入控制（桌面 + 移动）

统一指针模型：`InputSystem` 把 mouse + touch + pointer 事件归一为同一套 `PointerState`，下游只消费归一事件。

```
弹弓交互状态机：
  idle ──pointerdown 弹弓区域──▶ aiming
  aiming ──pointermove──▶ 更新拉力向量(限制最大拉力+角度)
  aiming ──pointerup──▶ launch: 速度 = (slingPos - releasePos) * powerScale → flying
  flying ──点击/触摸──▶ 触发当前鸟技能(黄鸟加速/蓝鸟分裂)
  flying ──鸟停止/出界──▶ 装填下一只，回到 idle
```

- 最大拉力钳制（弹弓橡皮筋视觉反馈）。
- 角度限制：仅允许向右上/右下扇区发射。
- 触摸优化：命中区放大、`touch-action: none`。
- 键盘：空格触发技能、R 重置、ESC 暂停（桌面增强）。

## 7. 视口与适配

- 世界坐标固定（1280×720），Canvas 自适应容器，保持宽高比，`devicePixelRatio` 适配高清屏。
- 移动端横屏提示：竖屏时显示"请旋转设备"遮罩。

## 8. 占位资源策略

- `assets/images/` 和 `assets/audio/` MVP 阶段为空目录。
- manifest 里所有 id 的 `src` 指向不存在的文件 → ResourceManager 捕获加载失败 → 调用 `PlaceholderAssets` 程序化生成（纯色圆/矩形 + emoji + Web Audio 合成音）→ 缓存。
- **替换原创素材流程**：往 `assets/images/` 放真实 PNG → manifest 里把对应 id 的 `src` 指向新文件 → 刷新页面。**代码零改动。**

## 9. 构建与部署

- `pnpm dev`：Vite 开发服务器，HMR。
- `pnpm build`：输出 `dist/`，所有资源仍在外部 `assets/` 目录，部署后替换该目录即可换皮——**无需重新构建代码**。
- `pnpm preview`：本地预览生产产物。
- 纯静态，可放任何 CDN / GitHub Pages / Netlify。

## 10. MVP 交付清单

1. Vite + React 19 + TS 工程，三层分离目录
2. `manifest.json` + 3 个示例关卡 JSON（递进难度）
3. ResourceManager + PlaceholderAssets（资源解耦核心）
4. Matter.js 物理世界 + Canvas 2D Renderer + Camera
5. GameLoop（固定步长 + 插值）
6. 实体：Bird(3 种技能) / Block(3 种材质) / Pig(2 种) / Slingshot
7. InputSystem（键鼠 + 触摸归一）+ 弹弓手势 + 技能触发
8. AudioManager（合成占位音 + manifest 真实音，统一接口）
9. 胜负判定 + 星级评分 + localStorage 进度持久化
10. React 外壳：首页 / 关卡选择 / 游戏页 / 设置
11. 横屏适配 + 高清屏 + 移动端触摸优化
12. README：如何替换素材/音效/关卡（面向非程序员）

## 11. Matter.js 0.20 实战陷阱（调试记录）

以下两个问题在浏览器实测中发现，已修复，记录于此避免重蹈覆辙：

### 陷阱一：不要用 `Body.setMass` 设定质量

**现象**：所有非静态物体的 `vertices` 坐标变成 NaN → `bounds` 失效 → 碰撞检测器（Detector）的 broad-phase AABB 测试全部失败 → 物体互相穿透、地面接不住任何东西，物体无限下落。

**根因**：`Body.setMass` 内部 `body.inertia = (body.inertia / (body.mass/6)) * (mass/6)`，在 Matter 0.20 中会算出 NaN 的 `inertia`/`inverseInertia`。随后 `Body.update` 的旋转积分 `(torque / inertia) * dt²` 把 NaN 传播到 `angularVelocity`→`angle`，旋转 vertices 时坐标全部污染成 NaN。静态物体跳过 `Body.update` 所以不受影响（这也是为什么地面正常、方块/猪坏掉的原因）。

**修复**：用 `density` 替代 `setMass`。`mass = density × area`，Matter 内部一致地计算 mass 与 inertia。质量目标 M 换算为 `density = M / area`（见 `PhysicsWorld.createCircle/createRect`）。

### 陷阱二：`setStatic(false)` 后必须重置 Verlet 积分状态

**现象**：发射鸟时调 `setStatic(false)` + `setVelocity` 后，鸟不飞行（速度不驱动位置）。

**根因**：`setStatic(false)` 恢复 `_original` 但不重置 `deltaTime`/`positionPrev`。`Body.setVelocity` 用 `deltaTime` 计算 `positionPrev`，若 `deltaTime` 异常则 positionPrev 错误，Verlet 积分把残留位移当成速度，抵消了设定的速度。

**修复**：发射时手动重置积分基准（见 `LevelScene.onPointerUp`）：
```ts
Matter.Body.setStatic(body, false);
body.deltaTime = 1000 / 60;
body.positionPrev.x = info.x; body.positionPrev.y = info.y;
body.anglePrev = body.angle;
Matter.Body.setVelocity(body, { x: vx, y: vy });
```

### 陷阱三：隐藏标签页的 RAF 暂停（仅测试环境）

浏览器对 `visibilityState === 'hidden'` 的标签页暂停 `requestAnimationFrame` 与节流 `setInterval`。这在自动化测试（如 headless 调试）中表现为"渲染一帧后游戏循环停住"。真实玩家在可见浏览器中不受影响。验证玩法时若用后台标签，需用同步连续调用 `scene.update(dt)` 驱动。
