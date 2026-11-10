// 화면 밝기: 어둡게(편집실) · 밝게(라이트 테이블) · 자동(기기 설정 따라가기)
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useStore } from '../store';

export type ThemePref = 'dark' | 'light' | 'system';
const THEME_COLOR = { dark: '#1e1e1e', light: '#f3f3f1' };

const media = () => window.matchMedia?.('(prefers-color-scheme: light)');
export const resolveTheme = (t: ThemePref): 'dark' | 'light' => (t === 'system' ? (media()?.matches ? 'light' : 'dark') : t);

/** 실제로 쓰이는 밝기 (자동이면 기기 설정을 따라 바뀜) */
export function useResolvedTheme() {
  const theme = useStore((s) => s.theme);
  const [, bump] = useState(0);
  useEffect(() => {
    if (theme !== 'system') return;
    const m = media();
    const on = () => bump((n) => n + 1);
    m?.addEventListener('change', on);
    return () => m?.removeEventListener('change', on);
  }, [theme]);
  return resolveTheme(theme);
}

/** 문서에 밝기를 적용 (App 에서 한 번) */
export function useApplyTheme() {
  const resolved = useResolvedTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved]);
  }, [resolved]);
}

const LABEL: Record<ThemePref, [string, string]> = {
  dark: ['어둡게', '편집실'],
  light: ['밝게', '라이트 테이블'],
  system: ['자동', '기기 설정'],
};

/** 세 갈래 고르기 (설정 · 휴대폰 메뉴) */
export function ThemePicker({ long = false }: { long?: boolean }) {
  const { theme, setPref } = useStore();
  return (
    <div className="flex gap-1 rounded-lg bg-bg p-1" role="group" aria-label="화면 밝기">
      {(['dark', 'light', 'system'] as const).map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={theme === t}
          onClick={() => setPref('theme', t)}
          className={`flex-1 whitespace-nowrap rounded-md px-2.5 font-semibold transition ${long ? 'h-9 text-[14px]' : 'h-8 text-[13px]'} ${theme === t ? 'bg-raise text-ink shadow-sm' : 'text-mute hover:text-ink'}`}
        >
          {LABEL[t][0]}
          {long && <span className="ml-1 font-normal text-faint">({LABEL[t][1]})</span>}
        </button>
      ))}
    </div>
  );
}

/** 해·달 버튼: 누를 때마다 밝게 ↔ 어둡게 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const setPref = useStore((s) => s.setPref);
  const resolved = useResolvedTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => setPref('theme', next)}
      aria-label={next === 'light' ? '밝은 화면으로' : '어두운 화면으로'}
      title={next === 'light' ? '밝은 화면으로 (L)' : '어두운 화면으로 (L)'}
      className={`rounded-lg p-2 text-mute transition hover:bg-panel hover:text-ink ${className}`}
    >
      {resolved === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
