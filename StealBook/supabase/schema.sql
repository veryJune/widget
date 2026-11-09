-- Steal Book — Supabase 데이터베이스 설정
-- Supabase 대시보드 → SQL Editor → New query 에 이 파일 내용을 통째로 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전하도록 작성했습니다.

-- 1) 카테고리 --------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null default '#A0A0A0',
  icon        text not null default '',
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

-- 2) 담은 항목(게시글) ------------------------------------------------------
create table if not exists public.items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id  uuid references public.categories(id) on delete set null,  -- 카테고리를 지우면 인박스로
  type         text not null default 'note',      -- note | image | video | link | embed | file
  title        text not null default '',
  body         text not null default '',
  url          text not null default '',          -- 출처 / 링크 주소
  why          text not null default '',          -- 왜 담았나 한 줄
  tags         text[] not null default '{}',
  media        jsonb not null default '[]',       -- 올린 파일 목록 (원본·썸네일·스크럽 스트립 경로)
  embed        jsonb,                             -- 유튜브·인스타 등 임베드 정보
  link         jsonb,                             -- 링크 미리보기 정보
  cover        text,                              -- 카드에 보일 이미지 (저장소 경로 또는 외부 주소)
  ratio        real,                              -- 카드 비율 (가로/세로)
  colors       text[] not null default '{}',      -- 대표 색
  favorite     boolean not null default false,
  status       text not null default 'new',       -- new | incubating | used (다음 단계용)
  markers      jsonb not null default '[]',       -- 영상 구간 북마크
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists items_user_created_idx on public.items (user_id, created_at desc);
create index if not exists categories_user_sort_idx on public.categories (user_id, sort);

-- 수정 시각 자동 갱신
create or replace function public.stealbook_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists items_touch_updated_at on public.items;
create trigger items_touch_updated_at
  before update on public.items
  for each row execute function public.stealbook_touch_updated_at();

-- 3) 보안 규칙(RLS): 로그인한 본인 데이터만 읽고 쓸 수 있음 ------------------
alter table public.categories enable row level security;
alter table public.items enable row level security;

drop policy if exists "own categories" on public.categories;
create policy "own categories" on public.categories
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own items" on public.items;
create policy "own items" on public.items
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 4) 실시간 동기화: 다른 기기에서 바꾼 내용이 바로 반영되도록 --------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'items') then
    alter publication supabase_realtime add table public.items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'categories') then
    alter publication supabase_realtime add table public.categories;
  end if;
end $$;

-- 5) 파일 저장소: 비공개 버킷 'media' (파일 하나 최대 50MB) -----------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

-- 파일 경로의 첫 폴더가 내 사용자 ID인 파일만 다룰 수 있음:  {user_id}/{item_id}/파일
drop policy if exists "stealbook media read" on storage.objects;
create policy "stealbook media read" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "stealbook media insert" on storage.objects;
create policy "stealbook media insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "stealbook media update" on storage.objects;
create policy "stealbook media update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "stealbook media delete" on storage.objects;
create policy "stealbook media delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- 6) 주인 한 명만: 첫 계정이 만들어진 뒤에는 새 가입을 데이터베이스에서 막습니다 -----------
--    (대시보드의 'Allow new users to sign up'을 꺼 두는 것과 같은 효과를 SQL로 보장)
create or replace function public.stealbook_single_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'Steal Book은 한 사람만 쓰는 앱입니다. 새 가입은 막혀 있습니다.';
  end if;
  return new;
end $$;

drop trigger if exists stealbook_single_owner on auth.users;
create trigger stealbook_single_owner
  before insert on auth.users
  for each row execute function public.stealbook_single_owner();
