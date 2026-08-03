import { useEffect, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import {
  dismissToast,
  subscribeToasts,
  type ToastItem,
} from "../ui/toast";
import { renderIcon, type IconName } from "../ui/icons";

const TONE_ICON: Record<NonNullable<ToastItem["tone"]>, IconName> = {
  success: "check",
  error: "close",
  warning: "information",
  info: "information",
};

const TONE_LABEL: Record<NonNullable<ToastItem["tone"]>, string> = {
  success: "Éxito",
  error: "Error",
  warning: "Atención",
  info: "Información",
};

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToasts(setToasts);
  }, []);

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => {
        const tone = toast.tone ?? "info";
        const duration = toast.durationMs ?? 10_000;
        const iconHtml = toast.icon
          ? renderIcon(toast.icon, { size: 20 })
          : renderIcon(TONE_ICON[tone], { size: 20 });

        return (
          <div
            key={toast.id}
            className={`toast toast--${tone}`}
            role="status"
            style={{ "--toast-duration": `${duration}ms` } as CSSProperties}
          >
            {iconHtml ? (
              <span
                className="toast__badge"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: iconHtml }}
              />
            ) : null}
            <div className="toast__body">
              <div className="toast__tone-label">{TONE_LABEL[tone]}</div>
              <div className="toast__title">{toast.title}</div>
              {toast.message ? <div className="toast__message">{toast.message}</div> : null}
              {toast.actions && toast.actions.length > 0 ? (
                <div className="toast__actions">
                  {toast.actions.map((action, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`btn btn--sm ${action.primary ? "btn--primary" : "btn--secondary"}`}
                      onClick={() => {
                        action.onClick();
                        dismissToast(toast.id);
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="toast__close"
              aria-label="Cerrar notificación"
              onClick={() => dismissToast(toast.id)}
            >
              <X size={16} />
            </button>
            {duration > 0 ? (
              <span className="toast__progress" aria-hidden="true" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
