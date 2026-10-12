import { Fragment } from "react";
import type { GameState } from "../lib/poker/types";
import { RANK_LABEL, SUIT_CHAR } from "../lib/poker/cards";
import { cellForHole, SH_GRID, SH_RANKS, SH_TIERS, shCellLabel } from "../lib/poker/startingHands";

export default function StartingHandPanel({ G, open }: { G: GameState; open?: boolean }) {
  const p = G.players[0];
  const hasHand = p.hole.length === 2 && !p.folded && !p.out;
  const cell = hasHand ? cellForHole(p.hole[0], p.hole[1]) : null;
  const tier = cell ? SH_GRID[cell.i][cell.j] : null;

  return (
    <aside
      className={`side${open ? " open" : ""}`}
      id="shPanel"
      aria-label="スターティングハンド表"
    >
      <div className="side-head">
        <span className="dot" />
        スターティングハンド表
      </div>
      <div className="sh-nowbox">
        <div className="cap">プリフロップの最初の2枚の強さの目安</div>
        {cell && tier !== null ? (
          <div className="sh-now">
            あなたの手札: {RANK_LABEL(p.hole[0].r)}
            {SUIT_CHAR[p.hole[0].s]} {RANK_LABEL(p.hole[1].r)}
            {SUIT_CHAR[p.hole[1].s]}
            <span className="sub">{SH_TIERS[tier].label}（マスが光っています）</span>
          </div>
        ) : (
          <div className="sh-now">
            —<span className="sub">手札が配られると、該当するマスが光ります</span>
          </div>
        )}
      </div>
      <div className="sh-wrap">
        <div className="sh-grid" role="img" aria-label="スターティングハンドの強さ一覧（13×13）">
          <span className="hd" />
          {SH_RANKS.map(r => (
            <span key={`h${r}`} className="hd">
              {RANK_LABEL(r)}
            </span>
          ))}
          {SH_RANKS.map((rowR, i) => (
            <Fragment key={`r${rowR}`}>
              <span className="hd">{RANK_LABEL(rowR)}</span>
              {SH_RANKS.map((colR, j) => {
                const t = SH_GRID[i][j];
                const label = shCellLabel(i, j, RANK_LABEL);
                const me = cell !== null && cell.i === i && cell.j === j;
                return (
                  <span
                    key={`c${colR}`}
                    className={`sh-cell ${SH_TIERS[t].cls}${i === j ? " pair" : ""}${me ? " me" : ""}`}
                    data-hand={label}
                    title={`${label}: ${SH_TIERS[t].short}`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="sh-legend">
        {SH_TIERS.map(t => (
          <div key={t.cls}>
            <span className={`sw ${t.cls}`} />
            {t.label}
          </div>
        ))}
      </div>
      <div className="sh-note">
        見方: 対角線（左上→右下）＝ポケットペア、右上＝スーテッド（同じマーク）、左下＝オフスート（マーク違い）。上・左ほど強いカードです。表は目安なので、位置やブラインドの高さも考えて自分で判断しましょう。
      </div>
    </aside>
  );
}
