export type PillVariant = "done" | "pending" | "progress" | "error" | "info";

interface StatusPillProps {
  label: string;
  variant?: PillVariant;
  className?: string;
}

export function StatusPill({ label, variant = "pending", className = "" }: StatusPillProps) {
  return (
    <span className={`status-pill status-pill--${variant} ${className}`.trim()}>
      <span className="status-pill__dot" aria-hidden="true" />
      <span className="status-pill__label">{label}</span>
    </span>
  );
}

