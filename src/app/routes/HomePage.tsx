import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function HomePage() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 装饰背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400 via-sky-300 to-emerald-300" />
      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-emerald-500/70" />
      <div className="absolute top-10 left-12 text-7xl select-none">☁️</div>
      <div className="absolute top-20 right-20 text-6xl select-none">☁️</div>
      <div className="absolute bottom-16 right-1/4 text-7xl select-none">🌳</div>
      <div className="absolute bottom-10 left-16 text-7xl select-none">🌳</div>
      <div className="absolute top-1/3 left-1/4 text-8xl select-none animate-bounce">🐦</div>

      {/* 标题与入口 */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-8">
        <div className="text-center">
          <h1 className="font-display text-7xl font-extrabold text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.25)] md:text-8xl">
            愤怒的硕硕
          </h1>
          <p className="mt-2 text-2xl font-bold text-white/90 drop-shadow">
            Angry Shuoshuo
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link to="/levels">
            <Button size="lg">▶ 开始游戏</Button>
          </Link>
          <Link to="/settings">
            <Button size="lg" variant="secondary">
              ⚙ 设置
            </Button>
          </Link>
        </div>
        <p className="mt-4 max-w-md px-6 text-center text-sm text-white/70">
          拖动弹弓发射小鸟，击落所有小猪！支持桌面与移动端浏览器，所有美术、音效、关卡均可替换。
        </p>
      </div>
    </div>
  );
}
