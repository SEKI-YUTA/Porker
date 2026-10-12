import type { GameState, Player, PresetKind, ActionKind, PotLine } from "./types";
import { bestOf, clampN, fmt, handJa, newDeck, shuffle } from "./cards";
import { aiDecide } from "./ai";
import { SoundFX } from "./sound";
import { canActP, isAlive, potTotal, sliderRange } from "./queries";

const CPU_DEF = [
  { name: "リン", emoji: "🦊", tag: "バランス型", aggr: 0.5 },
  { name: "ゴウ", emoji: "🐼", tag: "攻撃的", aggr: 0.75 },
  { name: "ユキ", emoji: "🐺", tag: "慎重", aggr: 0.32 },
] as const;

function mkPlayer(def: Partial<Player> & { name: string }, seat: number): Player {
  return {
    hole: [],
    folded: false,
    allIn: false,
    out: false,
    betThisRound: 0,
    committed: 0,
    actedThisRound: false,
    thinking: false,
    showHand: false,
    result: null,
    lastWin: 0,
    chips: 1000,
    debt: 0,
    human: false,
    emoji: "🙂",
    tag: "",
    aggr: 0.5,
    seat,
    ...def,
  };
}

function initialState(): GameState {
  return {
    players: [
      mkPlayer({ name: "あなた", human: true }, 0),
      mkPlayer({ ...CPU_DEF[0] }, 1),
      mkPlayer({ ...CPU_DEF[1] }, 2),
      mkPlayer({ ...CPU_DEF[2] }, 3),
    ],
    deck: [],
    board: [],
    dealerIdx: 0, // SSR/ハイドレーション決定論化のため固定。begin() でランダム化
    sbIdx: 0,
    bbIdx: 0,
    sb: 10,
    bb: 20,
    handNo: 0,
    stage: "preflop",
    phase: "idle",
    currentBet: 0,
    minRaise: 20,
    raiseCount: 0,
    turnIdx: -1,
    turnSeq: 0,
    raiseTo: 0,
    handResult: null,
    logs: [],
    logId: 0,
  };
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** CPU破産時の借入額と借金上限（この額を超えて破産したCPUは脱落） */
export const BOT_LOAN = 500;
export const BOT_MAX_DEBT = 1500;

export class PokerEngine {
  state: GameState = initialState();
  snd = new SoundFX();
  private listeners = new Set<() => void>();
  private token = 0;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    this.listeners.forEach(fn => fn());
  }

  destroy() {
    this.token++;
    this.listeners.clear();
  }

  /** スタートボタン（ユーザー操作内でAudioContext初期化） */
  begin() {
    this.snd.init();
    this.state.dealerIdx = Math.floor(Math.random() * 4);
    void this.startHand();
  }

  setSound(on: boolean) {
    this.snd.on = on;
  }

  private log(html: string, cls = "") {
    const G = this.state;
    G.logs = [{ id: ++G.logId, html, cls }, ...G.logs].slice(0, 60);
  }

  private pn(i: number) {
    return `<b class="pn">${this.state.players[i].name}</b>`;
  }

  private nextSeat(i: number): number {
    let j = i;
    do {
      j = (j + 1) % 4;
    } while (this.state.players[j].out);
    return j;
  }

  private nextActor(from: number): number {
    for (let k = 1; k <= 4; k++) {
      const idx = (from + k) % 4;
      if (canActP(this.state.players[idx])) return idx;
    }
    return -1;
  }

  private updateBlinds() {
    const G = this.state;
    const level = Math.min(4, Math.floor((G.handNo - 1) / 8));
    const sb = 10 * Math.pow(2, level);
    if (sb !== G.sb) {
      G.sb = sb;
      G.bb = sb * 2;
      this.log(`⬆️ ブラインドが上がりました: <b>${fmt(G.sb)} / ${fmt(G.bb)}</b>`, "sys");
    }
  }

  private pay(p: Player, amt: number): number {
    const a = Math.max(0, Math.min(amt, p.chips));
    p.chips -= a;
    p.betThisRound += a;
    p.committed += a;
    if (p.chips === 0) p.allIn = true;
    return a;
  }

  private postBlind(i: number, amt: number, label: string) {
    const G = this.state;
    const p = G.players[i];
    const paid = this.pay(p, amt);
    this.log(
      `${this.pn(i)} が${label}で <b>${fmt(paid)}</b> を支払い${p.allIn ? "（オールイン）" : ""}`,
      "sys"
    );
  }

  async startHand() {
    const G = this.state;
    const activeCount = G.players.filter(p => !p.out).length;
    if (activeCount < 2) {
      this.gameOver(G.players[0].chips > 0);
      return;
    }
    const tk = ++this.token;
    G.handNo++;
    this.updateBlinds();
    G.players.forEach(p => {
      p.hole = [];
      p.folded = p.out;
      p.allIn = false;
      p.betThisRound = 0;
      p.committed = 0;
      p.actedThisRound = false;
      p.thinking = false;
      p.showHand = false;
      p.result = null;
      p.lastWin = 0;
    });
    G.deck = shuffle(newDeck());
    G.board = [];
    G.stage = "preflop";
    G.phase = "dealing";
    G.handResult = null;
    G.turnIdx = -1;
    G.raiseTo = 0;
    G.dealerIdx = this.nextSeat(G.dealerIdx);
    if (G.players.filter(p => !p.out).length === 2) {
      G.sbIdx = G.dealerIdx;
      G.bbIdx = this.nextSeat(G.sbIdx);
    } else {
      G.sbIdx = this.nextSeat(G.dealerIdx);
      G.bbIdx = this.nextSeat(G.sbIdx);
    }
    this.emit();
    await sleep(350);
    if (tk !== this.token) return;
    this.postBlind(G.sbIdx, G.sb, "スモールブラインド");
    this.postBlind(G.bbIdx, G.bb, "ビッグブラインド");
    G.currentBet = G.bb;
    G.minRaise = G.bb;
    G.raiseCount = 0;
    this.log(
      `── ハンド ${G.handNo} 開始（ディーラー: ${G.players[G.dealerIdx].name}） ──`,
      "sys"
    );
    this.emit();
    for (let round = 0; round < 2; round++) {
      let i = G.sbIdx;
      for (let k = 0; k < 4; k++) {
        const p = G.players[i];
        if (!p.out) {
          p.hole.push(G.deck.pop() as NonNullable<Player["hole"][number]>);
          this.snd.card();
          this.emit();
          await sleep(140);
          if (tk !== this.token) return;
        }
        i = (i + 1) % 4;
      }
    }
    const first =
      G.players.filter(p => !p.out).length === 2 ? G.sbIdx : this.nextActor(G.bbIdx);
    this.beginBetting(first);
  }

  private beginBetting(first: number) {
    const G = this.state;
    G.phase = "acting";
    let idx = first;
    if (idx < 0 || !canActP(G.players[idx])) idx = this.nextActor(idx < 0 ? G.dealerIdx : idx);
    if (idx === -1) {
      void this.nextStreet();
      return;
    }
    this.setTurn(idx);
  }

  private setTurn(idx: number) {
    const G = this.state;
    G.turnSeq++;
    G.turnIdx = idx;
    const p = G.players[idx];
    if (p.human) {
      const rng = sliderRange(G);
      if (rng) G.raiseTo = clampN(G.raiseTo || rng.min, rng.min, rng.max);
      this.emit();
      return;
    }
    p.thinking = true;
    this.emit();
    const tk = this.token;
    const seq = G.turnSeq;
    setTimeout(() => {
      if (tk !== this.token || this.state.phase !== "acting" || this.state.turnSeq !== seq) return;
      p.thinking = false;
      this.applyAction(idx, aiDecide(this.state, p));
    }, 750 + Math.random() * 850);
  }

  private resetActedExcept(i: number) {
    this.state.players.forEach((q, j) => {
      if (j !== i && !q.out && !q.folded && !q.allIn) q.actedThisRound = false;
    });
  }

  applyAction(i: number, act: { type: ActionKind; to?: number }) {
    const G = this.state;
    const p = G.players[i];
    const diff = G.currentBet - p.betThisRound;
    switch (act.type) {
      case "fold":
        p.folded = true;
        this.log(`${this.pn(i)} フォールド`, "fold");
        this.snd.fold();
        break;
      case "check":
        this.log(`${this.pn(i)} チェック`);
        this.snd.click();
        break;
      case "call": {
        const paid = this.pay(p, diff);
        this.log(
          `${this.pn(i)} コール <b>${fmt(paid)}</b>${p.allIn ? "（オールイン）" : ""}`,
          "bet"
        );
        this.snd.chip();
        break;
      }
      case "bet": {
        const maxTo = p.betThisRound + p.chips;
        const to = clampN(act.to ?? maxTo, Math.min(G.bb, maxTo), maxTo);
        const paid = this.pay(p, to - p.betThisRound);
        G.currentBet = p.betThisRound;
        G.minRaise = Math.max(G.bb, paid);
        G.raiseCount++;
        this.resetActedExcept(i);
        this.log(
          `${this.pn(i)} ベット <b>${fmt(p.betThisRound)}</b>${p.allIn ? "（オールイン）" : ""}`,
          "bet"
        );
        this.snd.chip();
        break;
      }
      case "raise": {
        const maxTo = p.betThisRound + p.chips;
        const to = clampN(
          act.to ?? maxTo,
          Math.min(G.currentBet + G.minRaise, maxTo),
          maxTo
        );
        const size = to - G.currentBet;
        this.pay(p, to - p.betThisRound);
        G.minRaise = Math.max(G.minRaise, size);
        G.currentBet = p.betThisRound;
        G.raiseCount++;
        this.resetActedExcept(i);
        this.log(
          `${this.pn(i)} レイズ <b>${fmt(p.betThisRound)}</b> に上乗せ${p.allIn ? "（オールイン）" : ""}`,
          "bet"
        );
        this.snd.chip();
        break;
      }
    }
    p.actedThisRound = true;
    this.emit();
    this.proceed();
  }

  private bettingDone(): boolean {
    const acters = this.state.players.filter(canActP);
    if (acters.length === 0) return true;
    return acters.every(p => p.actedThisRound && p.betThisRound === this.state.currentBet);
  }

  private proceed() {
    const G = this.state;
    if (G.players.filter(isAlive).length <= 1) {
      this.endByFold();
      return;
    }
    if (this.bettingDone()) {
      void this.nextStreet();
      return;
    }
    const nx = this.nextActor(G.turnIdx);
    if (nx === -1) {
      void this.nextStreet();
      return;
    }
    this.setTurn(nx);
  }

  private async nextStreet() {
    const G = this.state;
    const tk = ++this.token;
    G.turnIdx = -1;
    if (G.stage === "river") {
      this.doShowdown();
      return;
    }
    G.players.forEach(p => {
      p.betThisRound = 0;
      p.actedThisRound = false;
    });
    G.currentBet = 0;
    G.minRaise = G.bb;
    G.raiseCount = 0;
    const order = ["preflop", "flop", "turn", "river"] as const;
    const st = order[order.indexOf(G.stage as (typeof order)[number]) + 1];
    G.stage = st;
    G.phase = "dealing";
    const stageJa: Record<string, string> = {
      flop: "フロップ",
      turn: "ターン",
      river: "リバー",
    };
    this.log(`── ${stageJa[st]} ──`, "sys");
    this.emit();
    const n = st === "flop" ? 3 : 1;
    for (let k = 0; k < n; k++) {
      await sleep(300);
      if (tk !== this.token) return;
      G.board.push(G.deck.pop() as NonNullable<Player["hole"][number]>);
      this.snd.card();
      this.emit();
    }
    const acters = G.players.filter(p => canActP(p));
    if (acters.length >= 2) {
      await sleep(350);
      if (tk !== this.token) return;
      this.beginBetting(this.nextActor(G.dealerIdx));
    } else {
      void this.runOut();
    }
  }

  private async runOut() {
    const G = this.state;
    const tk = ++this.token;
    G.phase = "runout";
    G.turnIdx = -1;
    this.log("⚡ オールイン！ 全員の手札を公開して、残りのカードをめくります", "sys");
    G.players.forEach(p => {
      if (isAlive(p)) p.showHand = true;
    });
    this.emit();
    await sleep(1100);
    if (tk !== this.token) return;
    const order = ["preflop", "flop", "turn", "river"] as const;
    while (G.stage !== "river") {
      G.stage = order[order.indexOf(G.stage as (typeof order)[number]) + 1];
      const n = G.stage === "flop" ? 3 : 1;
      for (let k = 0; k < n; k++) {
        await sleep(420);
        if (tk !== this.token) return;
        G.board.push(G.deck.pop() as NonNullable<Player["hole"][number]>);
        this.snd.card();
        this.emit();
      }
      await sleep(300);
      if (tk !== this.token) return;
    }
    this.doShowdown();
  }

  /** サイドポットを含めた配当ポット構築 */
  private buildPots(): { amount: number; eligible: Player[] }[] {
    const G = this.state;
    const all = G.players.filter(p => p.committed > 0);
    const aliveP = G.players.filter(isAlive);
    const levels = [...new Set(aliveP.map(p => p.committed))].sort((a, b) => a - b);
    const pots: { amount: number; eligible: Player[] }[] = [];
    let prev = 0;
    for (const L of levels) {
      let amt = 0;
      all.forEach(p => {
        amt += Math.max(0, Math.min(p.committed, L) - prev);
      });
      const eligible = aliveP.filter(p => p.committed >= L);
      if (amt > 0) pots.push({ amount: amt, eligible });
      prev = L;
    }
    return pots;
  }

  private doShowdown() {
    const G = this.state;
    G.stage = "showdown";
    G.phase = "showdown";
    G.turnIdx = -1;
    const aliveP = G.players.filter(isAlive);
    aliveP.forEach(p => {
      p.showHand = true;
      p.result = bestOf([...p.hole, ...G.board]);
    });
    const pots = this.buildPots();
    const lines: PotLine[] = [];
    pots.forEach((pot, pi) => {
      let best: number[] | null = null;
      let winners: Player[] = [];
      pot.eligible.forEach(p => {
        const c = best ? cmp(p.result!.score, best) : 1;
        if (c > 0) {
          best = p.result!.score;
          winners = [p];
        } else if (c === 0) {
          winners.push(p);
        }
      });
      const share = Math.floor(pot.amount / winners.length);
      let rem = pot.amount - share * winners.length;
      winners.forEach(w => {
        const g = share + (rem-- > 0 ? 1 : 0);
        w.chips += g;
        w.lastWin += g;
      });
      lines.push({
        label: pots.length > 1 ? (pi === 0 ? "メインポット" : `サイドポット${pi}`) : "ポット",
        amount: pot.amount,
        winners,
        hand: handJa(winners[0].result!.score),
        winCards: winners[0].result!.cards,
      });
    });
    lines.forEach(l => {
      this.log(
        `🏆 ${l.label} <b>${fmt(l.amount)}</b> → ${l.winners.map(w => w.name).join("・")}（${l.hand}）`,
        "win"
      );
    });
    G.players.forEach(p => {
      p.committed = 0;
      p.betThisRound = 0;
    }); // 配当済みのポット表示をクリア
    G.handResult = { type: "showdown", lines };
    const humanWon = lines.some(l => l.winners.some(w => w.human));
    if (humanWon) this.snd.win();
    else this.snd.lose();
    this.handOver();
  }

  private endByFold() {
    const G = this.state;
    const w = G.players.find(isAlive) as Player;
    const amt = potTotal(G);
    w.chips += amt;
    w.lastWin = amt;
    G.players.forEach(p => {
      p.committed = 0;
      p.betThisRound = 0;
    });
    G.handResult = {
      type: "fold",
      lines: [{ label: "ポット", amount: amt, winners: [w], hand: null, winCards: null }],
    };
    this.log(`🏆 ${w.name} の勝ち（全員フォールド） <b>+${fmt(amt)}</b>`, "win");
    this.snd.win();
    G.stage = "showdown";
    this.handOver();
  }

  private handOver() {
    const G = this.state;
    const busted = G.players.filter(p => !p.out && p.chips <= 0);
    busted.forEach(p => {
      if (!p.human && p.debt + BOT_LOAN <= BOT_MAX_DEBT) {
        // CPUは借金して復活
        p.debt += BOT_LOAN;
        p.chips += BOT_LOAN;
        this.log(
          `🕳 ${p.name} は破産！ 借金 ${fmt(BOT_LOAN)} で復活（借金合計 ${fmt(p.debt)}／上限 ${fmt(BOT_MAX_DEBT)}）`,
          "sys"
        );
      } else {
        p.out = true;
        this.log(
          p.human
            ? `💸 ${p.name} はチップを失いました…`
            : `💸 ${p.name} は借金上限（${fmt(BOT_MAX_DEBT)}）に達して脱落…`,
          "sys"
        );
      }
    });
    G.phase = "handover";
    G.turnIdx = -1;
    this.emit();
    const human = G.players[0];
    if (human.out) {
      this.gameOver(false);
      return;
    }
    if (G.players.filter(p => !p.out).length === 1) {
      this.gameOver(true);
      return;
    }
  }

  gameOver(win: boolean) {
    const G = this.state;
    G.phase = "gameover";
    G.turnIdx = -1;
    this.log(win ? "🏆 CPU全員を脱落させました。完全勝利！" : "💸 チップを失いました。ゲームオーバー", "win");
    this.emit();
    if (win) this.snd.win();
    else this.snd.lose();
  }

  resetGame() {
    const G = this.state;
    this.token++;
    G.players.forEach(p => {
      p.chips = 1000;
      p.debt = 0;
      p.out = false;
      p.hole = [];
      p.folded = false;
      p.allIn = false;
      p.betThisRound = 0;
      p.committed = 0;
      p.result = null;
      p.lastWin = 0;
      p.showHand = false;
      p.thinking = false;
    });
    G.handNo = 0;
    G.sb = 10;
    G.bb = 20;
    G.dealerIdx = Math.floor(Math.random() * 4);
    G.board = [];
    G.handResult = null;
    G.phase = "idle";
    G.logs = [];
    this.log("── 新しいゲームを開始します ──", "sys");
    this.snd.init();
    void this.startHand();
  }

  /** 人間のアクション（UIから呼ばれる。不可能な指定は無視） */
  humanAct(kind: ActionKind) {
    const G = this.state;
    if (G.phase !== "acting" || G.turnIdx !== 0) return;
    const p = G.players[0];
    const diff = G.currentBet - p.betThisRound;
    const rng = sliderRange(G);
    if (kind === "fold") {
      this.applyAction(0, { type: "fold" });
      return;
    }
    if (kind === "check" && diff <= 0) {
      this.applyAction(0, { type: "check" });
      return;
    }
    if (kind === "call" && diff > 0) {
      this.applyAction(0, { type: "call" });
      return;
    }
    if (kind === "bet" && G.currentBet === 0 && rng) {
      this.applyAction(0, { type: "bet", to: clampN(G.raiseTo, rng.min, rng.max) });
      return;
    }
    if (kind === "raise" && G.currentBet > 0 && rng && p.betThisRound + p.chips > G.currentBet) {
      this.applyAction(0, { type: "raise", to: clampN(G.raiseTo, rng.min, rng.max) });
    }
  }

  setRaiseTo(v: number) {
    this.state.raiseTo = v;
    this.emit();
  }

  presetTo(kind: PresetKind) {
    const G = this.state;
    const rng = sliderRange(G);
    if (!rng) return;
    const p = G.players[0];
    let to: number;
    if (kind === "min") to = rng.min;
    else if (kind === "max") to = rng.max;
    else {
      const base = potTotal(G);
      to =
        G.currentBet === 0
          ? base * (kind === "half" ? 0.5 : 1)
          : G.currentBet + base * (kind === "half" ? 0.5 : 1);
    }
    to = Math.round(to / rng.step) * rng.step;
    to = clampN(to, rng.min, rng.max);
    G.raiseTo = to;
    this.emit();
  }
}

function cmp(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}
