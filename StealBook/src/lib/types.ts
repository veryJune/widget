// Steal Book 데이터 모양. supabase/schema.sql 의 컬럼과 이름을 맞춰 두었습니다.

export type ItemType = 'note' | 'image' | 'video' | 'link' | 'embed' | 'file';
export type ItemStatus = 'new' | 'incubating' | 'used';

/** 올린 파일 하나. path·thumb·strip 은 저장소 경로입니다. */
export interface MediaFile {
  path: string;
  kind: 'image' | 'video' | 'file';
  mime: string;
  name: string;
  size: number;
  w?: number;
  h?: number;
  duration?: number;
  thumb?: string;
  thumbSize?: number;
  /** 영상 훑어보기용: 프레임을 가로로 이어 붙인 이미지 */
  strip?: string;
  stripSize?: number;
  stripFrames?: number;
  /** 대표 색 */
  colors?: string[];
}

export interface EmbedInfo {
  provider: 'youtube' | 'vimeo' | 'instagram' | 'tiktok' | 'x' | 'spotify' | 'iframe';
  embedUrl: string;
  /** 가로/세로 */
  aspect: number;
  /** 고정 높이(px)가 필요한 플레이어 (예: 스포티파이) */
  fixedHeight?: number;
  thumb?: string;
  /** 시작 시각 파라미터를 붙일 수 있는지 */
  seekable?: boolean;
}

export interface LinkMeta {
  title?: string;
  description?: string;
  image?: string;
  site?: string;
  favicon?: string;
}

export interface Marker {
  id: string;
  start: number;
  end?: number;
  note?: string;
}

export interface Item {
  id: string;
  category_id: string | null;
  type: ItemType;
  title: string;
  body: string;
  url: string;
  why: string;
  tags: string[];
  media: MediaFile[];
  embed: EmbedInfo | null;
  link: LinkMeta | null;
  cover: string | null;
  ratio: number | null;
  colors: string[];
  favorite: boolean;
  status: ItemStatus;
  markers: Marker[];
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  /** 상위 카테고리 (없으면 맨 위) */
  parent_id: string | null;
  name: string;
  color: string;
  icon: string;
  sort: number;
  created_at: string;
}

export type Scope =
  | { kind: 'all' }
  | { kind: 'inbox' }
  | { kind: 'fav' }
  | { kind: 'cat'; id: string };

export type ViewMode = 'masonry' | 'grid' | 'list';
export type SortMode = 'new' | 'old' | 'title' | 'shuffle';
export type AspectBucket = 'tall' | 'portrait' | 'square' | 'wide' | 'scope';
