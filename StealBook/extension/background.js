// Steal Book — 훔치기 (크롬 확장)
// 오른쪽 클릭 메뉴로 담을 것을 골라 Steal Book 작은 창을 엽니다.
// 실제 저장은 Steal Book 웹앱이 합니다 → 확장에는 로그인 정보가 없고, 웹앱 로그인을 그대로 씁니다.

const APP = 'https://steal-book.vercel.app/';

const MENUS = [
  { id: 'image', title: '이미지 담기 (메모 달기)', contexts: ['image'] },
  { id: 'image-quick', title: '이미지 바로 담기', contexts: ['image'] },
  { id: 'link', title: '링크 담기 (메모 달기)', contexts: ['link'] },
  { id: 'link-quick', title: '링크 바로 담기', contexts: ['link'] },
  { id: 'selection', title: '선택한 글 담기', contexts: ['selection'] },
  { id: 'page', title: '이 페이지 담기', contexts: ['page', 'frame', 'video', 'audio'] },
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'root', title: 'Steal Book에 훔치기', contexts: ['image', 'link', 'selection', 'page', 'frame', 'video', 'audio'] });
    for (const m of MENUS) chrome.contextMenus.create({ ...m, parentId: 'root' });
  });
});

/** Steal Book 작은 창 열기 (지금 창 오른쪽에 붙여서) */
async function openSteal(params) {
  const url = APP + '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  let left;
  let top;
  try {
    const cur = await chrome.windows.getLastFocused();
    if (cur && cur.left != null && cur.width) {
      left = Math.max(0, cur.left + cur.width - 500);
      top = (cur.top || 0) + 70;
    }
  } catch (e) {
    /* 위치는 크롬에 맡김 */
  }
  try {
    await chrome.windows.create({ url, type: 'popup', width: 460, height: 760, left, top, focused: true });
  } catch (e) {
    // 화면 밖으로 계산된 경우 등 → 위치·크기를 크롬에 맡기고 다시
    await chrome.windows.create({ url, type: 'popup', focused: true });
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const id = String(info.menuItemId);
  const quick = id.endsWith('-quick');
  const base = { steal: quick ? 'quick' : 'compose', t: tab && tab.title };
  if (id.startsWith('image')) openSteal({ ...base, i: info.srcUrl, u: info.pageUrl });
  else if (id.startsWith('link')) openSteal({ ...base, u: info.linkUrl, t: '' });
  else if (id === 'selection') openSteal({ ...base, s: info.selectionText, u: info.pageUrl });
  else openSteal({ ...base, u: info.pageUrl });
});

// 도구 막대 버튼 · 단축키 → 지금 페이지
function stealTab(tab) {
  if (!tab || !/^https?:/.test(tab.url || '')) return;
  openSteal({ steal: 'compose', u: tab.url, t: tab.title });
}
chrome.action.onClicked.addListener(stealTab);
chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'steal-page') return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  stealTab(tab);
});

// 웹앱이 다 담으면 주소 끝에 #stealbook-done 을 붙입니다 → 그 창을 닫기
// (확장이 연 작은 창만 닫습니다)
chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  const url = change.url || '';
  if (!url.startsWith(APP) || !url.includes('#stealbook-done')) return;
  try {
    const win = await chrome.windows.get(tab.windowId);
    if (win.type === 'popup') await chrome.windows.remove(tab.windowId);
  } catch (e) {
    /* 이미 닫힘 */
  }
});
