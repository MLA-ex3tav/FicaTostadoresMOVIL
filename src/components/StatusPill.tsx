export type PillVariant = "done" | "pending" | "progress" | "error" | "info";

interface StatusPillProps {
  label: string;
  variant?: PillVariant;
}

export function StatusPill({ label, variant = "pending" }: StatusPillProps) {
  return (
    <span className={`status-pill status-pill--${variant}`}>
      <span className="status-pill__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
