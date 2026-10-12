import type { GameState } from "../lib/poker/types";
import { fmt, handJa } from "../lib/poker/cards";
import { potTotal, winCardSet } from "../lib/poker/queries";
import PlayingCard from "./PlayingCard";

function Seat({ G, i }: { G: GameState; i: number }) {
  const p = G.players[i];
  const hl = winCardSet(G);
  const active = G.phase === "acting" && G.turnIdx === i;

  let sbTxt = "";
  let sbCls = "sbadge";
  if (p.out) {
    sbTxt = "脱落";
    sbCls += " warn";
  } else if (p.folded) {
    sbTxt = "フォールド";
    sbCls += " warn";
  } else if (p.thinking) {
    sbTxt = "考え中…";
    sbCls += " think";
  } else if (p.allIn) {
    sbTxt = "オールイン";
    sbCls += " gold";
  } else if (p.lastWin > 0 && (G.phase === "handover" || G.phase === "gameover")) {
    sbTxt = "+" + fmt(p.lastWin);
    sbCls += " gold";
  }

  const showHb =
    p.showHand &&
    p.result &&
    ["showdown", "handover", "gameover", "runout"].includes(G.phase);

  return (
    <div
      className={`seat s${i}${active ? " active" : ""}`}
      style={p.out ? { opacity: 0.38 } : undefined}
    >
      <div className="cards">
        {p.hole.map(c =>
          p.showHand ? (
            <PlayingCard key={`${c.id}-f`} card={c} variant="cpu" anim hl={hl.has(c.id)} />
          ) : (
            <PlayingCard key={`${c.id}-b`} back variant="cpu" anim />
          )
        )}
      </div>
      <div className="plate">
        <div className="avatar" aria-hidden="true">
          {p.emoji}
        </div>
        <div className="pmeta">
          <div className="pname">
            {p.name}
            <span className="tag">{p.tag}</span>
          </div>
          <div className="pchips num">{fmt(Math.max(0, p.chips))}</div>
          {p.debt > 0 ? (
            <div className="pdebt num" title="破産後に借金して復活した額">
              借金 {fmt(p.debt)}
            </div>
          ) : null}
          {p.betThisRound > 0 ? (
            <div className="bet-inline num">ベット {fmt(p.betThisRound)}</div>
          ) : null}
        </div>
        <div className={`dealer-btn${G.dealerIdx === i && !p.out && G.handNo > 0 ? " on" : ""}`}>
          D
        </div>
      </div>
      {sbTxt ? <div className={sbCls}>{sbTxt}</div> : null}
      {p.betThisRound > 0 ? (
        <div className="bet-badge">
          <span className="chipico" />
          <span className="bv num">{fmt(p.betThisRound)}</span>
        </div>
      ) : null}
      {showHb ? <div className="handbadge">{handJa(p.result!.score)}</div> : null}
    </div>
  );
}

export default function Table({ G }: { G: GameState }) {
  const hl = winCardSet(G);
  return (
    <div className="table">
      <Seat G={G} i={1} />
      <Seat G={G} i={2} />
      <Seat G={G} i={3} />
      <div className="table-center">
        <div id="potBadge">
          <span className="chipico" />
          ポット <span className="num">{fmt(potTotal(G))}</span>
        </div>
        <div className="board-row" id="boardRow">
          {[0, 1, 2, 3, 4].map(i => {
            const lbl = i === 0 ? "フロップ" : i === 3 ? "ターン" : i === 4 ? "リバー" : "";
            return (
              <div key={i} className={`bslot${i === 3 ? " gap-l" : ""}`}>
                {i < G.board.length ? (
                  <PlayingCard card={G.board[i]} anim hl={hl.has(G.board[i].id)} />
                ) : (
                  <div className="slot" />
                )}
                <span className="lbl">{lbl}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
