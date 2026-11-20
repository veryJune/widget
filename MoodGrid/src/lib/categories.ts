// 카드 분류: 이미지 · 영상 · 메모 · 링크 · 임베드 (필터와 내려받기에서 사용, 화면과 무관한 순수 함수)
import type { Item } from '../types';
import { isVideoEmbed } from './providers';
import { parseVideo } from './video';

export type Category = 'image' | 'video' | 'text' | 'link' | 'embed';

export const CATEGORIES: Category[] = ['image', 'video', 'text', 'link', 'embed'];

export const CATEGORY_LABEL: Record<Category, string> = {
  image: '이미지',
  video: '영상',
  text: '메모',
  link: '링크',
  embed: '임베드',
};

/**
 *  image: 올린 이미지 · 캡처한 장면
 *  video: YouTube / Vimeo / 영상 파일 주소 · Loom / Dailymotion / Streamable / Wistia / TikTok 같은 영상 임베드
 *  text:  메모 카드
 *  link:  일반 링크
 *  embed: 그 밖의 재생/미리보기 카드 (Spotify · SoundCloud · Instagram · X · Pinterest · Figma · Behance · Google Drive · 모르는 사이트의 플레이어)
 *  구분선(섹션)은 분류가 없음(null)
 */
export function categoryOf(it: Item): Category | null {
  if (it.type === 'divider') return null;
  if (it.type === 'image') return 'image';
  if (it.type === 'text') return 'text';
  if (parseVideo(it.content)) return 'video';
  if (it.embed) return isVideoEmbed(it.embed) ? 'video' : 'embed';
  return 'link';
}

export function countByCategory(items: Item[]): Record<Category, number> {
  const out: Record<Category, number> = { image: 0, video: 0, text: 0, link: 0, embed: 0 };
  for (const it of items) {
    if (it.deleted_at) continue;
    const c = categoryOf(it);
    if (c) out[c]++;
  }
  return out;
}
