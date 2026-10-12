import type { Card } from "./types";
import { mkCard } from "./cards";
import { chenScore } from "./ai";

/** スターティングハンド表の軸（A→2 の順） */
export const SH_RANKS = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

export interface SHTier {
  /** CSSクラス（sh-cell に付与） */
  cls: string;
  /** 凡例のラベル */
  label: string;
  /** 凡例の見出し（短） */
  short: string;
}

/** 弱い→強い順ではなく、強い順に 0..4 */
export const SH_TIERS: SHTier[] = [
  { cls: "t0", short: "レイズ圏", label: "レイズ圏（強気に賭けてOK）" },
  { cls: "t1", short: "強い", label: "強い（レイズかコール）" },
  { cls: "t2", short: "コール圏", label: "コール圏（形が良ければ勝負）" },
  { cls: "t3", short: "様子見", label: "安ければコール（様子見）" },
  { cls: "t4", short: "フォールド推奨", label: "フォールド推奨" },
];

function tierOf(score: number): number {
  if (score >= 10) return 0;
  if (score >= 8) return 1;
  if (score >= 6) return 2;
  if (score >= 5) return 3;
  return 4;
}

/**
 * 13×13の強度グリッド。
 * 行=高いカード・列=低いカードとし、対角線(i==j)はポケットペア、
 * 右上(i<j)はスーテッド、左下(i>j)はオフスートを表す。
 */
export const SH_GRID: number[][] = SH_RANKS.map((rowR, i) =>
  SH_RANKS.map((_colR, j) => {
    if (i === j) {
      // ポケットペア
      return tierOf(chenScore(mkCard(rowR, "s"), mkCard(rowR, "h")));
    }
    if (j > i) {
      // 右上: 行カードが高い = スーテッド
      return tierOf(chenScore(mkCard(rowR, "s"), mkCard(SH_RANKS[j], "s")));
    }
    // 左下: 列カードが高い = オフスート
    return tierOf(chenScore(mkCard(SH_RANKS[j], "s"), mkCard(rowR, "h")));
  })
);

/** 表の中の見出し（例: "AKs" / "TT" / "T9o"） */
export function shCellLabel(i: number, j: number, rankLabel: (r: number) => string): string {
  if (i === j) return `${rankLabel(SH_RANKS[i])}${rankLabel(SH_RANKS[i])}`;
  if (j > i) return `${rankLabel(SH_RANKS[i])}${rankLabel(SH_RANKS[j])}s`;
  return `${rankLabel(SH_RANKS[j])}${rankLabel(SH_RANKS[i])}o`;
}

/** 手札2枚 → 表のマス位置 */
export function cellForHole(a: Card, b: Card): { i: number; j: number } {
  const idx = (r: number) => SH_RANKS.indexOf(r);
  if (a.r === b.r) return { i: idx(a.r), j: idx(a.r) };
  const hi = Math.max(a.r, b.r);
  const lo = Math.min(a.r, b.r);
  if (a.s === b.s) return { i: idx(hi), j: idx(lo) }; // 右上（スーテッド）
  return { i: idx(lo), j: idx(hi) }; // 左下（オフスート）
}
