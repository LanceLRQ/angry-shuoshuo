/**
 * AudioManager —— 音效统一接口。
 *
 * 解耦：调用方只用 play(id)（id 来自 manifest），不关心音源是真实文件还是合成音。
 * ResourceManager 负责 buffer 的获取（真实文件优先，失败回退合成）。
 *
 * 体积控制：play 可指定音量与变速；支持全局静音与音量。
 * AudioContext 在首次用户交互后创建（浏览器自动播放策略）。
 */

import type { ResourceManager } from '@infra/ResourceManager';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** 全局音量 0~1。 */
  volume = 0.7;
  muted = false;
  /** 最近播放同一 id 的去抖时间戳，防止一帧内狂播。 */
  private lastPlayed = new Map<string, number>();

  constructor(private rm: ResourceManager) {}

  /** 创建/恢复 AudioContext（需在用户交互后调用）。 */
  resume(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.rm.setAudioContext(this.ctx);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  /** 播放某音效 id。volume 0~1 额外缩放。throttleMs 去抖间隔。 */
  play(id: string, opts: { volume?: number; throttleMs?: number } = {}): void {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    const throttle = opts.throttleMs ?? 60;
    const last = this.lastPlayed.get(id) ?? 0;
    if (now * 1000 - last < throttle) return;
    this.lastPlayed.set(id, now * 1000);

    const buffer = this.rm.getAudio(id);
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const g = this.ctx.createGain();
    g.gain.value = opts.volume ?? 1;
    src.connect(g);
    g.connect(this.master);
    src.start();
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  destroy(): void {
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.master = null;
  }
}
