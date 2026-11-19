// 첫 화면이 깜빡이지 않도록 저장된 테마를 먼저 적용 (CSP 때문에 별도 파일)
try {
  var p = JSON.parse(localStorage.getItem('moodgrid.prefs.v1') || '{}');
  var t = p.theme === 'system' || !p.theme ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : p.theme;
  document.documentElement.dataset.theme = t;
} catch (e) {}
