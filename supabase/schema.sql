-- I ♥ ENG — Supabase schema (Phase 1 + columns for Phase 2)
-- Supabase 대시보드 → SQL Editor → New query → 이 파일 전체 붙여넣기 → Run

-- ========== 프로필 ==========
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default 'friend',
  avatar_url text,
  motto text default '',
  token_style jsonb default '{}'::jsonb,
  onboarded boolean default false,
  created_at timestamptz default now()
);

-- 가입하면 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'nickname', 'friend'));
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure public.handle_new_user();

-- ========== 하루 기록 ==========
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  title text default '',
  video_url text default '',
  start_at text default '',
  script text default '',
  notes text default '',
  completed boolean default false,
  reviews int default 0 check (reviews between 0 and 3),
  starred boolean default false,
  recording_path text,
  recording_public boolean default false,
  recording_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date)
);
create index if not exists entries_date_idx on public.entries(date);

-- ========== 보물상자 ==========
create table if not exists public.treasures (
  user_id uuid not null references public.profiles(id) on delete cascade,
  milestone int not null,
  opened_at date not null default current_date,
  primary key (user_id, milestone)
);

-- ========== 라운지 메시지 ==========
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null default 'chat' check (kind in ('chat','system','photo','sticker','recap')),
  text text default '',
  image_path text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists messages_created_idx on public.messages(created_at desc);

-- ========== 반응 ==========
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('message','entry')),
  target_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique (target_type, target_id, user_id, emoji)
);

-- ========== 콕 찌르기 ==========
create table if not exists public.pokes (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  created_at timestamptz default now(),
  unique (from_user, to_user, date)
);

-- ========== RLS (로그인한 멤버끼리는 서로 보이고, 수정은 본인 것만) ==========
alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.treasures enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;
alter table public.pokes enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id);

drop policy if exists "entries read" on public.entries;
create policy "entries read" on public.entries for select to authenticated using (true);
drop policy if exists "entries write own" on public.entries;
create policy "entries write own" on public.entries for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "treasures read" on public.treasures;
create policy "treasures read" on public.treasures for select to authenticated using (true);
drop policy if exists "treasures write own" on public.treasures;
create policy "treasures write own" on public.treasures for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "messages read" on public.messages;
create policy "messages read" on public.messages for select to authenticated using (true);
drop policy if exists "messages insert own" on public.messages;
create policy "messages insert own" on public.messages for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "messages delete own" on public.messages;
create policy "messages delete own" on public.messages for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "reactions read" on public.reactions;
create policy "reactions read" on public.reactions for select to authenticated using (true);
drop policy if exists "reactions write own" on public.reactions;
create policy "reactions write own" on public.reactions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "pokes read" on public.pokes;
create policy "pokes read" on public.pokes for select to authenticated using (true);
drop policy if exists "pokes insert own" on public.pokes;
create policy "pokes insert own" on public.pokes for insert to authenticated with check (auth.uid() = from_user);

-- ========== 실시간 (라운지 채팅) ==========
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.entries;
exception when duplicate_object then null; end $$;

-- ========== 스토리지 버킷 ==========
insert into storage.buckets (id, name, public) values ('avatars','avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('photos','photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('recordings','recordings', false) on conflict (id) do nothing;

-- avatars: 누구나 보기, 본인 폴더(uid/...)에만 업로드
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatars own write" on storage.objects;
create policy "avatars own write" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars own update" on storage.objects;
create policy "avatars own update" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars own delete" on storage.objects;
create policy "avatars own delete" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- photos (라운지 사진): 멤버 누구나 보기, 본인 폴더에만 업로드
drop policy if exists "photos read" on storage.objects;
create policy "photos read" on storage.objects for select using (bucket_id = 'photos');
drop policy if exists "photos own write" on storage.objects;
create policy "photos own write" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos own delete" on storage.objects;
create policy "photos own delete" on storage.objects for delete to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- recordings: 본인 것 + 공개로 설정된 것만 듣기, 본인 폴더에만 업로드
drop policy if exists "recordings read" on storage.objects;
create policy "recordings read" on storage.objects for select to authenticated using (
  bucket_id = 'recordings' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.entries e where e.recording_path = name and e.recording_public = true)
  )
);
drop policy if exists "recordings own write" on storage.objects;
create policy "recordings own write" on storage.objects for insert to authenticated with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "recordings own update" on storage.objects;
create policy "recordings own update" on storage.objects for update to authenticated using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "recordings own delete" on storage.objects;
create policy "recordings own delete" on storage.objects for delete to authenticated using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
