import type { Card, Suit } from "./types";

export const SUIT_CHAR: Record<Suit, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };

export const RANK_LABEL = (r: number): string =>
  r === 14 ? "A" : r === 13 ? "K" : r === 12 ? "Q" : r === 11 ? "J" : String(r);

export const STAGES = ["preflop", "flop", "turn", "river", "showdown"] as const;

export const STAGE_JA: Record<string, string> = {
  preflop: "プリフロップ",
  flop: "フロップ",
  turn: "ターン",
  river: "リバー",
  showdown: "ショウダウン",
};

export const STAGE_SUB: Record<string, string> = {
  preflop: "自分の2枚で最初のベット",
  flop: "共有カード3枚が開く",
  turn: "4枚目が開く",
  river: "5枚目が開く・最終ベット",
  showdown: "残った人で役を比べる",
};

export const fmt = (n: number): string =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const clampN = (v: number, a: number, b: number): number =>
  Math.max(a, Math.min(b, v));

export const mkCard = (r: number, s: Suit): Card => ({ r, s, id: `${r}${s}` });

export function newDeck(): Card[] {
  const d: Card[] = [];
  for (const s of ["s", "h", "d", "c"] as Suit[]) {
    for (let r = 2; r <= 14; r++) d.push(mkCard(r, s));
  }
  return d;
}

export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 5枚評価 → [カテゴリ, ...比較キー] */
export function eval5(cs: Card[]): number[] {
  const rs = cs.map(c => c.r).sort((a, b) => b - a);
  const flush = cs.every(c => c.s === cs[0].s);
  const cnt: Record<number, number> = {};
  rs.forEach(r => { cnt[r] = (cnt[r] || 0) + 1; });
  const groups = Object.keys(cnt)
    .map(r => ({ r: +r, n: cnt[+r] }))
    .sort((a, b) => b.n - a.n || b.r - a.r);
  const uniq = [...new Set(rs)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straightHigh = 5; // A-2-3-4-5
  }
  if (flush && straightHigh) return [8, straightHigh];
  if (groups[0].n === 4) return [7, groups[0].r, groups[1].r];
  if (groups[0].n === 3 && groups[1].n === 2) return [6, groups[0].r, groups[1].r];
  if (flush) return [5, ...rs];
  if (straightHigh) return [4, straightHigh];
  if (groups[0].n === 3) return [3, groups[0].r, groups[1].r, groups[2].r];
  if (groups[0].n === 2 && groups[1].n === 2) return [2, groups[0].r, groups[1].r, groups[2].r];
  if (groups[0].n === 2) return [1, groups[0].r, groups[1].r, groups[2].r, groups[3].r];
  return [0, ...rs];
}

export function cmpScore(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

/** n枚(5〜7)から最良の5枚を選ぶ */
export function bestOf(cards: Card[]): { score: number[]; cards: Card[] } {
  const n = cards.length;
  if (n <= 5) return { score: eval5(cards), cards: [...cards] };
  const drop = n - 5; // 6枚→1枚除外、7枚→2枚除外
  let best: { score: number[]; cards: Card[] } | null = null;
  const consider = (cs: Card[]) => {
    const r = eval5(cs);
    if (!best || cmpScore(r, best.score) > 0) best = { score: r, cards: cs };
  };
  if (drop === 1) {
    for (let i = 0; i < n; i++) consider(cards.filter((_, k) => k !== i));
  } else {
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        consider(cards.filter((_, k) => k !== i && k !== j));
  }
  if (!best) throw new Error("bestOf: 組み合わせがありません");
  return best;
}

export function handJa(s: number[]): string {
  switch (s[0]) {
    case 8: return s[1] === 14 ? "ロイヤルストレートフラッシュ" : `ストレートフラッシュ（${RANK_LABEL(s[1])}ハイ）`;
    case 7: return `フォーカード（${RANK_LABEL(s[1])}）`;
    case 6: return `フルハウス（${RANK_LABEL(s[1])}と${RANK_LABEL(s[2])}）`;
    case 5: return `フラッシュ（${RANK_LABEL(s[1])}ハイ）`;
    case 4: return `ストレート（${RANK_LABEL(s[1])}ハイ）`;
    case 3: return `スリーカード（${RANK_LABEL(s[1])}）`;
    case 2: return `ツーペア（${RANK_LABEL(s[1])}と${RANK_LABEL(s[2])}）`;
    case 1: return `ワンペア（${RANK_LABEL(s[1])}）`;
    default: return `ハイカード（${RANK_LABEL(s[1])}ハイ）`;
  }
}

/** 役一覧のハイライト用キー（ロイヤルは独立扱い） */
export const catKey = (s: number[]): string =>
  s[0] === 8 && s[1] === 14 ? "8R" : String(s[0]);

export interface RankInfo {
  key: string;
  name: string;
  desc: string;
  ex: Card[];
}

export const RANK_INFO: RankInfo[] = [
  { key: "8R", name: "ロイヤルストレートフラッシュ", desc: "同じマークのA・K・Q・J・10（最強の役）", ex: [mkCard(14, "s"), mkCard(13, "s"), mkCard(12, "s"), mkCard(11, "s"), mkCard(10, "s")] },
  { key: "8", name: "ストレートフラッシュ", desc: "同じマークの連続した数字5枚", ex: [mkCard(9, "s"), mkCard(8, "s"), mkCard(7, "s"), mkCard(6, "s"), mkCard(5, "s")] },
  { key: "7", name: "フォーカード", desc: "同じ数字4枚＋他1枚", ex: [mkCard(9, "s"), mkCard(9, "h"), mkCard(9, "d"), mkCard(9, "c"), mkCard(2, "s")] },
  { key: "6", name: "フルハウス", desc: "同じ数字3枚＋別の同じ数字2枚", ex: [mkCard(13, "s"), mkCard(13, "h"), mkCard(13, "d"), mkCard(4, "s"), mkCard(4, "c")] },
  { key: "5", name: "フラッシュ", desc: "同じマーク5枚（数字は連続しなくてOK）", ex: [mkCard(14, "d"), mkCard(10, "d"), mkCard(7, "d"), mkCard(5, "d"), mkCard(2, "d")] },
  { key: "4", name: "ストレート", desc: "連続した数字5枚（マーク不問／Aは1としても使える）", ex: [mkCard(10, "s"), mkCard(9, "h"), mkCard(8, "d"), mkCard(7, "c"), mkCard(6, "s")] },
  { key: "3", name: "スリーカード", desc: "同じ数字3枚", ex: [mkCard(12, "s"), mkCard(12, "h"), mkCard(12, "d"), mkCard(7, "c"), mkCard(2, "s")] },
  { key: "2", name: "ツーペア", desc: "同じ数字2枚＋別の同じ数字2枚", ex: [mkCard(11, "s"), mkCard(11, "h"), mkCard(6, "s"), mkCard(6, "d"), mkCard(2, "c")] },
  { key: "1", name: "ワンペア", desc: "同じ数字2枚", ex: [mkCard(8, "s"), mkCard(8, "h"), mkCard(13, "d"), mkCard(5, "c"), mkCard(2, "s")] },
  { key: "0", name: "ハイカード", desc: "役ができていないとき。一番強いカードで勝負", ex: [mkCard(14, "s"), mkCard(11, "h"), mkCard(8, "d"), mkCard(5, "c"), mkCard(2, "s")] },
];
