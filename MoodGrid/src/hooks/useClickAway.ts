import { useEffect, type RefObject } from 'react';

/** ref 바깥을 누르거나 Esc 를 누르면 onAway 호출 */
export function useClickAway(ref: RefObject<HTMLElement | null>, onAway: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onAway();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onAway();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key);
    };
  }, [ref, onAway, active]);
}
