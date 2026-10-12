import type { GameState } from "../lib/poker/types";
import { STAGES, STAGE_JA, STAGE_SUB } from "../lib/poker/cards";

export default function Stepper({ G }: { G: GameState }) {
  const cur = STAGES.indexOf(G.stage as (typeof STAGES)[number]);
  return (
    <ol className="stepper" aria-label="ゲームの進行ステップ">
      {STAGES.map((st, i) => {
        const cls = i < cur ? "step done" : i === cur ? "step active" : "step";
        return (
          <li key={st} className={cls}>
            <span className="n">{i < cur ? "✓" : i + 1}</span>
            <span className="lb">
              {STAGE_JA[st]}
              <span className="sub">{STAGE_SUB[st]}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
