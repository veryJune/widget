-- MoodGrid — Supabase 데이터베이스 설정
-- StealBook 과 같은 Supabase 프로젝트에 추가합니다. StealBook 의 표(categories · items · collections)는 건드리지 않고
-- 이름이 mg_ 로 시작하는 표와 'moodgrid' 저장소만 새로 만듭니다. 여러 번 실행해도 안전합니다.
-- 가입 차단(stealbook_single_owner 트리거)은 프로젝트 전체에 이미 걸려 있어 그대로 적용됩니다.

-- 1) 프로젝트(보드) ----------------------------------------------------------
create table if not exists public.mg_projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null default '새 프로젝트',
  cols        integer not null default 5 check (cols between 2 and 8),     -- 한 줄 열 수
  gap         integer not null default 24 check (gap between 0 and 64),     -- 카드 간격(px)
  sort_mode   text not null default 'manual',                               -- manual | newest | oldest | rating | color
  item_count  integer not null default 0,                                   -- 목록 화면용 (앱이 갱신)
  covers      text[] not null default '{}',                                 -- 목록 화면 모자이크용 썸네일 경로(최대 4)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz                                                   -- 휴지통 (30일 뒤 앱이 영구 삭제)
);

-- 2) 보드 위의 항목 -----------------------------------------------------------
create table if not exists public.mg_items (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.mg_projects(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type        text not null check (type in ('image', 'text', 'bookmark', 'divider')),
  content     text not null default '',      -- 메모 글 / 링크 주소 / 섹션 이름
  title       text not null default '',      -- 링크 제목
  path        text,                          -- 저장소의 원본(보기용) 파일 경로
  thumb       text,                          -- 저장소의 썸네일 경로
  w           integer,
  h           integer,
  color       text not null default 'white', -- 메모 카드 색
  note        text not null default '',      -- 카드에 붙인 메모
  rating      smallint not null default 0 check (rating between 0 and 3),
  pinned      boolean not null default false,
  collapsed   boolean not null default false, -- 섹션(구분선) 접힘
  pos         double precision not null default 0, -- 순서 (소수라서 하나만 옮겨도 한 행만 수정)
  colors      text[] not null default '{}',  -- 대표 색 (색 정렬용)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists mg_projects_user_idx on public.mg_projects (user_id, updated_at desc);
create index if not exists mg_items_project_pos_idx on public.mg_items (project_id, pos);
create index if not exists mg_items_user_idx on public.mg_items (user_id);

-- 수정 시각 자동 갱신
create or replace function public.mg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists mg_projects_touch on public.mg_projects;
create trigger mg_projects_touch before update on public.mg_projects
  for each row execute function public.mg_touch_updated_at();

drop trigger if exists mg_items_touch on public.mg_items;
create trigger mg_items_touch before update on public.mg_items
  for each row execute function public.mg_touch_updated_at();

-- 3) 보안 규칙(RLS): 로그인한 본인 데이터만 ------------------------------------
alter table public.mg_projects enable row level security;
alter table public.mg_items enable row level security;

drop policy if exists "mg own projects" on public.mg_projects;
create policy "mg own projects" on public.mg_projects
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 항목은 내 소유이면서, 내 프로젝트 안에만 넣을 수 있음
drop policy if exists "mg own items" on public.mg_items;
create policy "mg own items" on public.mg_items
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.mg_projects p where p.id = project_id and p.user_id = auth.uid())
  );

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.mg_projects, public.mg_items to authenticated;

-- 4) 파일 저장소: 비공개 버킷 'moodgrid' (그림 파일만, 파일 하나 최대 20MB) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('moodgrid', 'moodgrid', false, 20971520,
        array['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/avif'])
on conflict (id) do update
  set public = false, file_size_limit = 20971520,
      allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/avif'];

-- 경로 규칙: {사용자ID}/{프로젝트ID}/{파일}. 첫 폴더가 내 ID 인 파일만 다룰 수 있음
drop policy if exists "moodgrid files read" on storage.objects;
create policy "moodgrid files read" on storage.objects
  for select to authenticated
  using (bucket_id = 'moodgrid' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "moodgrid files insert" on storage.objects;
create policy "moodgrid files insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'moodgrid' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "moodgrid files update" on storage.objects;
create policy "moodgrid files update" on storage.objects
  for update to authenticated
  using (bucket_id = 'moodgrid' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "moodgrid files delete" on storage.objects;
create policy "moodgrid files delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'moodgrid' and (storage.foldername(name))[1] = auth.uid()::text);
