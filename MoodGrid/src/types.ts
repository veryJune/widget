export type ItemType = 'image' | 'text' | 'bookmark' | 'divider';
export type TextColor = 'white' | 'yellow' | 'blue' | 'green' | 'dark';
export type SortMode = 'manual' | 'newest' | 'oldest' | 'rating' | 'color';
export type Rating = 0 | 1 | 2 | 3;

export interface Project {
  id: string;
  title: string;
  cols: number; // 한 줄 열 수 (2~8)
  gap: number; // 카드 간격 px (0~64)
  sort_mode: SortMode;
  item_count: number;
  covers: string[]; // 목록 모자이크용 썸네일 경로(최대 4)
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Item {
  id: string;
  project_id: string;
  type: ItemType;
  content: string; // 메모 글 / 링크 주소 / 섹션 이름
  title: string; // 링크 제목
  path: string | null; // 원본(보기용) 파일 경로
  thumb: string | null; // 썸네일 경로
  w: number | null;
  h: number | null;
  color: TextColor;
  note: string;
  rating: Rating;
  pinned: boolean;
  collapsed: boolean;
  pos: number;
  colors: string[];
  /** 안에서 재생할 플레이어(iframe) 주소 — 링크 카드(bookmark)에만. https 만 */
  embed: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const SORT_LABEL: Record<SortMode, string> = {
  manual: '직접 정렬',
  newest: '최신순',
  oldest: '오래된순',
  rating: '별점순',
  color: '색상순',
};

export const TEXT_COLORS: TextColor[] = ['white', 'yellow', 'blue', 'green', 'dark'];
