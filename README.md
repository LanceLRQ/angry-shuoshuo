# 愤怒的硕硕 · Angry Shuoshuo

一款类似《愤怒的小鸟》的 HTML5 物理弹射网页游戏。基于 **Vite + React 19 + TypeScript + Matter.js + Canvas 2D**。

> 🎯 **核心特性**：游戏逻辑与资源**完全解耦**。所有美术、音效、关卡数据均可后期替换，**无需修改任何一行代码**。

- ✅ 桌面端（鼠标/键盘）+ 移动端（触摸）双端浏览器支持
- ✅ 程序化占位美术与合成音效，空资源目录也能立刻运行
- ✅ 三层架构：React 外壳 / 游戏核心 / 可替换资源
- ✅ 物理摧毁、连锁倒塌、技能鸟、星级评分、关卡进度持久化

---

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器（默认 http://localhost:5173）
pnpm dev

# 生产构建（输出到 dist/）
pnpm build

# 本地预览生产产物
pnpm preview
```

> 首次运行时 `assets/images/` 和 `assets/audio/` 是**空目录**，
> 游戏会自动使用程序化生成的占位资源（纯色几何体 + emoji + Web Audio 合成音），
> 无需准备任何素材即可完整游玩。

---

## 玩法说明

| 操作 | 桌面端 | 移动端 |
|------|--------|--------|
| 瞄准发射 | 按住弹弓区域拖拽，松开发射 | 同左（触摸拖拽） |
| 触发鸟技能 | 点击屏幕 / 空格键 | 点击屏幕 |
| 重玩当前关 | `R` 键 | 重玩按钮 |
| 暂停 | `ESC` 键 | — |

**三种小鸟：**
- 🔴 **红鸟**：基础高伤，无技能。
- 🟡 **黄鸟**：飞行中触发技能 = 沿当前方向瞬时加速，突破防御。
- 🔵 **蓝鸟**：飞行中触发技能 = 分裂为 3 只，覆盖更大范围。

**目标**：用有限的鸟击落所有小猪 🐷。剩余鸟越多，星级越高（最高 3 星）。

---

## 🎨 替换美术资源（无需写代码）

所有图片放在 `public/assets/images/`，并在 `public/assets/manifest.json` 中登记。

### 替换步骤

1. 把你的原创图片（PNG/JPG）放进 `public/assets/images/`。
2. 打开 `public/assets/manifest.json`，把对应资源的 `src` 指向新文件。
3. 刷新页面。完成 ✅

### 示例：把红鸟换成原创素材

```jsonc
// manifest.json
"images": {
  // 修改前（指向不存在的文件 → 自动用占位图）
  "bird.red": { "src": "images/bird-red.png", "w": 46, "h": 46, "anchor": [0.5, 0.5] },

  // 修改后：把 bird-red.png 放进 images/ 目录即可
  "bird.red": { "src": "images/my-cool-red-bird.png", "w": 50, "h": 50, "anchor": [0.5, 0.5] }
}
```

### 字段说明

| 字段 | 含义 |
|------|------|
| `src` | 相对于 `assets/` 的文件路径 |
| `w` / `h` | 贴图原始尺寸（像素） |
| `anchor` | 锚点 `[x, y]`，取值 0~1，`[0.5,0.5]` = 中心对齐物理体 |
| `slice` | 九宫格切片 `[上,右,下,左]`，方块贴图可拉伸适配任意尺寸不变形 |

> 💡 **九宫格 `slice`**：方块（木头/石头/玻璃）建议启用。它让一张方块贴图能适配关卡里任意宽高的方块，四角保持原样不变形。

---

## 🔊 替换音效（无需写代码）

所有音效放在 `public/assets/audio/`，并在 `manifest.json` 的 `audio` 段登记。

1. 把你的 `.mp3` / `.wav` 放进 `public/assets/audio/`。
2. 在 `manifest.json` 里把对应音效的 `src` 指向新文件。
3. 刷新页面。

```jsonc
"audio": {
  "sfx.launch": { "src": "audio/launch.mp3" },   // 发射音
  "sfx.hit_wood": { "src": "audio/hit-wood.mp3" }, // 木头碰撞
  "sfx.pig_pop": { "src": "audio/pig-pop.mp3" },   // 猪被消灭
  "sfx.win": { "src": "audio/win.mp3" }            // 胜利
  // …完整列表见 manifest.json
}
```

> 缺失的音效文件会自动用 Web Audio 合成音替代，不会报错。

---

## 🗺️ 替换 / 新增关卡（无需写代码）

每个关卡是一个独立的 JSON 文件，位于 `public/assets/levels/`。

### 新增一关

1. 复制 `level-01.json`，重命名为 `level-04.json`。
2. 修改其中的内容（见下方字段说明）。
3. 在 `manifest.json` 的 `levelIds` 数组里加上 `"level-04"`。
4. 刷新页面，新关卡出现在选关界面。

### 关卡 JSON 字段

```jsonc
{
  "id": "level-01",              // 关卡 id（必须与文件名一致）
  "bg": "bg.level1",             // 背景图 manifest id
  "sling": { "x": 210, "y": 560 }, // 弹弓位置（世界坐标，世界为 1280×720）
  "birds": ["bird.red", "bird.yellow", "bird.red"],  // 按发射顺序的鸟 id
  "goal": {
    "stars": {
      "3": "birdsLeft>=2",       // 剩余 ≥2 只鸟 → 3 星
      "2": "birdsLeft>=1",       // 剩余 ≥1 只鸟 → 2 星
      "1": "win"                 // 胜利 → 至少 1 星
    }
  },
  "objects": [
    // 方块
    { "type": "block", "id": "block.wood", "x": 960, "y": 660, "w": 24, "h": 120, "angle": 0 },
    // 猪
    { "type": "pig", "id": "pig.normal", "x": 1020, "y": 640 }
  ]
}
```

| 字段 | 含义 |
|------|------|
| `type` | `block`（方块）或 `pig`（猪） |
| `id` | manifest 中的资源 id（如 `block.wood`、`pig.helmet`） |
| `x` / `y` | 中心点世界坐标（左上角是 0,0；地面在 y≈700） |
| `w` / `h` | 方块的宽高（可省略，默认用贴图尺寸） |
| `angle` | 初始旋转角度（弧度，可省略） |

> 📐 **世界坐标系**：固定 1280 × 720。地面顶部在 y≈700，左侧弹弓通常在 x≈200。
> 猪/鸟用圆形（取 w/h 较小者为直径），方块用矩形。

### 支持的资源 id 速查

| 类别 | id | 说明 |
|------|----|------|
| 鸟 | `bird.red` `bird.yellow` `bird.blue` | 红/黄/蓝鸟 |
| 方块 | `block.wood` `block.stone` `block.glass` | 木/石/玻璃 |
| 猪 | `pig.normal` `pig.helmet` | 普通/戴帽猪 |
| 弹弓 | `sling` `sling.band` | 弹弓柱 / 弹带 |
| 背景 | `bg.level1` `bg.level2` `bg.level3` | 关卡背景 |

> 想新增一种鸟/方块/猪？只需在 manifest 的 `images` + `physics` 里登记新 id，即可在关卡 JSON 中使用。代码无需改动。

---

## 调整游戏手感（可选）

物理参数（质量、血量、弹性、摩擦）在 `manifest.json` 的 `physics` 段：

```jsonc
"physics": {
  "block.wood":  { "mass": 3, "hp": 70,  "restitution": 0.2, "friction": 0.6 },
  "block.stone": { "mass": 9, "hp": 220, "restitution": 0.1, "friction": 0.85 },
  "pig.normal":  { "mass": 4, "hp": 45 }
}
```

弹弓力度、鸟技能参数在 `src/game/types/index.ts` 顶部的常量区（如需更精细调参）。

---

## 项目结构

```
src/
├── app/          # React 外壳（路由、页面、UI 组件、全局状态）
├── game/         # 游戏核心（纯 TS，不依赖 React）
│   ├── engine/   #   PhysicsWorld / Renderer / Camera / GameLoop
│   ├── entities/ #   Bird / Block / Pig / Slingshot
│   ├── factory/  #   EntityFactory（关卡 JSON → 实体）
│   ├── systems/  #   InputSystem / AudioManager / Scoring
│   ├── scene/    #   LevelScene（一局的大脑）
│   └── types/    #   资源/实体/常量的 TS 契约
├── infra/        # 资源加载与解耦（ResourceManager / AssetLoader / PlaceholderAssets）
└── main.tsx      # React 入口

public/assets/    # ★ 可替换资源（部署后直接替换即可换皮）
├── manifest.json
├── levels/
├── images/       # ← 放原创美术
└── audio/        # ← 放原创音效
```

**解耦关键**：`game/` 下所有代码只引用 manifest id（如 `'bird.red'`），从不出现文件路径。`infra/ResourceManager` 是唯一接触文件的地方。

---

## 部署

`pnpm build` 后，`dist/` 是纯静态产物，可托管在任何静态服务器 / CDN / GitHub Pages / Netlify / Vercel。

**换皮时**：只需替换部署目录下的 `assets/` 文件夹，**无需重新构建代码**。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 构建 | Vite 6 + TypeScript 5.9（strict） |
| 页面基底 | React 19 + React Router 7 |
| 状态 | Zustand 5（进度/设置持久化到 localStorage） |
| 物理 | Matter.js |
| 渲染 | 自研 Canvas 2D（含九宫格拉伸） |
| 音频 | Web Audio API |
| 样式 | Tailwind CSS 3（仅 UI 外壳） |

设计文档详见 [`docs/plans/2026-06-18-angry-birds-game-design.md`](docs/plans/2026-06-18-angry-birds-game-design.md)。

---

## 许可证

见 [LICENSE](LICENSE)。
