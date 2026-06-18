/**
 * GameShell —— React 与游戏核心之间的桥接层。
 *
 * 持有并管理一局游戏的全部运行时组件：
 *   ResourceManager / AudioManager / Camera / Renderer / GameLoop /
 *   InputSystem / LevelScene
 *
 * 生命周期：load() → start() → (pause/resume) → destroy()
 * 对外只暴露事件回调，不暴露任何游戏内部对象。
 *
 * React 的 GameCanvas 组件只创建一个 GameShell 并订阅事件，
 * 因此 React 渲染与游戏循环完全解耦。
 */

import type { ResourceManager } from '@infra/ResourceManager';
import type { AudioManager } from '@game/systems/AudioManager';
import type { GameEvents, LevelData } from '@game/types';
import { Camera } from '@game/engine/Camera';
import { Renderer } from '@game/engine/Renderer';
import { GameLoop } from '@game/engine/GameLoop';
import { InputSystem } from '@game/systems/InputSystem';
import { LevelScene } from '@game/scene/LevelScene';

export interface GameShellOptions {
  canvas: HTMLCanvasElement;
  rm: ResourceManager;
  audio: AudioManager;
  level: LevelData;
  events: GameEvents;
}

export class GameShell {
  private camera: Camera;
  private renderer: Renderer;
  private loop: GameLoop;
  private input: InputSystem;
  private scene: LevelScene;
  private ctx: CanvasRenderingContext2D;
  private destroyed = false;

  constructor(opts: GameShellOptions) {
    const ctx = opts.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context 不可用');
    this.ctx = ctx;

    this.camera = new Camera();
    this.renderer = new Renderer(ctx, opts.rm);
    this.scene = new LevelScene(opts.rm, opts.audio, opts.level, opts.events);

    this.input = new InputSystem(opts.canvas, this.camera, {
      onPointerDown: (x, y) => this.scene.onPointerDown(x, y),
      onPointerMove: (x, y) => this.scene.onPointerMove(x, y),
      onPointerUp: () => this.scene.onPointerUp(),
      onSkill: () => this.scene.triggerSkill(),
      onPause: () => opts.events.onHud && this.togglePause(),
    });

    this.loop = new GameLoop({
      update: (dt) => this.scene.update(dt),
      render: () => this.render(),
    });
  }

  /**
   * 重新计算画布尺寸。由 React 组件在容器尺寸变化时调用。
   * cssW/cssH 为容器 CSS 像素尺寸。
   */
  resizeTo(cssW: number, cssH: number): void {
    if (this.destroyed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = this.ctx.canvas;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    this.camera.resize(cssW, cssH, dpr);
  }

  start(): void {
    this.input.attach();
    this.loop.start();
  }

  private paused = false;
  togglePause(): void {
    this.paused = !this.paused;
    if (this.paused) this.loop.pause();
    else this.loop.resume();
  }

  resumeAudio(): void {
    // 由用户交互触发
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.loop.stop();
    this.input.detach();
    this.scene.destroy();
  }

  private render(): void {
    const ctx = this.ctx;
    const layer = this.scene.getRenderLayer();

    // 清屏 + 黑边
    this.camera.clear(ctx);

    // 应用相机变换后绘制世界内容
    ctx.save();
    this.camera.apply(ctx);
    this.renderer.render(layer);
    // 弹弓前柱/前弹带（让鸟夹在中间）
    this.renderer.drawSlingshotFront(layer);
    ctx.restore();
  }
}
