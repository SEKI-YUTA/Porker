import type { GameState } from "../lib/poker/types";
import { catKey, handJa, RANK_INFO, RANK_LABEL } from "../lib/poker/cards";
import { humanNow } from "../lib/poker/queries";
import PlayingCard from "./PlayingCard";

export default function RankPanel({ G, open }: { G: GameState; open?: boolean }) {
  const p = G.players[0];
  const h = humanNow(G);
  let nowHTML = "—";
  if (p.out) nowHTML = "—";
  else if (p.folded) nowHTML = `フォールド中<span class="sub">次のハンドをお待ちください</span>`;
  else if (!h) nowHTML = "—";
  else if (G.board.length === 0 && p.hole.length === 2) {
    nowHTML =
      p.hole[0].r === p.hole[1].r
        ? `ポケットペア（${RANK_LABEL(p.hole[0].r)}）<span class="sub">手札の時点でワンペアです</span>`
        : `ハイカード（${RANK_LABEL(h.score[1])}ハイ）<span class="sub">フロップで役が組みあがります</span>`;
  } else {
    nowHTML = `${handJa(h.score)}<span class="sub">自分の2枚＋場の${G.board.length}枚から最良の5枚</span>`;
  }
  const key = !p.out && !p.folded && h ? catKey(h.score) : null;

  return (
    <aside className={`side${open ? " open" : ""}`} id="rankPanel" aria-label="役の強さ一覧">
      <div className="side-head">
        <span className="dot" />
        役の強さ一覧
      </div>
      <div id="rankNowBox">
        <div className="cap">いまのあなたの役</div>
        <div id="rankNow" dangerouslySetInnerHTML={{ __html: nowHTML }} />
      </div>
      <div id="rankList">
        {RANK_INFO.map((r, i) => (
          <div key={r.key} className={`rankrow${r.key === key ? " now" : ""}`} data-key={r.key}>
            <div className="no">{i + 1}</div>
            <div className="nm">{r.name}</div>
            <div className="ex">
              {r.ex.map(c => (
                <PlayingCard key={c.id} card={c} variant="mini" />
              ))}
            </div>
            <div className="ds">{r.desc}</div>
          </div>
        ))}
      </div>
      <div className="suit-legend">
        ♠スペード ♣クラブ（黒）／<span className="rd">♥ハート ♦ダイヤ（赤）</span>
        <br />
        マークを「スート」と呼びます。A は 1 として 5-4-3-2-A のストレートにもなれます。
      </div>
    </aside>
  );
}
