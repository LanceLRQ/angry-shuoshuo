/**
 * InputSystem —— 输入归一与手势识别。
 *
 * 把 PointerEvent（涵盖鼠标/触摸/笔）归一为统一的回调，
 * 下游（LevelScene）只关心"按下/移动/抬起"在世界坐标下的位置。
 *
 * 职责：
 *  - 屏蔽设备差异（mouse/touch/pen）。
 *  - 屏幕坐标 → 世界坐标（用 Camera）。
 *  - 键盘：空格=技能、R=重置、ESC=暂停（桌面增强）。
 *
 * 不在这里判断"是否点中弹弓"——那是场景的职责，
 * 因为命中区域逻辑属于游戏规则，输入只负责报点。
 */

import type { Camera } from '@game/engine/Camera';

export interface PointerState {
  x: number; // 世界坐标
  y: number;
  /** 是否按下中。 */
  down: boolean;
}

export interface InputCallbacks {
  onPointerDown: (x: number, y: number) => void;
  onPointerMove: (x: number, y: number) => void;
  onPointerUp: (x: number, y: number) => void;
  onSkill?: () => void;
  onReset?: () => void;
  onPause?: () => void;
}

export class InputSystem {
  private el: HTMLElement;
  private camera: Camera;
  private cb: InputCallbacks;
  private bound = false;

  /** 最近一次指针位置（世界坐标），供场景查询。 */
  pointer: PointerState = { x: 0, y: 0, down: false };

  constructor(el: HTMLElement, camera: Camera, cb: InputCallbacks) {
    this.el = el;
    this.camera = camera;
    this.cb = cb;
  }

  attach(): void {
    if (this.bound) return;
    this.bound = true;
    this.el.style.touchAction = 'none';
    this.el.addEventListener('pointerdown', this.onDown);
    this.el.addEventListener('pointermove', this.onMove);
    this.el.addEventListener('pointerup', this.onUp);
    this.el.addEventListener('pointercancel', this.onUp);
    this.el.addEventListener('pointerleave', this.onUp);
    window.addEventListener('keydown', this.onKey);
  }

  detach(): void {
    if (!this.bound) return;
    this.bound = false;
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
    this.el.removeEventListener('pointerleave', this.onUp);
    window.removeEventListener('keydown', this.onKey);
  }

  private toWorld(e: PointerEvent): { x: number; y: number } {
    const rect = this.el.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    return this.camera.screenToWorld(cssX, cssY);
  }

  private onDown = (e: PointerEvent): void => {
    // 首次交互解锁音频
    this.el.setPointerCapture?.(e.pointerId);
    const { x, y } = this.toWorld(e);
    this.pointer = { x, y, down: true };
    this.cb.onPointerDown(x, y);
  };

  private onMove = (e: PointerEvent): void => {
    const { x, y } = this.toWorld(e);
    this.pointer = { x, y, down: this.pointer.down };
    this.cb.onPointerMove(x, y);
  };

  private onUp = (e: PointerEvent): void => {
    const { x, y } = this.toWorld(e);
    this.pointer.down = false;
    this.cb.onPointerUp(x, y);
  };

  private onKey = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        this.cb.onSkill?.();
        break;
      case 'KeyR':
        this.cb.onReset?.();
        break;
      case 'Escape':
        this.cb.onPause?.();
        break;
    }
  };
}
