-- =====================================================================
-- DÜNYA KUPASI AİLE TAHMİN OYUNU - VERİTABANI ŞEMASI
-- Supabase > SQL Editor > New query'e yapıştırıp RUN edin (bir kez).
-- =====================================================================

-- ---------- PROFILLER ----------
-- Her Google girişinde otomatik bir profil oluşur. Varsayılan: onaysız.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  approved    boolean not null default false,  -- aile üyesi mi? (sen onaylarsın)
  is_admin    boolean not null default false,  -- onay verebilen yönetici
  created_at  timestamptz not null default now()
);

-- ---------- MAÇLAR ----------
-- football-data.org'dan cron ile otomatik dolar/güncellenir.
create table if not exists public.matches (
  id          bigint primary key,              -- football-data.org maç id
  stage       text,                            -- GROUP_STAGE, LAST_16, QUARTER_FINALS...
  group_name  text,                            -- "Group D" vb (eleme turlarında boş)
  utc_date    timestamptz not null,            -- başlama saati (UTC) = tahmin kilidi
  status      text not null,                   -- TIMED, SCHEDULED, IN_PLAY, FINISHED...
  home_team   text,
  home_crest  text,
  away_team   text,
  away_crest  text,
  home_score  int,                             -- maç bitince dolar
  away_score  int,
  winner      text,                            -- HOME_TEAM / AWAY_TEAM / DRAW
  updated_at  timestamptz not null default now()
);

-- ---------- TAHMİNLER ----------
-- Sadece sunucu (service role) yazar; kilit kontrolü API route'unda yapılır.
create table if not exists public.predictions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  match_id    bigint not null references public.matches(id) on delete cascade,
  home_pred   int not null,
  away_pred   int not null,
  points      int,                             -- maç bitince cron hesaplar (null=henüz yok)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, match_id)
);

create index if not exists predictions_match_idx on public.predictions(match_id);
create index if not exists predictions_user_idx  on public.predictions(user_id);

-- =====================================================================
-- YENİ KULLANICI -> OTOMATİK PROFİL
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- YARDIMCI FONKSİYONLAR (RLS sonsuz döngüsünü önlemek için SECURITY DEFINER)
-- =====================================================================
create or replace function public.is_approved()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select approved from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles    enable row level security;
alter table public.matches     enable row level security;
alter table public.predictions enable row level security;

-- PROFILLER:
-- Kendini her zaman gör; onaylı isen (skor tablosu için) herkesi gör.
drop policy if exists "profiller okuma" on public.profiles;
create policy "profiller okuma" on public.profiles
  for select using ( id = auth.uid() or public.is_approved() );

-- Kendi profilinin ad/avatar'ını güncelleyebilirsin (approved/is_admin'e dokunamazsın;
-- onlar yalnızca service role ile değişir).
drop policy if exists "profil kendi guncelleme" on public.profiles;
create policy "profil kendi guncelleme" on public.profiles
  for update using ( id = auth.uid() ) with check ( id = auth.uid() );

-- MAÇLAR: sadece onaylı üyeler okur. Yazma yok (cron service role ile yazar, RLS'i baypas eder).
drop policy if exists "maclar okuma" on public.matches;
create policy "maclar okuma" on public.matches
  for select using ( public.is_approved() );

-- TAHMİNLER: herkes kendi tahminini okur. Maç başladıysa (kilit) herkesinkini okur.
drop policy if exists "tahmin okuma" on public.predictions;
create policy "tahmin okuma" on public.predictions
  for select using (
    public.is_approved() and (
      user_id = auth.uid()
      or exists (select 1 from public.matches m where m.id = match_id and m.utc_date <= now())
    )
  );
-- NOT: tahmin YAZMA politikası yok. Tüm yazmalar /api/predictions route'undan
-- service role ile yapılır; böylece "maç saati kilidi" baypas edilemez.

-- =====================================================================
-- SKOR TABLOSU (her zaman güncel) - güvenli bir view
-- =====================================================================
create or replace view public.standings
with (security_invoker = true) as
  select
    p.id            as user_id,
    p.full_name,
    p.avatar_url,
    coalesce(sum(pr.points), 0)                          as total_points,
    count(pr.points)                                     as scored_count,
    count(*) filter (where pr.points = 5)                as exact_count,
    count(pr.id)                                         as predictions_count
  from public.profiles p
  left join public.predictions pr on pr.user_id = p.id
  where p.approved = true
  group by p.id, p.full_name, p.avatar_url
  order by total_points desc, exact_count desc;
