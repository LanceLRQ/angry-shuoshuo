interface Props {
  /** 已获得的星级 0~3。 */
  count: number;
  size?: number;
}

/** 显示 1~3 颗星，已获得的金色，未获得的暗色。 */
export function Stars({ count, size = 28 }: Props) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          style={{ fontSize: size }}
          className={n <= count ? 'text-yellow-400' : 'text-white/20'}
        >
          ★
        </span>
      ))}
    </div>
  );
}
