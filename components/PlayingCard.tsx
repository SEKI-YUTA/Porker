import type { Card } from "../lib/poker/types";
import { RANK_LABEL, SUIT_CHAR } from "../lib/poker/cards";

interface Props {
  card?: Card;
  back?: boolean;
  variant?: "big" | "cpu" | "mini" | "";
  hl?: boolean;
  anim?: boolean;
}

export default function PlayingCard({ card, back, variant = "", hl, anim }: Props) {
  const cls = [
    "card",
    back ? "back" : "",
    !back && card && (card.s === "h" || card.s === "d") ? "red" : "",
    variant,
    anim ? "anim" : "",
    hl ? "hl" : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (back || !card) return <span className={cls} aria-hidden="true" />;
  return (
    <span className={cls} data-id={card.id}>
      <span className="rk">{RANK_LABEL(card.r)}</span>
      <span className="st">{SUIT_CHAR[card.s]}</span>
      <span className="mini-st">{SUIT_CHAR[card.s]}</span>
    </span>
  );
}
