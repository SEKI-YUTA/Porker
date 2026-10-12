import type { Card, GameState, Player } from "./types";
import { bestOf, clampN } from "./cards";

/** プリフロップのホールカード評価（Chen式を簡略化） */
export function chenScore(a: Card, b: Card): number {
  const v = (r: number) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2);
  let s: number;
  if (a.r === b.r) {
    s = Math.max(5, v(a.r) * 2);
  } else {
    s = Math.max(v(a.r), v(b.r));
    if (a.s === b.s) s += 2;
    const gap = Math.abs(a.r - b.r) - 1;
    s += [1.5, 1, -0.5, -1, -1.5, -2, -2.5][Math.min(gap, 6)];
  }
  return clampN(s, 0, 20);
}

/** 手牌の強さ推定 0〜1 */
export function aiStrength(G: GameState, p: Player): number {
  if (G.board.length === 0) return chenScore(p.hole[0], p.hole[1]) / 20;
  const cards = [...p.hole, ...G.board];
  const best = bestOf(cards);
  const cat = best.score[0];
  let s = [0.24, 0.45, 0.58, 0.68, 0.78, 0.85, 0.92, 0.97, 1][cat];
  s += ((best.score[1] || 0) / 14) * 0.05;
  const usesHole = best.cards.some(c => p.hole.some(h => h.id === c.id));
  if (!usesHole) s = Math.min(s, 0.42); // 場の役だけなら控えめ
  if (cat < 4 && G.board.length < 5) {
    // フラッシュドロー / ストレートドローの可能性で加点
    const suits: Record<string, number> = {};
    cards.forEach(c => { suits[c.s] = (suits[c.s] || 0) + 1; });
    const fs = Math.max(...Object.values(suits));
    if (fs === 4) s += 0.2;
    else if (fs === 3 && G.board.length === 3) s += 0.06;
    const uniq = [...new Set(cards.map(c => c.r))].sort((a, b) => a - b);
    let run = 1;
    let maxrun = 1;
    for (let i = 1; i < uniq.length; i++) {
      run = uniq[i] - uniq[i - 1] === 1 ? run + 1 : 1;
      maxrun = Math.max(maxrun, run);
    }
    if (maxrun >= 4) s += 0.18;
    else if (maxrun === 3 && G.board.length === 3) s += 0.05;
  }
  return Math.min(1, s);
}

export interface AiAction {
  type: "fold" | "check" | "call" | "bet" | "raise";
  to?: number;
}

export function aiDecide(G: GameState, p: Player): AiAction {
  const pot = G.players.reduce((s, q) => s + q.committed, 0);
  const diff = G.currentBet - p.betThisRound;
  const s = aiStrength(G, p) + (Math.random() * 0.14 - 0.07);
  const aggr = p.aggr;
  const step = Math.max(10, Math.round(G.bb / 4 / 10) * 10);
  if (diff <= 0) {
    const strongBet = s > 0.62 - (aggr - 0.5) * 0.15;
    const bluff = G.stage !== "preflop" && Math.random() < 0.06 + aggr * 0.12;
    if ((strongBet || bluff) && p.chips > G.bb) {
      const to =
        Math.round(
          clampN(pot * (0.45 + aggr * 0.35 + Math.random() * 0.2), G.bb, p.betThisRound + p.chips) / step
        ) * step;
      return { type: "bet", to };
    }
    return { type: "check" };
  }
  const potOdds = diff / (pot + diff);
  if (diff >= p.chips) {
    return s > 0.5 + potOdds * 0.28 ? { type: "call" } : { type: "fold" };
  }
  if (s > 0.8 - aggr * 0.1 && G.raiseCount < 3 && Math.random() < 0.4 + aggr * 0.45) {
    const to =
      Math.round(
        clampN(
          G.currentBet + Math.max(G.minRaise, pot * 0.6),
          G.currentBet + G.minRaise,
          p.betThisRound + p.chips
        ) / step
      ) * step;
    if (to > G.currentBet) return { type: "raise", to };
  }
  if (s >= potOdds * 0.92 - 0.02) return { type: "call" };
  if (diff <= G.bb && s > 0.3) return { type: "call" };
  return { type: "fold" };
}
