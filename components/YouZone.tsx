import type { GameState } from "../lib/poker/types";
import { fmt } from "../lib/poker/cards";
import { winCardSet, youHintHTML } from "../lib/poker/queries";
import PlayingCard from "./PlayingCard";

export default function YouZone({ G }: { G: GameState }) {
  const p = G.players[0];
  const hl = winCardSet(G);

  const parts: string[] = [];
  if (G.dealerIdx === 0 && !p.out && G.handNo > 0) parts.push(`<span class="d">D</span>ディーラー`);
  if (p.allIn) parts.push("⚡オールイン中");
  parts.push(`このストリートのベット <b class="num">${fmt(p.betThisRound)}</b>`);

  const showWin =
    (G.phase === "handover" || G.phase === "gameover") && p.lastWin > 0;

  return (
    <div className="youcard-box">
      <div className="you-chips">
        <span className="chipico" />
        <span>所持チップ</span>
        <b className="num">{fmt(Math.max(0, p.chips))}</b>
        {showWin ? (
          <span className="win-add num">+{fmt(p.lastWin)} 獲得</span>
        ) : null}
      </div>
      <div id="yourCards">
        {p.hole.map(c => (
          <PlayingCard key={c.id} card={c} variant="big" anim hl={hl.has(c.id)} />
        ))}
      </div>
      <div id="yourHint" dangerouslySetInnerHTML={{ __html: youHintHTML(G) }} />
      <div className="you-dealer" dangerouslySetInnerHTML={{ __html: parts.join(" ／ ") }} />
    </div>
  );
}
