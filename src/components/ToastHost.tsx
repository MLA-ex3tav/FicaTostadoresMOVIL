import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
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

const SWIPE_DISMISS_PX = 96;
const SWIPE_ACTIVATE_PX = 12;

function SwipeToast({ toast }: { toast: ToastItem }) {
  const tone = toast.tone ?? "info";
  const duration = toast.durationMs ?? 10_000;
  const iconHtml = toast.icon
    ? renderIcon(toast.icon, { size: 20 })
    : renderIcon(TONE_ICON[tone], { size: 20 });

  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const axisLocked = useRef<"x" | "y" | null>(null);
  const offsetRef = useRef(0);
  const [offsetX, setOffsetX] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [draggingUi, setDraggingUi] = useState(false);

  const finishDismiss = () => {
    setLeaving(true);
    window.setTimeout(() => dismissToast(toast.id), 180);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (leaving) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    dragging.current = true;
    axisLocked.current = null;
    startX.current = event.clientX;
    startY.current = event.clientY;
    offsetRef.current = 0;
    setDraggingUi(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || leaving) return;

    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;

    if (axisLocked.current === null) {
      if (Math.abs(dx) < SWIPE_ACTIVATE_PX && Math.abs(dy) < SWIPE_ACTIVATE_PX) {
        return;
      }

      axisLocked.current = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      if (axisLocked.current === "y") {
        dragging.current = false;
        setDraggingUi(false);
        setOffsetX(0);
        offsetRef.current = 0;
        return;
      }
    }

    if (axisLocked.current !== "x") return;

    // Solo deslizar a la izquierda
    const next = Math.min(0, dx);
    offsetRef.current = next;
    setOffsetX(next);
    event.preventDefault();
  };

  const onPointerUp = () => {
    if (!dragging.current && offsetRef.current === 0) {
      setDraggingUi(false);
      return;
    }

    dragging.current = false;
    setDraggingUi(false);

    if (offsetRef.current <= -SWIPE_DISMISS_PX) {
      setOffsetX(-Math.max(window.innerWidth, 360));
      finishDismiss();
      return;
    }

    offsetRef.current = 0;
    setOffsetX(0);
  };

  const opacity = leaving
    ? 0
    : Math.max(0.35, 1 + offsetX / (SWIPE_DISMISS_PX * 1.6));

  return (
    <div
      className={`toast toast--${tone}${draggingUi ? " toast--dragging" : ""}${leaving ? " toast--leaving" : ""}`}
      role="status"
      style={
        {
          "--toast-duration": `${duration}ms`,
          transform: `translateX(${offsetX}px)`,
          opacity,
        } as CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
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
        onClick={() => finishDismiss()}
      >
        <X size={16} />
      </button>
      {duration > 0 && !leaving ? (
        <span
          className="toast__progress"
          aria-hidden="true"
          onAnimationEnd={(event) => {
            if (event.animationName === "toast-progress") {
              finishDismiss();
            }
          }}
        />
      ) : null}
    </div>
  );
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToasts(setToasts);
  }, []);

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <SwipeToast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
