import type { GameState } from "../lib/poker/types";
import { fmt } from "../lib/poker/cards";

export default function Banner({ G, onNext }: { G: GameState; onNext: () => void }) {
  const show =
    (G.phase === "handover" || G.phase === "gameover") && G.handResult !== null;
  if (!show || !G.handResult) return <div id="banner" />;
  const hr = G.handResult;
  const fallen = G.players.filter(p => p.out).map(p => `${p.emoji}${p.name}`).join("・");
  const debts = G.players
    .filter(p => p.debt > 0)
    .map(p => `${p.emoji}${p.name} <b class="num">${fmt(p.debt)}</b>`)
    .join("・");
  return (
    <div id="banner" className="on">
      <div className="banner-card">
        <div className="ttl">ハンド {G.handNo} 終了</div>
        <div className="lines">
          {hr.lines.map((l, i) => (
            <div key={i}>
              🏆 {l.winners.map(w => `${w.emoji} ${w.name}`).join("・")} が{" "}
              <b className="num">{fmt(l.amount)}</b> チップ獲得
              <br />
              <small>{l.hand ? `役: ${l.hand}` : "全員フォールドによる勝利"}</small>
            </div>
          ))}
        </div>
        {debts ? (
          <div className="note-debt" dangerouslySetInnerHTML={{ __html: `借金中: ${debts}` }} />
        ) : null}
        {fallen ? <div className="note">脱落: {fallen}</div> : null}
        {G.phase === "handover" ? (
          <button className="big-btn" id="nextHandBtn" type="button" onClick={onNext}>
            次のハンドへ（Enter）
          </button>
        ) : null}
      </div>
    </div>
  );
}
