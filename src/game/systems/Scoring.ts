/**
 * Scoring —— 星级评分求值。
 *
 * 解析关卡 JSON 中 goal.stars 表达式（如 "birdsLeft>=2"、"win"），
 * 在胜利时求出获得的星级（1/2/3 中最大的满足者）。
 *
 * 只支持受控的、安全的表达式子集，避免使用 eval：
 *  - "win"                      常量
 *  - "birdsLeft>=N"             数值比较
 *  - "time<=N"                  限时关（后续扩展）
 */

export interface ScoreContext {
  birdsLeft: number;
  timeSec: number;
}

/** 对单个表达式求值，返回是否满足。 */
export function evalGoal(expr: string, ctx: ScoreContext): boolean {
  const e = expr.trim();
  if (e === 'win') return true;
  // birdsLeft>=N
  let m = /^birdsLeft\s*>=\s*(\d+)$/.exec(e);
  if (m) return ctx.birdsLeft >= Number(m[1]);
  m = /^birdsLeft\s*>\s*(\d+)$/.exec(e);
  if (m) return ctx.birdsLeft > Number(m[1]);
  m = /^time\s*<=\s*(\d+)$/.exec(e);
  if (m) return ctx.timeSec <= Number(m[1]);
  // 未知表达式 → 默认视为不满足（保守）
  return false;
}

/** 根据星级规则求出最终星级（1/2/3）。胜利时调用。 */
export function computeStars(
  goals: Record<string, string>,
  ctx: ScoreContext,
): number {
  let stars = 1; // 胜利至少 1 星
  for (const key of Object.keys(goals)) {
    const level = Number(key);
    if (Number.isNaN(level)) continue;
    if (evalGoal(goals[key], ctx)) {
      stars = Math.max(stars, level);
    }
  }
  return Math.min(3, Math.max(1, stars));
}
