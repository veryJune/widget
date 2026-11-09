// 휴대폰 '뒤로가기'(또는 브라우저 뒤로 버튼)로 맨 위에 열린 창을 닫습니다.
//
// 방식: 창이 하나라도 열려 있는 동안 방문 기록에 '표시용 칸' 하나를 둡니다.
// - 뒤로가기 → 그 칸이 빠지면서 가장 마지막에 열린 창 하나만 닫고, 아직 열린 창이 있으면 칸을 다시 둡니다.
// - 화면의 닫기 버튼으로 전부 닫히면 그 칸을 조용히 걷어 냅니다.
// 기록을 넣고 빼는 일은 한 박자 늦춰 한꺼번에 처리해서, 창이 바뀌는 순간(메뉴 → 선택 모드 등)
// 기록이 꼬여 앱 밖으로 나가 버리는 문제를 막습니다.
import { useEffect, useRef } from 'react';

type Entry = { close: () => void };
const stack: Entry[] = [];
let pendingBack = false;
let timer = 0;

const onGuard = () => (history.state as { stealbook?: number } | null)?.stealbook === 1;

function sync() {
  if (timer) return;
  timer = window.setTimeout(() => {
    timer = 0;
    if (pendingBack) return; // 걷어 내는 중 → 끝나면 다시 맞춤
    if (stack.length && !onGuard()) history.pushState({ stealbook: 1 }, '');
    else if (!stack.length && onGuard()) {
      pendingBack = true;
      history.back();
    }
  }, 0);
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (pendingBack) {
      pendingBack = false;
      sync();
      return;
    }
    if (onGuard()) {
      // 앞으로 가기로 표시용 칸에 들어온 경우
      sync();
      return;
    }
    stack.pop()?.close();
    sync();
  });
}

export function useBackClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const entry: Entry = { close: () => closeRef.current() };
    stack.push(entry);
    sync();
    return () => {
      const i = stack.indexOf(entry);
      if (i !== -1) stack.splice(i, 1);
      sync();
    };
  }, [open]);
}
