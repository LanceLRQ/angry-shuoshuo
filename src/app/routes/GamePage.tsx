import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GameCanvas } from '../components/GameCanvas';
import { Button } from '../components/ui/Button';
import { Stars } from '../components/ui/Stars';
import { useGameStore } from '../store/gameStore';
import type { GameResult } from '@game/types';

export function GamePage() {
  const { levelId = '' } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<GameResult | null>(null);
  const [runKey, setRunKey] = useState(0);
  const recordStars = useGameStore((s) => s.recordStars);

  const handleResult = useCallback(
    (r: GameResult | null) => {
      setResult(r);
      if (r && r.stars > 0) recordStars(r.levelId, r.stars);
    },
    [recordStars],
  );

  const replay = () => {
    setResult(null);
    setRunKey((k) => k + 1);
  };

  const isWin = result && result.stars > 0;

  return (
    <div className="relative h-full w-full bg-black">
      <GameCanvas key={`${levelId}-${runKey}`} levelId={levelId} onResult={handleResult} />

      {/* 顶部返回按钮 */}
      {!result && (
        <Link
          to="/levels"
          className="absolute right-4 top-4 z-10 rounded-2xl bg-black/40 px-4 py-2 text-white backdrop-blur hover:bg-black/60"
        >
          ✕ 退出
        </Link>
      )}

      {/* 重玩按钮 */}
      {!result && (
        <button
          onClick={replay}
          className="absolute right-4 top-20 z-10 rounded-2xl bg-black/40 px-4 py-2 text-white backdrop-blur hover:bg-black/60"
        >
          ↻ 重玩
        </button>
      )}

      {/* 胜负叠层 */}
      {result && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/70 backdrop-blur-sm">
          <h2
            className={`font-display text-6xl font-extrabold ${
              isWin ? 'text-yellow-400' : 'text-red-400'
            }`}
          >
            {isWin ? '🎉 胜利！' : '😢 失败'}
          </h2>
          {isWin && <Stars count={result.stars} size={56} />}
          <div className="text-white/70">
            {isWin ? `剩余小鸟 ${result.birdsLeft} 只` : '再试一次吧！'}
          </div>
          <div className="flex gap-4">
            {isWin && (
              <Button
                size="lg"
                onClick={() => {
                  const next = nextLevelId(levelId);
                  navigate(next ? `/play/${next}` : '/levels');
                }}
              >
                下一关 ▶
              </Button>
            )}
            <Button size="lg" variant="secondary" onClick={replay}>
              ↻ 重玩
            </Button>
            <Link to="/levels">
              <Button size="lg" variant="ghost">
                关卡列表
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** 简单的下一关推算（level-NN → level-(NN+1)）。 */
function nextLevelId(id: string): string | null {
  const m = /^level-(\d+)$/.exec(id);
  if (!m) return null;
  const n = Number(m[1]) + 1;
  return `level-${String(n).padStart(2, '0')}`;
}
