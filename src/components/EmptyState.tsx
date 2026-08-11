import type { ReactNode } from "react";
import { Info } from "lucide-react";

interface EmptyStateProps {
  title: string;
  text?: string;
  children?: ReactNode;
}

export function EmptyState({ title, text, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        <Info size={26} />
      </div>
      <h2 className="empty-state__title">{title}</h2>
      {text ? <p className="empty-state__text">{text}</p> : null}
      {children}
    </div>
  );
}
