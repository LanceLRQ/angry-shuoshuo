/**
 * GameCanvas —— 挂载游戏核心的 React 组件。
 *
 * 职责：
 *  - 创建 canvas、ResourceManager、AudioManager、GameShell。
 *  - 监听容器尺寸变化，驱动 GameShell.resizeTo。
 *  - 把 GameShell 事件转发为 React state（HUD / 胜负 / 加载进度）。
 *  - 卸载时销毁 GameShell，避免内存泄漏。
 *
 * 游戏循环每帧的状态更新不触发 React 重渲染；
 * 只有 HUD 摘要、胜负结果这类低频事件才 setState。
 */

import { useEffect, useRef, useState } from 'react';
import { ResourceManager } from '@infra/ResourceManager';
import { AudioManager } from '@game/systems/AudioManager';
import { GameShell } from '@game/GameShell';
import type {
  GameResult,
  HudState,
} from '@game/types';
import { useGameStore } from '../store/gameStore';

interface Props {
  levelId: string;
  onResult: (result: GameResult | null) => void;
}

export function GameCanvas({ levelId, onResult }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<GameShell | null>(null);
  const audioRef = useRef<AudioManager | null>(null);

  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [hud, setHud] = useState<HudState | null>(null);
  const settings = useGameStore((s) => s.settings);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    let disposed = false;

    (async () => {
      const rm = new ResourceManager();
      const audio = new AudioManager(rm);
      audioRef.current = audio;
      audio.setVolume(settings.volume);
      audio.setMuted(settings.muted);

      await rm.loadManifest();
      if (disposed) return;
      const level = await rm.loadLevel(levelId);

      // 收集本关用到的所有资源 id（图片 + 音频）
      const imageIds = new Set<string>([
        ...level.objects.map((o) => o.id),
        ...level.birds,
        level.bg,
        'sling',
        'sling.band',
      ]);
      const audioIds = Object.keys(rm.getManifest().audio);

      await rm.preload([...imageIds], audioIds, (r) => {
        if (!disposed) setProgress(r);
      });
      if (disposed) return;

      const shell = new GameShell({
        canvas,
        rm,
        audio,
        level,
        events: {
          onProgress: (p) => setProgress(p),
          onHud: (h) => setHud(h),
          onWin: (res) => onResult(res),
          onLose: (res) => onResult(res),
        },
      });
      shellRef.current = shell;

      // 初始尺寸
      const rect = container.getBoundingClientRect();
      shell.resizeTo(rect.width, rect.height);
      shell.start();
      setLoading(false);
    })();

    // 容器尺寸自适应
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && shellRef.current) {
        shellRef.current.resizeTo(r.width, r.height);
      }
    });
    ro.observe(container);

    // 窗口尺寸变化兜底
    const onWinResize = () => {
      const r = container.getBoundingClientRect();
      shellRef.current?.resizeTo(r.width, r.height);
    };
    window.addEventListener('resize', onWinResize);
    window.addEventListener('orientationchange', onWinResize);

    return () => {
      disposed = true;
      ro.disconnect();
      window.removeEventListener('resize', onWinResize);
      window.removeEventListener('orientationchange', onWinResize);
      shellRef.current?.destroy();
      shellRef.current = null;
      audioRef.current?.destroy();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId]);

  // 同步设置变化到 AudioManager
  useEffect(() => {
    audioRef.current?.setVolume(settings.volume);
    audioRef.current?.setMuted(settings.muted);
  }, [settings]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="game-canvas absolute inset-0 h-full w-full" />

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0f1020]">
          <div className="text-2xl font-bold text-white">加载中…</div>
          <div className="h-2 w-64 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {hud && !loading && (
        <div className="pointer-events-none absolute left-4 top-4 flex gap-4 text-white">
          <div className="rounded-2xl bg-black/40 px-4 py-2 backdrop-blur">
            <div className="text-xs text-white/60">剩余鸟</div>
            <div className="text-2xl font-bold">🐦 {hud.birdsRemaining}</div>
          </div>
          <div className="rounded-2xl bg-black/40 px-4 py-2 backdrop-blur">
            <div className="text-xs text-white/60">剩余猪</div>
            <div className="text-2xl font-bold">🐷 {hud.pigsRemaining}</div>
          </div>
        </div>
      )}
    </div>
  );
}
