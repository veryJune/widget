// 그리스 펜슬로 동그라미 친 듯한 손글씨 표시 — Steal Book의 유일한 장식 요소
import { useEffect, useRef, useState } from 'react';

/** 편집자가 OK컷에 동그라미 치듯: 즐겨찾기 표시 */
export function OkMark({ on, size = 22, className = '' }: { on: boolean; size?: number; className?: string }) {
  const [draw, setDraw] = useState(false);
  const prev = useRef(on);
  useEffect(() => {
    if (on && !prev.current) setDraw(true);
    prev.current = on;
    if (on) {
      const t = setTimeout(() => setDraw(false), 500);
      return () => clearTimeout(t);
    }
  }, [on]);
  if (!on) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={`scribble ${draw ? 'draw' : ''} ${className}`}>
      <path
        pathLength={1}
        d="M12.4 3.6C6.6 3.1 3.2 7.2 3.6 12.4c.5 5.4 4.9 8.4 9.6 7.9 5.2-.5 7.7-4.4 7.2-9-.4-4.3-3.9-7.3-9.6-6.2"
        stroke="var(--mark)"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.2" fill="var(--mark)" />
    </svg>
  );
}

export function Wordmark({ size = 20, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <span className="inline-flex items-baseline font-extrabold select-none" style={{ fontSize: size, letterSpacing: "-0.035em", lineHeight: 1, paddingLeft: "0.2em" }}>
      <span className="relative inline-block">
        Steal
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          aria-hidden
          className={`scribble pointer-events-none absolute ${animate ? 'draw' : ''}`}
          style={{ left: '-22%', top: '-50%', width: '146%', height: '200%', overflow: 'visible' }}
        >
          <path
            pathLength={1}
            d="M10 25C5 13 33 4 64 5c25 1 35 10 30 20-5 10-35 14-60 11C14 34 4 27 9 18c4-7 14-10 26-11"
            fill="none"
            stroke="var(--mark)"
            strokeWidth={2.4}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </span>
      <span className="ml-[0.34em]">Book</span>
    </span>
  );
}
