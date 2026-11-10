// Steal Book 데이터 모양. supabase/schema.sql 의 컬럼과 이름을 맞춰 두었습니다.

export type ItemType = 'note' | 'image' | 'video' | 'link' | 'embed' | 'file' | 'page';
export type ItemStatus = 'new' | 'incubating' | 'used';

/** 올린 파일 하나. path·thumb·strip 은 저장소 경로입니다. */
export interface MediaFile {
  path: string;
  /** page = 올린 HTML 파일 (항목 안에 웹페이지로 띄움) */
  kind: 'image' | 'video' | 'file' | 'page';
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
  /** 이 사이트를 다른 사이트 안(iframe)에 띄워도 되는지. false 면 페이지로 띄우지 않고 링크 카드로 보여 줌 */
  frameable?: boolean;
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
  /** 휴지통에 넣은 시각 (없으면 정상 항목) */
  deleted_at?: string | null;
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

/** 스마트 컬렉션 조건 (저장된 검색·필터) */
export interface Criteria {
  categoryId?: string | null;
  inbox?: boolean;
  favorite?: boolean;
  query?: string;
  type?: ItemType | null;
  aspect?: AspectBucket | null;
  color?: string | null;
  tag?: string | null;
}

export interface Collection {
  id: string;
  name: string;
  icon: string;
  criteria: Criteria;
  sort: number;
  created_at: string;
}

export type Scope =
  | { kind: 'all' }
  | { kind: 'inbox' }
  | { kind: 'fav' }
  | { kind: 'cat'; id: string }
  | { kind: 'smart'; id: string }
  | { kind: 'trash' };

export type ViewMode = 'masonry' | 'grid' | 'list';
export type SortMode = 'new' | 'old' | 'title' | 'shuffle';
export type AspectBucket = 'tall' | 'portrait' | 'square' | 'wide' | 'scope';
