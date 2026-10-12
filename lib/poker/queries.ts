import type { ActionKind, ButtonState, Card, GameState, Player, SliderRange } from "./types";
import { bestOf, fmt, handJa, RANK_LABEL } from "./cards";

export const isAlive = (p: Player): boolean => !p.out && !p.folded;
export const canActP = (p: Player): boolean => isAlive(p) && !p.allIn;
export const potTotal = (G: GameState): number =>
  G.players.reduce((s, p) => s + p.committed, 0);

function stageName(stage: string): string {
  const map: Record<string, string> = {
    preflop: "プリフロップ",
    flop: "フロップ",
    turn: "ターン",
    river: "リバー",
    showdown: "ショウダウン",
  };
  return map[stage] || "";
}

/** 自分（人間）の現在の役 */
export function humanNow(G: GameState): { score: number[]; cards: Card[] } | null {
  const p = G.players[0];
  if (p.hole.length < 2) return null;
  if (G.board.length >= 3) return bestOf([...p.hole, ...G.board]);
  if (p.hole[0].r === p.hole[1].r)
    return { score: [1, Math.max(p.hole[0].r, p.hole[1].r)], cards: [] };
  return { score: [0, Math.max(p.hole[0].r, p.hole[1].r)], cards: [] };
}

/** ショウダウン勝者の最良5枚（ハイライト用） */
export function winCardSet(G: GameState): Set<string> {
  const s = new Set<string>();
  if (
    G.handResult &&
    G.handResult.type === "showdown" &&
    (G.phase === "showdown" || G.phase === "handover" || G.phase === "gameover")
  ) {
    G.handResult.lines.forEach(l => (l.winCards || []).forEach(c => s.add(c.id)));
  }
  return s;
}

/** ステータス行（HTML。自分のターンは金色で強調） */
export function statusHTML(G: GameState): string {
  const ja = stageName(G.stage);
  if (G.phase === "idle") return "「ゲームを始める」を押してください。";
  if (G.phase === "dealing") return `${ja} — カードを配っています…`;
  if (G.phase === "runout") return `⚡ オールイン！ ${ja} — 残りのカードを開示します…`;
  if (G.phase === "showdown") return "ショウダウン — 役くらべの結果をお待ちください。";
  if (G.phase === "handover") return "ハンド終了 — 次のハンドを開始できます。";
  if (G.phase === "gameover") return "ゲーム終了 — 「もう一度遊ぶ」で再スタートできます。";
  if (G.phase === "acting") {
    const p = G.players[G.turnIdx];
    return p.human
      ? `<span class="turn-you">${ja} — あなたのターンです。アクションを選んでください。</span>`
      : `${ja} — ${p.name}のターン…`;
  }
  return "";
}

/** スライダー設定（ベット/レイズ可能時のみ） */
export function sliderRange(G: GameState): SliderRange | null {
  const p = G.players[0];
  const maxTo = p.betThisRound + p.chips;
  if (maxTo <= 0) return null;
  const possible = G.currentBet === 0 || maxTo > G.currentBet;
  if (!possible) return null;
  const minTo =
    G.currentBet === 0
      ? Math.min(G.bb, maxTo)
      : Math.min(G.currentBet + G.minRaise, maxTo);
  const step = Math.max(10, Math.round(G.bb / 4 / 10) * 10);
  return { min: minTo, max: maxTo, step };
}

export interface ActionStates {
  fold: ButtonState;
  check: ButtonState;
  call: ButtonState;
  bet: ButtonState;
  raise: ButtonState;
  slider: ButtonState;
  rng: SliderRange | null;
}

/** 各アクションボタンの可否と、選択できないときの理由 */
export function actionStates(G: GameState): ActionStates {
  const p = G.players[0];
  const dis = (reason: string): ButtonState => ({ ok: false, reason });
  const en = (label?: string): ButtonState => ({ ok: true, label: label || "" });
  const S = {} as Record<ActionKind | "slider", ButtonState> & { rng: SliderRange | null };
  const acting = G.phase === "acting" && G.turnIdx === 0;

  let base: string | null = null;
  if (G.phase === "idle") base = "「ゲームを始める」を押すとスタートします。";
  else if (G.phase === "dealing") base = "カードを配っています。少しお待ちください。";
  else if (G.phase === "runout") base = "オールインが成立しています。残りのカードの開示をお待ちください。";
  else if (G.phase === "showdown") base = "ショウダウン中です。結果表示をお待ちください。";
  else if (G.phase === "handover" || G.phase === "gameover")
    base = "このハンドは終了しました。次のハンドを開始できます。";
  else if (acting && p.folded) base = "あなたはフォールド済みです。ハンド終了までお待ちください。";
  else if (G.phase === "acting" && G.turnIdx !== 0)
    base = "CPUのアクション待ちです。あなたのターンが来たら操作できます。";

  if (base) {
    for (const k of ["fold", "check", "call", "bet", "raise"] as const) S[k] = dis(base);
    S.slider = dis(base);
    S.rng = null;
    return S as ActionStates;
  }

  const diff = G.currentBet - p.betThisRound;
  const rng = sliderRange(G);

  S.fold = en("");
  S.check =
    diff <= 0
      ? en("追加チップなし")
      : dis(
          `チェックはまだ誰もベットしていないときだけできます。現在 ${fmt(G.currentBet)} のベットがあるため、コール・レイズ・フォールドから選びます。`
        );
  S.call =
    diff > 0
      ? en(diff >= p.chips ? `オールイン ${fmt(p.chips)}` : fmt(diff))
      : dis("コールできるベットがありません（誰もベットしていません）。チェックかベットを選びましょう。");

  if (G.currentBet === 0) {
    S.bet = rng ? en(fmt(G.raiseTo)) : dis("ベットに使えるチップがありません。");
    S.raise = dis("まだ誰もベットしていません。最初に賭ける場合は「ベット」を選びます。");
  } else {
    S.bet = dis(
      G.stage === "preflop"
        ? `プリフロップでは強制ベット（ブラインド ${fmt(G.bb)}）がすでにあります。上乗せは「レイズ」で行います。`
        : `すでに ${fmt(G.currentBet)} のベットがあります。上乗せは「レイズ」で行います。`
    );
    S.raise = rng
      ? en(fmt(G.raiseTo))
      : dis("レイズに必要なチップがありません。コール（全チップを払うオールイン）かフォールドを選びましょう。");
  }

  const primary = G.currentBet === 0 ? S.bet : S.raise;
  S.slider = primary.ok ? { ok: true } : primary;

  S.rng = rng;
  return S as ActionStates;
}

/** 自分のヒント文言（あなたの役、HTML） */
export function youHintHTML(G: GameState): string {
  const p = G.players[0];
  const now = humanNow(G);
  if (p.folded) return "フォールド中 — このハンドは見学です。次のハンドをお待ちください。";
  if (!now) return "—";
  if (G.board.length === 0 && p.hole.length === 2) {
    return p.hole[0].r === p.hole[1].r
      ? `いまの役: <b>ポケットペア（${RANK_LABEL(p.hole[0].r)}）</b>`
      : `いまの役: <b>ハイカード（${RANK_LABEL(now.score[1])}ハイ）</b><br>フロップ（共有3枚）で役が作れます`;
  }
  if (G.board.length >= 3) {
    return `いまの役: <b>${handJa(now.score)}</b><br>あなたの2枚＋場の${G.board.length}枚の計7枚から、いちばん強い5枚が自動で選ばれます`;
  }
  return "—";
}
