// 색 도구: 대표 색 비교 · 보드 팔레트 만들기 (화면과 무관한 순수 함수)
import type { Item } from '../types';

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexToHsl(hex: string): [number, number, number] {
  const rgb = hexToRgb(hex);
  if (!rgb) return [0, 0, 0.5];
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function dist(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** 이 거리(RGB) 안이면 '같은 색'으로 봄 */
export const COLOR_MATCH = 64;

export function itemMatchesColor(item: Item, hex: string): boolean {
  const target = hexToRgb(hex);
  if (!target) return false;
  return item.colors.some((c) => {
    const rgb = hexToRgb(c);
    return !!rgb && dist(rgb, target) <= COLOR_MATCH;
  });
}

/**
 * 보드 전체의 대표 색 팔레트 (최대 n개). 각 이미지의 대표 색을 순위별로 가중해(1순위가 가장 큼)
 * 비슷한 색끼리 묶고, 많이 쓰인 순으로 고른 뒤 색조 → 밝기 순으로 보기 좋게 정렬
 */
export function buildPalette(items: Item[], n = 10): string[] {
  const weighted: { hex: string; rgb: [number, number, number]; w: number }[] = [];
  for (const it of items) {
    if (it.deleted_at || it.type === 'divider') continue;
    it.colors.forEach((hex, idx) => {
      const rgb = hexToRgb(hex);
      if (rgb) weighted.push({ hex, rgb, w: Math.max(1, 5 - idx) });
    });
  }
  weighted.sort((a, b) => b.w - a.w);
  const clusters: { hex: string; rgb: [number, number, number]; w: number }[] = [];
  for (const c of weighted) {
    const near = clusters.find((k) => dist(k.rgb, c.rgb) < 48);
    if (near) near.w += c.w;
    else clusters.push({ ...c });
  }
  const top = clusters.sort((a, b) => b.w - a.w).slice(0, n);
  return top
    .map((c) => c.hex)
    .sort((a, b) => {
      const [ha, sa, la] = hexToHsl(a);
      const [hb, sb, lb] = hexToHsl(b);
      const ga = sa < 0.12 ? 1000 + (1 - la) : Math.floor(ha / 20) * 10 + (1 - la);
      const gb = sb < 0.12 ? 1000 + (1 - lb) : Math.floor(hb / 20) * 10 + (1 - lb);
      return ga - gb;
    });
}
