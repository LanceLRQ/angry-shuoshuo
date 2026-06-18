import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useGameStore } from '../store/gameStore';

export function SettingsPage() {
  const settings = useGameStore((s) => s.settings);
  const setVolume = useGameStore((s) => s.setVolume);
  const setMuted = useGameStore((s) => s.setMuted);
  const resetProgress = useGameStore((s) => s.resetProgress);

  return (
    <div className="h-full w-full overflow-y-auto bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="mx-auto max-w-xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-display text-4xl font-extrabold text-white">设置</h1>
          <Link to="/">
            <Button variant="ghost" size="sm">
              ← 返回
            </Button>
          </Link>
        </div>

        <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          {/* 音量 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="font-bold text-white">音量</label>
              <span className="font-mono text-white/60">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.muted ? 0 : settings.volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMuted(v === 0);
                setVolume(v);
              }}
              className="w-full accent-brand-500"
            />
          </div>

          {/* 静音 */}
          <div className="flex items-center justify-between">
            <label className="font-bold text-white">静音</label>
            <button
              onClick={() => setMuted(!settings.muted)}
              className={`relative h-8 w-14 rounded-full transition ${
                settings.muted ? 'bg-red-500' : 'bg-emerald-500'
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${
                  settings.muted ? 'left-1' : 'left-7'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 进度管理 */}
        <div className="mt-6 rounded-3xl border border-red-500/20 bg-red-500/5 p-6">
          <h2 className="mb-2 font-bold text-red-300">危险操作</h2>
          <p className="mb-4 text-sm text-white/60">
            清除所有关卡进度与星级记录（不可恢复）。
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              if (confirm('确定要清除全部关卡进度吗？此操作不可恢复。')) {
                resetProgress();
              }
            }}
          >
            🗑 清除进度
          </Button>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
          <h2 className="mb-2 font-bold text-white">关于</h2>
          <p>
            愤怒的硕硕 · 一款基于 Matter.js + Canvas 2D + React 的物理弹射游戏。
            所有美术、音效、关卡数据均可通过 <code className="rounded bg-black/40 px-1">assets/</code>{' '}
            目录替换，无需修改代码。
          </p>
        </div>
      </div>
    </div>
  );
}
