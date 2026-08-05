import { useRef, useState, type ReactNode } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";

const MAX = 56;
const THRESHOLD = 48;

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const busyRef = useRef(false);
  const [distance, setDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const inModal = (target: EventTarget | null): boolean =>
    target instanceof Element && target.closest(".modal") !== null;

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (busyRef.current || inModal(e.target)) return;
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startY.current === null || busyRef.current || inModal(e.target)) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) return;
    const next = Math.min(delta * 0.45, MAX);
    if (Math.abs(next - pullRef.current) < 1) return;
    pullRef.current = next;
    setDistance(next);
  };

  const finish = () => {
    if (startY.current === null) return;
    startY.current = null;

    if (pullRef.current >= THRESHOLD && !busyRef.current) {
      busyRef.current = true;
      setIsRefreshing(true);
      setDistance(MAX);
      void onRefresh().finally(() => {
        busyRef.current = false;
        setIsRefreshing(false);
        pullRef.current = 0;
        setDistance(0);
      });
    } else {
      pullRef.current = 0;
      setDistance(0);
    }
  };

  return (
    <div
      className="ptr"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={finish}
      onTouchCancel={finish}
    >
      <div
        className="ptr__indicator"
        style={{ height: isRefreshing ? MAX : Math.min(distance, MAX) }}
      >
        {isRefreshing ? (
          <RefreshCw size={20} className="spin" />
        ) : (
          <ChevronDown
            size={20}
            style={{ transform: `rotate(${(Math.min(distance, MAX) / MAX) * 180}deg)` }}
          />
        )}
      </div>
      {children}
    </div>
  );
}
