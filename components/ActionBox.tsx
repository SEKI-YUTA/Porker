"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ActionKind, GameState, PresetKind } from "../lib/poker/types";
import { fmt } from "../lib/poker/cards";
import { actionStates } from "../lib/poker/queries";

interface Props {
  G: GameState;
  onAct: (kind: ActionKind) => void;
  onPreset: (kind: PresetKind) => void;
  onSlide: (v: number) => void;
}

interface Tip {
  anchorX: number;
  anchorY: number;
  h: number;
  msg: string;
}

/** aria-disabled な要素から理由を取り出す */
function reasonOf(el: HTMLElement): string | null {
  if (el.getAttribute("aria-disabled") !== "true") return null;
  return el.getAttribute("data-reason");
}

export default function ActionBox({ G, onAct, onPreset, onSlide }: Props) {
  const S = actionStates(G);
  const [tip, setTip] = useState<Tip | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // tip を実際のサイズで測って上方向に配置（入りきらなければ下へ）
  useLayoutEffect(() => {
    if (!tip || !tipRef.current) return;
    const el = tipRef.current;
    const tw = el.offsetWidth;
    const th = el.offsetHeight;
    let x = tip.anchorX - tw / 2;
    x = Math.max(8, Math.min(x, window.innerWidth - tw - 8));
    let y = tip.anchorY - th - 10;
    if (y < 8) y = tip.anchorY + tip.h + 10;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, [tip]);

  const hoverTip = (el: HTMLElement) => {
    const msg = reasonOf(el);
    if (!msg) {
      setTip(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setTip({ anchorX: r.left + r.width / 2, anchorY: r.top, h: r.height, msg });
  };

  const flashTip = (el: HTMLElement) => {
    const msg = reasonOf(el);
    if (!msg) return;
    const r = el.getBoundingClientRect();
    setTip({ anchorX: r.left + r.width / 2, anchorY: r.top, h: r.height, msg });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setTip(null), 1800);
  };

  const btn = (id: string, kind: ActionKind, cls: string, label: string) => {
    const st = S[kind];
    return (
      <button
        id={id}
        type="button"
        className={`act ${cls}`}
        aria-disabled={!st.ok}
        data-reason={st.ok ? undefined : st.reason}
        onClick={() => {
          if (st.ok) onAct(kind);
        }}
        onPointerEnter={e => hoverTip(e.currentTarget)}
        onPointerLeave={() => setTip(null)}
        onFocus={e => hoverTip(e.currentTarget)}
        onBlur={() => setTip(null)}
        onPointerDown={e => flashTip(e.currentTarget)}
      >
        <span className="k">{label}</span>
        <span className="a">{st.ok ? st.label : "選択できません"}</span>
      </button>
    );
  };

  const p = G.players[0];
  const helpHTML =
    S.slider.ok && S.rng
      ? G.currentBet === 0
        ? `合計 <b class="num">${fmt(G.raiseTo)}</b> をベット（手持ち ${fmt(p.chips)}）`
        : `合計 <b class="num">${fmt(G.raiseTo)}</b> にレイズ（追加 ${fmt(G.raiseTo - p.betThisRound)}）`
      : "現在は金額を選べません。";

  const presets: [PresetKind, string][] = [
    ["min", "最小"],
    ["half", "1/2ポット"],
    ["pot", "ポット"],
    ["max", "オールイン"],
  ];

  return (
    <div className="actbox">
      <div className="btn-grid">
        {btn("btn-fold", "fold", "act-fold", "フォールド")}
        {btn("btn-check", "check", "act-check", "チェック")}
        {btn("btn-call", "call", "act-call", "コール")}
      </div>
      <div className="row2">
        {btn("btn-bet", "bet", "act-bet", "ベット")}
        {btn("btn-raise", "raise", "act-raise", "レイズ")}
      </div>
      <div
        id="raiseRow"
        aria-disabled={!S.slider.ok}
        data-reason={S.slider.ok ? undefined : S.slider.reason}
        onPointerEnter={e => hoverTip(e.currentTarget)}
        onPointerLeave={() => setTip(null)}
      >
        <div className="raise-line">
          <span className="cap">金額</span>
          <input
            id="raiseSlider"
            type="range"
            disabled={!S.slider.ok}
            min={S.rng ? S.rng.min : 0}
            max={S.rng ? S.rng.max : 100}
            step={S.rng ? S.rng.step : 10}
            value={G.raiseTo}
            onChange={e => onSlide(Number(e.target.value))}
            aria-label="ベット・レイズ金額"
          />
          <span className="num" id="raiseVal">
            {S.slider.ok && S.rng ? fmt(G.raiseTo) : "–"}
          </span>
        </div>
        <div className="presets">
          {presets.map(([k, l]) => (
            <button key={k} type="button" className="preset" onClick={() => onPreset(k)}>
              {l}
            </button>
          ))}
        </div>
        <div id="raiseHelp" dangerouslySetInnerHTML={{ __html: helpHTML }} />
      </div>
      {tip ? (
        <div id="tooltip" ref={tipRef} role="tooltip" style={{ left: -9999, top: 0 }}>
          {tip.msg}
        </div>
      ) : null}
    </div>
  );
}
