import { useCallback, useRef } from "react";

const CLOSE_THRESHOLD = 96;
const MAX_PULL = 140;
const RESISTANCE = 0.5;
const EXIT_MS = 260;

interface UseSheetDragOptions {
  enabled?: boolean;
}

/**
 * Permite cerrar un bottom sheet deslizándolo hacia abajo. El panel sigue el
 * dedo (con resistencia), el backdrop se atenúa mientras se arrastra y al
 * soltar se cierra si se superó el umbral o vuelve a su lugar si no.
 *
 * Al cerrar (arrastre, backdrop o botón X vía requestClose) se reproduce una
 * animación de salida: el panel se desliza hacia abajo y el backdrop se
 * desvanece antes de notificar al padre para desmontar.
 *
 * Usa listeners nativos no-pasivos para poder llamar preventDefault()
 * (los handlers sintéticos de React en touchmove son pasivos y no lo permiten).
 * El callback ref enlaza los listeners cuando el panel se monta, aunque el
 * sheet se abra/cierre de forma condicional.
 */
export function useSheetDrag(
  onDismiss: () => void,
  { enabled = true }: UseSheetDragOptions = {},
) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const nodeRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  const resetPanel = () => {
    const panel = nodeRef.current;
    const backdrop = backdropRef.current;
    if (panel) panel.style.transform = "";
    if (backdrop) backdrop.style.opacity = "";
  };

  const animateOut = useCallback(() => {
    if (closingRef.current || !nodeRef.current) return;
    closingRef.current = true;

    const panel = nodeRef.current;
    const backdrop = backdropRef.current;
    panel.style.transition = `transform ${EXIT_MS}ms cubic-bezier(0.32, 0.72, 0.35, 1)`;
    panel.style.transform = "translateY(115%)";
    if (backdrop) {
      backdrop.style.transition = `opacity ${EXIT_MS}ms ease`;
      backdrop.style.opacity = "0";
    }

    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      closingRef.current = false;
      onDismissRef.current();
    }, EXIT_MS);
  }, []);

  /** Cierra el sheet con la animación de salida (backdrop, botón X, etc.). */
  const requestClose = useCallback(() => {
    animateOut();
  }, [animateOut]);

  const panelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      nodeRef.current = node;
      if (!node) return;

    const panel = node;
    const sheet = panel.parentElement as HTMLElement | null;
    backdropRef.current =
      sheet?.querySelector<HTMLElement>(
        ".more-sheet__backdrop, .picker-sheet__backdrop",
      ) ?? null;

    // Mientras el sheet está abierto se bloquea el scroll de la página de fondo.
    document.body.style.overflow = "hidden";

      let startY: number | null = null;
      let startX: number | null = null;
      let pull = 0;

      const inScrolledElement = (target: EventTarget | null): boolean => {
        let el = target instanceof Element ? target : null;
        while (el && el !== panel) {
          const style = getComputedStyle(el);
          if (/(auto|scroll|overlay)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) {
            // Es un contenedor con scroll: se deja desplazar sin arrastrar el sheet.
            return true;
          }
          el = el.parentElement;
        }
        return false;
      };

      const applyPull = (dy: number) => {
        const clamped = Math.min(dy * RESISTANCE, MAX_PULL);
        panel.style.transform = `translateY(${clamped}px)`;
        if (backdropRef.current) {
          backdropRef.current.style.opacity = String(
            Math.max(0, 1 - (clamped / CLOSE_THRESHOLD) * 0.55),
          );
        }
      };

      const onTouchStart = (e: TouchEvent) => {
        if (!enabledRef.current || closingRef.current) return;
        if (inScrolledElement(e.target)) return;
        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
        pull = 0;
      };

      const onTouchMove = (e: TouchEvent) => {
        if (startY === null || closingRef.current) return;
        const dy = e.touches[0].clientY - startY;
        const dx = e.touches[0].clientX - (startX as number);
        if (dy <= 0) {
          // El dedo va hacia arriba dentro del panel: se cancela el gesto de cierre.
          startY = null;
          resetPanel();
          return;
        }
        if (Math.abs(dx) > Math.abs(dy)) return; // swipe horizontal: ignorar.
        e.preventDefault();
        panel.style.transition = "none";
        pull = dy;
        applyPull(dy);
      };

      const onTouchEnd = () => {
        if (startY === null) return;
        startY = null;
        startX = null;
        if (pull >= CLOSE_THRESHOLD) {
          // Ya viene baja por el arrastre: completar la salida deslizando el resto.
          animateOut();
        } else {
          panel.style.transition = "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)";
          resetPanel();
          window.setTimeout(() => {
            panel.style.transition = "";
          }, 300);
        }
        pull = 0;
      };

      panel.addEventListener("touchstart", onTouchStart, { passive: true });
      panel.addEventListener("touchmove", onTouchMove, { passive: false });
      panel.addEventListener("touchend", onTouchEnd);
      panel.addEventListener("touchcancel", onTouchEnd);

      cleanupRef.current = () => {
        panel.removeEventListener("touchstart", onTouchStart);
        panel.removeEventListener("touchmove", onTouchMove);
        panel.removeEventListener("touchend", onTouchEnd);
        panel.removeEventListener("touchcancel", onTouchEnd);
        if (exitTimerRef.current !== null) {
          window.clearTimeout(exitTimerRef.current);
          exitTimerRef.current = null;
        }
        closingRef.current = false;
        nodeRef.current = null;
        backdropRef.current = null;
        panel.style.transform = "";
        document.body.style.overflow = "";
      };
    },
    [animateOut],
  );

  return { panelRef, requestClose };
}
