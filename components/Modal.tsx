import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  lock?: boolean;
  onClose?: () => void;
}

export default function Modal({ children, lock, onClose }: Props) {
  return (
    <div
      className="modal-root"
      role="dialog"
      aria-modal="true"
      onClick={e => {
        if (e.target === e.currentTarget && !lock) onClose?.();
      }}
    >
      <div className="modal-card">{children}</div>
    </div>
  );
}
