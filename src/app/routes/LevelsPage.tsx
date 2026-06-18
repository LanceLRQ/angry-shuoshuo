import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Stars } from '../components/ui/Stars';
import { useGameStore } from '../store/gameStore';
import { ResourceManager } from '@infra/ResourceManager';

export function LevelsPage() {
  const [levelIds, setLevelIds] = useState<string[]>([]);
  const progress = useGameStore((s) => s.progress);

  useEffect(() => {
    let cancelled = false;
    const rm = new ResourceManager();
    rm.loadManifest()
      .then(() => {
        if (!cancelled) setLevelIds(rm.listLevelIds());
      })
      .catch(() => {
        if (!cancelled) setLevelIds(['level-01', 'level-02', 'level-03']);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-y-auto bg-gradient-to-b from-indigo-900 to-purple-900">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-display text-4xl font-extrabold text-white">
            选择关卡
          </h1>
          <Link to="/">
            <Button variant="ghost" size="sm">
              ← 返回
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {levelIds.map((id, idx) => {
            const stars = progress.stars[id] ?? 0;
            const prevStars = idx === 0 ? 1 : progress.stars[levelIds[idx - 1]] ?? 0;
            const locked = idx > 0 && prevStars === 0;
            return (
              <div
                key={id}
                className={`flex items-center justify-between rounded-3xl border p-5 transition ${
                  locked
                    ? 'border-white/5 bg-white/5 opacity-50'
                    : 'border-white/10 bg-white/10 hover:bg-white/15'
                }`}
              >
                <div>
                  <div className="text-sm font-mono text-white/50">
                    {id.toUpperCase()}
                  </div>
                  <div className="text-2xl font-bold text-white">
                    第 {idx + 1} 关
                  </div>
                  <div className="mt-2">
                    <Stars count={stars} size={22} />
                  </div>
                </div>
                {locked ? (
                  <span className="text-3xl">🔒</span>
                ) : (
                  <Link to={`/play/${id}`}>
                    <Button>游玩 ▶</Button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
