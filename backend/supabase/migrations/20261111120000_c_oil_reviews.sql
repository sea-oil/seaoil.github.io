-- C-OIL private owner moderation & publicly readable approved reviews.
-- Run once in a Supabase project you control. Keep original project policies isolated.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.review_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
revoke all on private.review_admins from anon, authenticated;

create table if not exists public.reviews (
 id uuid primary key default gen_random_uuid(),
 display_name text not null default 'Anonymous customer' check (char_length(display_name) between 1 and 60),
 rating smallint not null check (rating between 1 and 5),
 comment text not null check (char_length(btrim(comment)) between 10 and 1200),
 status text not null default 'pending' check (status in ('pending','approved','hidden','rejected')),
 created_at timestamptz not null default now(),
 published_at timestamptz,
 constraint publication_requires_approval check (published_at is null or status='approved')
);
create index if not exists reviews_public_feed_idx on public.reviews(created_at desc) where status='approved';
create index if not exists reviews_admin_queue_idx on public.reviews(status,created_at desc);
alter table public.reviews enable row level security;

-- No direct visitor writes: anonymous submissions go through captcha-checked Edge Function.
revoke all on public.reviews from public, anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant update,delete on public.reviews to authenticated;
grant all on public.reviews to service_role;

-- RLS helper verifies that the current Auth user was expressly appointed by owner.
create or replace function public.is_review_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from private.review_admins a where a.user_id = (select auth.uid())); $$;
revoke all on function public.is_review_admin() from public, anon;
grant execute on function public.is_review_admin() to authenticated;

-- Idempotent deployment: replace policies with strict definitions.
drop policy if exists "Reviews: anyone reads approved" on public.reviews;
create policy "Reviews: anyone reads approved" on public.reviews for select to anon, authenticated
using (status = 'approved');
drop policy if exists "Reviews: admins read all" on public.reviews;
create policy "Reviews: admins read all" on public.reviews for select to authenticated
using (public.is_review_admin());
drop policy if exists "Reviews: admins update" on public.reviews;
create policy "Reviews: admins update" on public.reviews for update to authenticated
using (public.is_review_admin()) with check (public.is_review_admin());
drop policy if exists "Reviews: admins delete" on public.reviews;
create policy "Reviews: admins delete" on public.reviews for delete to authenticated
using (public.is_review_admin());

-- Prevent reviewers or even admin UI from silently changing the original comment/rating.
-- An admin can only change status/publication time; no silent rewriting of testimony.
create or replace function public.guard_review_modification() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 if (old.display_name,old.rating,old.comment,old.created_at) is distinct from
    (new.display_name,new.rating,new.comment,new.created_at) then
   raise exception 'Review content is immutable';
 end if;
 return new;
end; $$;
drop trigger if exists review_immutable_content on public.reviews;
create trigger review_immutable_content before update on public.reviews
for each row execute function public.guard_review_modification();

-- Atomic abuse throttling for public review submissions (hashed remote IP, rolling 1 hour).
create table if not exists private.review_rate_limits (
 visitor_hash text primary key,
 window_started timestamptz not null default now(),
 attempts integer not null default 0
);
revoke all on private.review_rate_limits from anon, authenticated;
create or replace function public.consume_review_rate_limit(visitor text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare allowed boolean;
begin
 if visitor is null or length(visitor) <> 64 then return false; end if;
 insert into private.review_rate_limits(visitor_hash,window_started,attempts)
 values(visitor,now(),1)
 on conflict(visitor_hash) do update set
 attempts=case when private.review_rate_limits.window_started < now()-interval '1 hour' then 1 else private.review_rate_limits.attempts+1 end,
 window_started=case when private.review_rate_limits.window_started < now()-interval '1 hour' then now() else private.review_rate_limits.window_started end
 returning attempts<=5 into allowed;
 return allowed;
end; $$;
revoke all on function public.consume_review_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_review_rate_limit(text) to service_role;

-- Function/table in private schema cannot be accessed from the public Data API.
-- One-time setup: create a user in Supabase > Authentication > Users, then run:
-- insert into private.review_admins(user_id) values ('YOUR_AUTH_USER_UUID');
