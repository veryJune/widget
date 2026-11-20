// 시네마틱 모드에서만: 마우스를 움직이면 잠깐 나타나는 나가기 · 슬라이드쇼 버튼. 가만히 있으면 커서도 숨김
import { useEffect, useState } from 'react';
import { Play, X } from 'lucide-react';
import { useStore } from '../store';

export function CinemaHud() {
  const [visible, setVisible] = useState(true);
  const act = useStore.getState;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      setVisible(true);
      document.documentElement.classList.remove('cinema-idle');
      clearTimeout(timer);
      timer = setTimeout(() => {
        setVisible(false);
        document.documentElement.classList.add('cinema-idle');
      }, 2500);
    };
    show();
    window.addEventListener('mousemove', show);
    window.addEventListener('pointerdown', show);
    window.addEventListener('touchstart', show);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', show);
      window.removeEventListener('pointerdown', show);
      window.removeEventListener('touchstart', show);
      document.documentElement.classList.remove('cinema-idle');
    };
  }, []);

  return (
    <div className={`fixed right-4 top-4 z-[60] flex items-center gap-2 transition-opacity duration-300 ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`} role="toolbar" aria-label="시네마틱 모드">
      <button type="button" onClick={() => act().startSlideshow()} className="flex h-10 items-center gap-2 rounded-full bg-black/60 px-4 text-[13px] font-semibold text-white backdrop-blur-md transition hover:bg-black/80">
        <Play size={14} className="fill-white" /> 슬라이드쇼
      </button>
      <button type="button" aria-label="시네마틱 모드 나가기 (Esc)" title="나가기 (Esc)" onClick={() => act().setCinema(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/80">
        <X size={18} />
      </button>
    </div>
  );
}
