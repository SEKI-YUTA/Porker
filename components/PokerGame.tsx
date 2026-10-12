"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import type { ActionKind, PresetKind } from "../lib/poker/types";
import { PokerEngine, BOT_LOAN, BOT_MAX_DEBT } from "../lib/poker/engine";
import { statusHTML } from "../lib/poker/queries";
import { fmt } from "../lib/poker/cards";
import Stepper from "./Stepper";
import Table from "./Table";
import YouZone from "./YouZone";
import ActionBox from "./ActionBox";
import RankPanel from "./RankPanel";
import StartingHandPanel from "./StartingHandPanel";
import LogPanel from "./LogPanel";
import Banner from "./Banner";
import Modal from "./Modal";

type LocalModal = "help" | "confirm" | null;
type SheetKind = "rank" | "hand" | "log";
type Sheet = SheetKind | null;

function FanCard({ cls, rk, st, red }: { cls: string; rk: string; st: string; red?: boolean }) {
  return (
    <span className={`card ${cls}${red ? " red" : ""}`} aria-hidden="true">
      <span className="rk">{rk}</span>
      <span className="st">{st}</span>
      <span className="mini-st">{st}</span>
    </span>
  );
}

export default function PokerGame() {
  const engineRef = useRef<PokerEngine | null>(null);
  if (!engineRef.current) engineRef.current = new PokerEngine();
  const engine = engineRef.current;
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const un = engine.subscribe(force);
    return () => {
      un();
      engine.destroy();
    };
  }, [engine]);

  const G = engine.state;
  const [modal, setModal] = useState<LocalModal>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [soundOn, setSoundOn] = useState(true);

  const activeModal: LocalModal | "start" | "gameover" | null =
    modal ??
    (G.phase === "idle" ? "start" : G.phase === "gameover" ? "gameover" : null);

  // キーボードショートカット（F / C / R、ハンド間のEnter）
  const localModalRef = useRef<LocalModal>(null);
  useEffect(() => {
    localModalRef.current = modal;
  }, [modal]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = engine.state;
      const lm = localModalRef.current;
      const active = lm ?? (st.phase === "idle" || st.phase === "gameover" ? "modal" : null);
      if (active) {
        if (e.key === "Escape" && (lm === "help" || lm === "confirm")) setModal(null);
        return;
      }
      const ae = document.activeElement;
      const onBtn = ae instanceof HTMLElement && ae.tagName === "BUTTON";
      if (st.phase === "acting" && st.turnIdx === 0) {
        const k = e.key.toLowerCase();
        if (k === "f") engine.humanAct("fold");
        else if (k === "c")
          engine.humanAct(st.currentBet - st.players[0].betThisRound <= 0 ? "check" : "call");
        else if (k === "r") engine.humanAct(st.currentBet === 0 ? "bet" : "raise");
      } else if (st.phase === "handover" && e.key === "Enter" && !onBtn) {
        void engine.startHand();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine]);

  // デバッグ・テスト用フック
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__PK = {
      engine,
      G: engine.state,
      humanAct: (k: ActionKind) => engine.humanAct(k),
      startHand: () => void engine.startHand(),
    };
  }, [engine]);

  const tabCls = (active: boolean) =>
    `tool-btn panel-tab${active ? " on" : ""}`;
  const toggleSheet = (name: SheetKind) =>
    setSheet(s => (s === name ? null : name));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          ポーカー
          <small>TEXAS HOLD&apos;EM</small>
        </div>
        <div className="topstats">
          <span className="stat-chip" title="いま持っているチップ">
            所持チップ <b className="num">{fmt(Math.max(0, G.players[0].chips))}</b>
          </span>
          <span className="stat-chip">
            ハンド <b className="num">{fmt(G.handNo)}</b>
          </span>
          <span className="stat-chip">
            ブラインド <b className="num">{fmt(G.sb)}/{fmt(G.bb)}</b>
          </span>
        </div>
        <div className="topbar-tools">
          <button
            type="button"
            className={tabCls(sheet === "rank")}
            id="tabRank"
            aria-expanded={sheet === "rank"}
            onClick={() => toggleSheet("rank")}
          >
            役一覧
          </button>
          <button
            type="button"
            className={tabCls(sheet === "hand")}
            id="tabHand"
            aria-expanded={sheet === "hand"}
            onClick={() => toggleSheet("hand")}
          >
            ハンド表
          </button>
          <button
            type="button"
            className={tabCls(sheet === "log")}
            id="tabLog"
            aria-expanded={sheet === "log"}
            onClick={() => toggleSheet("log")}
          >
            ログ
          </button>
          <button
            type="button"
            className="tool-btn"
            id="soundBtn"
            onClick={() => {
              const v = !engine.snd.on;
              engine.setSound(v);
              setSoundOn(v);
            }}
          >
            {soundOn ? "🔊 音" : "🔇 消音"}
          </button>
          <button type="button" className="tool-btn" id="helpBtn" onClick={() => setModal("help")}>
            遊び方
          </button>
          <button
            type="button"
            className="tool-btn"
            id="resetBtn"
            onClick={() => {
              if (G.phase !== "idle") setModal("confirm");
            }}
          >
            最初から
          </button>
        </div>
      </header>

      <div className="stepper-wrap">
        <Stepper G={G} />
        <p id="statusLine" aria-live="polite" dangerouslySetInnerHTML={{ __html: statusHTML(G) }} />
      </div>

      <div className="layout">
        <LogPanel G={G} open={sheet === "log"} />
        <main className="col">
          <div className="table-wrap">
            <Table G={G} />
            <Banner G={G} onNext={() => void engine.startHand()} />
          </div>
          <div className="youzone">
            <YouZone G={G} />
            <ActionBox
              G={G}
              onAct={(k: ActionKind) => engine.humanAct(k)}
              onPreset={(k: PresetKind) => engine.presetTo(k)}
              onSlide={(v: number) => engine.setRaiseTo(v)}
            />
          </div>
        </main>
        <div className="right-col">
          <RankPanel G={G} open={sheet === "rank"} />
          <StartingHandPanel G={G} open={sheet === "hand"} />
        </div>
      </div>

      {activeModal === "start" ? (
        <Modal lock>
          <div className="fan" aria-hidden="true">
            <FanCard cls="f1" rk="A" st="♠" />
            <FanCard cls="f2" rk="K" st="♥" red />
            <FanCard cls="f3" rk="Q" st="♣" />
          </div>
          <h2 className="m-title">テキサスホールデム ポーカー</h2>
          <p className="m-lead">CPU3人（リン・ゴウ・ユキ）と対戦する、初心者向けのポーカーです。</p>
          <ul>
            <li>
              全員 <b>1,000チップ</b>からスタート（ブラインド 10/20、8ハンドごとに上昇）
            </li>
            <li>
              右の「<b>役の強さ一覧</b>」で、いま自分にできている役をいつでも確認できます
            </li>
            <li>上部のステッパーで、いまがどの段階（プリフロップ→ … →ショウダウン）か分かります</li>
            <li>
              選べないアクションはグレー表示。マウスを乗せると<b>理由が表示</b>されます
            </li>
          </ul>
          <div className="m-btns">
            <button
              className="big-btn"
              id="startBtn"
              type="button"
              onClick={() => engine.begin()}
            >
              ゲームを始める
            </button>
            <button className="ghost-btn" type="button" onClick={() => setModal("help")}>
              遊び方を見る
            </button>
          </div>
        </Modal>
      ) : null}

      {activeModal === "help" ? (
        <Modal onClose={() => setModal(null)}>
          <h2 className="m-title">遊び方</h2>
          <p className="m-lead">
            7枚のカード（自分の2枚＋みんなで共有する5枚）から、いちばん強い5枚を作るゲームです。
          </p>
          <h3>進行の流れ</h3>
          <ul>
            <li>
              <b>プリフロップ</b>: 手札2枚が配られ、最初のベット
            </li>
            <li>
              <b>フロップ</b>: 共有カード3枚がオープン → 2巡目のベット
            </li>
            <li>
              <b>ターン</b>: 4枚目がオープン → 3巡目
            </li>
            <li>
              <b>リバー</b>: 5枚目がオープン → 最終ベット
            </li>
            <li>
              <b>ショウダウン</b>: 残った人同士で役を比べ、強い人がポット（賭け金の総額）獲得
            </li>
          </ul>
          <h3>アクション</h3>
          <table>
            <tbody>
              <tr>
                <th>フォールド</th>
                <td>このハンドから降りる。それまで賭けたチップは戻りません</td>
              </tr>
              <tr>
                <th>チェック</th>
                <td>誰もベットしていないとき、チップを足さずに権利を次へ</td>
              </tr>
              <tr>
                <th>コール</th>
                <td>相手のベットと同じ額を払って勝負続行</td>
              </tr>
              <tr>
                <th>ベット</th>
                <td>誰もベットしていないとき、最初にチップを賭ける</td>
              </tr>
              <tr>
                <th>レイズ</th>
                <td>すでにあるベットに上乗せする</td>
              </tr>
              <tr>
                <th>オールイン</th>
                <td>全チップを賭ける。コール額が足りないときは自動でこれになります</td>
              </tr>
            </tbody>
          </table>
          <h3>ルールのポイント</h3>
          <ul>
            <li>
              <b>ブラインド</b>: 各ハンドの開始時に、ディーラーの左隣2人が強制的に支払う最低ベットです
            </li>
            <li>
              自分の2枚と共有5枚の<b>計7枚から最も強い5枚が自動選択</b>
              されるので、共有カードだけの役もOK
            </li>
            <li>途中で全員が1人を除いてフォールドしたら、残った1人がショウダウンなしでポット獲得</li>
            <li>
              CPUは破産すると<b>借金{fmt(BOT_LOAN)}で復活</b>します（シートの「借金」で残高を確認）。
              借金が上限{fmt(BOT_MAX_DEBT)}に達した状態で破産したCPUは脱落。CPU全員を脱落させたら完全勝利です
            </li>
            <li>あなた自身がチップ0になった場合はゲームオーバー（借金復活はCPUのみ）</li>
          </ul>
          <h3>補助機能</h3>
          <ul>
            <li>選べないボタンはグレー表示。マウスホバー（タップ）で理由が出ます</li>
            <li>
              キーボード: <b>F</b>=フォールド ／ <b>C</b>=チェック・コール ／ <b>R</b>=ベット・レイズ
            </li>
          </ul>
          <div className="m-btns">
            <button className="ghost-btn" type="button" onClick={() => setModal(null)}>
              閉じる
            </button>
          </div>
        </Modal>
      ) : null}

      {activeModal === "confirm" ? (
        <Modal onClose={() => setModal(null)}>
          <h2 className="m-title">最初からやり直す？</h2>
          <p className="m-lead">現在のチップと進行はリセットされます。</p>
          <div className="m-btns">
            <button
              className="big-btn"
              type="button"
              onClick={() => {
                setModal(null);
                engine.resetGame();
              }}
            >
              はい、やり直す
            </button>
            <button className="ghost-btn" type="button" onClick={() => setModal(null)}>
              キャンセル
            </button>
          </div>
        </Modal>
      ) : null}

      {activeModal === "gameover" ? (
        <Modal lock>
          <h2 className="m-title">{!G.players[0].out ? "🏆 完全勝利！" : "💸 ゲームオーバー"}</h2>
          <p className="m-lead">
            {!G.players[0].out
              ? "CPU全員のチップを奪い取りました。プロのサバイブです。"
              : "チップがなくなってしまいました。次はブラフ狙いでいきましょう。"}
          </p>
          <p>
            プレイしたハンド数: <b className="num">{G.handNo}</b>
          </p>
          <div className="m-btns">
            <button className="big-btn" type="button" onClick={() => engine.resetGame()}>
              もう一度遊ぶ
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
