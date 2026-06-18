/**
 * gameStore —— 全局状态（关卡进度 + 设置）。
 *
 * 进度：每关获得的星级，持久化到 localStorage。
 * 设置：音量、静音，持久化。
 *
 * 这些状态被多个页面共享，因此放 Zustand；
 * 但游戏循环内部的实时状态（HUD、胜负）走 GameShell 事件回调，
 * 不进全局 store，避免每帧重渲染。
 */

import { create } from 'zustand';

const LS_PROGRESS = 'angry-shuoshuo:progress';
const LS_SETTINGS = 'angry-shuoshuo:settings';

export interface Progress {
  /** levelId → 星级 (1/2/3)。 */
  stars: Record<string, number>;
}

export interface Settings {
  volume: number;
  muted: boolean;
}

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(LS_PROGRESS);
    if (raw) return JSON.parse(raw) as Progress;
  } catch {
    /* ignore */
  }
  return { stars: {} };
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (raw) return JSON.parse(raw) as Settings;
  } catch {
    /* ignore */
  }
  return { volume: 0.7, muted: false };
}

interface GameState {
  progress: Progress;
  settings: Settings;
  /** 记录某关获得的星级（取历史最高）。 */
  recordStars: (levelId: string, stars: number) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  resetProgress: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  progress: loadProgress(),
  settings: loadSettings(),

  recordStars: (levelId, stars) => {
    const prev = get().progress.stars[levelId] ?? 0;
    if (stars <= prev) return;
    const next: Progress = {
      stars: { ...get().progress.stars, [levelId]: stars },
    };
    localStorage.setItem(LS_PROGRESS, JSON.stringify(next));
    set({ progress: next });
  },

  setVolume: (v) => {
    const next = { ...get().settings, volume: v };
    localStorage.setItem(LS_SETTINGS, JSON.stringify(next));
    set({ settings: next });
  },

  setMuted: (m) => {
    const next = { ...get().settings, muted: m };
    localStorage.setItem(LS_SETTINGS, JSON.stringify(next));
    set({ settings: next });
  },

  resetProgress: () => {
    localStorage.removeItem(LS_PROGRESS);
    set({ progress: { stars: {} } });
  },
}));
