import type { ReactNode } from "react";

type Tone = "accent" | "success" | "warning" | "info" | "neutral";

interface StatCardProps {
  label: string;
  value: string;
  tone?: Tone;
  hint?: string;
}

export function StatCard({ label, value, tone = "neutral", hint }: StatCardProps) {
  return (
    <article className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className={`stat-card__value${tone !== "neutral" ? ` stat-card__value--${tone}` : ""}`}>
        {value}
      </div>
      {hint ? <div className="stat-card__hint">{hint}</div> : null}
    </article>
  );
}

export function StatsGrid({ children }: { children: ReactNode }) {
  return <div className="stats-grid">{children}</div>;
}
