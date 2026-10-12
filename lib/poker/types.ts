export type Suit = "s" | "h" | "d" | "c";

export interface Card {
  /** ランク 2〜14（11=J, 12=Q, 13=K, 14=A） */
  r: number;
  s: Suit;
  id: string;
}

export type Stage = "preflop" | "flop" | "turn" | "river" | "showdown";
export type Phase =
  | "idle"
  | "dealing"
  | "acting"
  | "runout"
  | "showdown"
  | "handover"
  | "gameover";

/** 5枚評価結果: [カテゴリ, ...比較キー]（辞書式比較で強さ判定） */
export type Score = number[];

export interface EvalResult {
  score: Score;
  cards: Card[];
}

export interface LogEntry {
  id: number;
  html: string;
  cls: string;
}

export interface Player {
  name: string;
  emoji: string;
  tag: string;
  human: boolean;
  aggr: number;
  seat: number;
  chips: number;
  /** 破産後に借金して復活した合計額（CPUのみ。上限 BOT_MAX_DEBT） */
  debt: number;
  hole: Card[];
  folded: boolean;
  allIn: boolean;
  out: boolean;
  betThisRound: number;
  committed: number;
  actedThisRound: boolean;
  thinking: boolean;
  showHand: boolean;
  result: EvalResult | null;
  lastWin: number;
}

export interface PotLine {
  label: string;
  amount: number;
  winners: Player[];
  hand: string | null;
  winCards: Card[] | null;
}

export interface HandResult {
  type: "showdown" | "fold";
  lines: PotLine[];
}

export type ActionKind = "fold" | "check" | "call" | "bet" | "raise";
export type PresetKind = "min" | "half" | "pot" | "max";

export interface ButtonState {
  ok: boolean;
  label?: string;
  reason?: string;
}

export interface SliderRange {
  min: number;
  max: number;
  step: number;
}

export interface GameState {
  players: Player[];
  deck: Card[];
  board: Card[];
  dealerIdx: number;
  sbIdx: number;
  bbIdx: number;
  sb: number;
  bb: number;
  handNo: number;
  stage: Stage;
  phase: Phase;
  currentBet: number;
  minRaise: number;
  raiseCount: number;
  turnIdx: number;
  turnSeq: number;
  raiseTo: number;
  handResult: HandResult | null;
  logs: LogEntry[];
  logId: number;
}
