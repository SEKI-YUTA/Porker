import type { GameState } from "../lib/poker/types";

export default function LogPanel({ G, open }: { G: GameState; open?: boolean }) {
  return (
    <aside className={`side${open ? " open" : ""}`} id="logPanel" aria-label="アクション履歴">
      <div className="side-head">
        <span className="dot" />
        アクション履歴
      </div>
      <ul id="logList">
        {G.logs.map(e => (
          <li key={e.id} className={e.cls} dangerouslySetInnerHTML={{ __html: e.html }} />
        ))}
      </ul>
    </aside>
  );
}
