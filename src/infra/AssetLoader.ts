/**
 * AssetLoader —— 底层资源加载器。
 *
 * 唯一接触文件路径的地方（除 PlaceholderAssets 外）。
 * 所有加载失败都不抛错，而是返回 null，由上层决定是否回退到占位资源。
 * 这样保证：素材缺失时游戏仍可运行，而非崩溃。
 */

export interface LoadResult<T> {
  data: T | null;
  /** 实际来源：file = 真实文件，placeholder = 程序化生成。 */
  source: 'file' | 'placeholder';
}

/** 加载一张图片，失败返回 null。 */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** 用 fetch 加载文本（用于 manifest / 关卡 JSON）。失败返回 null。 */
export async function loadJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** 用 fetch + AudioContext 解码音频。失败返回 null。 */
export async function loadAudioBuffer(
  src: string,
  ctx: AudioContext,
): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return await ctx.decodeAudioData(arr);
  } catch {
    return null;
  }
}

/** 把多个异步任务串行/并行执行并汇报进度。 */
export async function runWithProgress<T>(
  tasks: Array<() => Promise<T>>,
  onProgress?: (ratio: number) => void,
): Promise<T[]> {
  const results: T[] = [];
  let done = 0;
  for (const task of tasks) {
    results.push(await task());
    done += 1;
    onProgress?.(done / tasks.length);
  }
  return results;
}
