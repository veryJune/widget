// 색으로 찾기: 항목의 대표 색을 12가지 색 계열로 나눕니다.

export interface ColorFamily {
  id: string;
  label: string;
  hex: string;
}

export const FAMILIES: ColorFamily[] = [
  { id: 'red', label: '빨강', hex: '#D4473F' },
  { id: 'orange', label: '주황', hex: '#E58A3C' },
  { id: 'yellow', label: '노랑', hex: '#E3C443' },
  { id: 'green', label: '초록', hex: '#5DA55A' },
  { id: 'teal', label: '청록', hex: '#3A9C97' },
  { id: 'blue', label: '파랑', hex: '#3F70CF' },
  { id: 'purple', label: '보라', hex: '#8459C6' },
  { id: 'pink', label: '분홍', hex: '#DB6FA4' },
  { id: 'brown', label: '갈색', hex: '#8B5E3F' },
  { id: 'black', label: '검정', hex: '#141414' },
  { id: 'gray', label: '회색', hex: '#8A8A8A' },
  { id: 'white', label: '흰색', hex: '#F0F0F0' },
];

function hsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

export function familyOf(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return 'gray';
  const [h, s, l] = hsl(hex);
  if (l < 0.13) return 'black';
  if (l > 0.9) return 'white';
  if (s < 0.16) return l < 0.25 ? 'black' : l > 0.8 ? 'white' : 'gray';
  if (h >= 15 && h < 45 && l < 0.42) return 'brown';
  if (h < 12 || h >= 345) return 'red';
  if (h < 42) return 'orange';
  if (h < 68) return 'yellow';
  if (h < 160) return 'green';
  if (h < 195) return 'teal';
  if (h < 255) return 'blue';
  if (h < 290) return 'purple';
  return 'pink';
}

/** 앞쪽(많이 쓰인) 색 3개의 계열 */
export function familiesOf(colors: string[]): Set<string> {
  return new Set(colors.slice(0, 3).map(familyOf));
}

/** 카테고리 색 견본 */
export const CATEGORY_COLORS = ['#E0A43B', '#C9C27B', '#6FB38A', '#4FA3A5', '#5B8DEF', '#8E7CE8', '#D07BC1', '#E4707A', '#A0A0A0', '#E8E8E8'];
