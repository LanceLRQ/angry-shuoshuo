/**
 * GameLoop —— 主循环（固定步长累加器）。
 *
 * - 物理以 FIXED_DT 步长推进，保证不同帧率下手感一致。
 * - 渲染每帧执行（不插值，MVP 足够；后续可加插值）。
 * - 支持暂停/恢复/销毁，与 React 组件生命周期对齐。
 */

import { FIXED_DT } from '@game/types';

export interface LoopCallbacks {
  /** 固定步长更新（物理 + 逻辑）。dt 单位毫秒。 */
  update: (dtMs: number) => void;
  /** 每帧渲染。 */
  render: () => void;
}

export class GameLoop {
  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private running = false;
  private paused = false;
  /** 防止后台标签页累积巨大 dt 导致物理爆炸。 */
  private readonly MAX_FRAME_MS = 250;

  constructor(private callbacks: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.tick();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.running) return;
    this.paused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private tick = (): void => {
    if (!this.running) return;
    // 先调度下一帧，保证 RAF 链不因 body 异常而断裂
    this.rafId = requestAnimationFrame(this.tick);

    const now = performance.now();
    let frameMs = now - this.lastTime;
    this.lastTime = now;
    if (frameMs > this.MAX_FRAME_MS) frameMs = this.MAX_FRAME_MS;

    if (!this.paused) {
      this.accumulator += frameMs;
      // 固定步长推进，最多迭代若干次防止螺旋下降
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < 5) {
        this.callbacks.update(FIXED_DT);
        this.accumulator -= FIXED_DT;
        steps += 1;
      }
      if (steps >= 5) this.accumulator = 0;
    }

    this.callbacks.render();
  };
}
