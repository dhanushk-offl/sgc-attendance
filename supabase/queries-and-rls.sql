-- Optimized helper functions and RLS policies for the MySGC schema.
-- Review in the Supabase SQL editor before applying in production.

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

create or replace function public.current_member_id()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from public.members as m
  where lower(trim(m.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  limit 1
$$;

create or replace function public.current_member_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.members as m
  where lower(trim(m.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  limit 1
$$;

create or replace function public.is_admin_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_member_role() in ('President', 'Vice President', 'Administrator', 'Session Incharge'),
    false
  )
$$;

create or replace function public.check_member_registration_status(p_email text)
returns table (
  member_exists boolean,
  is_registered boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    exists(
      select 1
      from public.members as m
      where lower(trim(m.email)) = lower(trim(coalesce(p_email, '')))
    ) as member_exists,
    coalesce(
      (
        select m.is_registered
        from public.members as m
        where lower(trim(m.email)) = lower(trim(coalesce(p_email, '')))
        limit 1
      ),
      false
    ) as is_registered
$$;

create or replace function public.get_member_attendance_summary(p_member_id integer)
returns table (
  month_key text,
  display_month text,
  total_working_days integer,
  present_days integer,
  absent_dates date[],
  percentage numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with working_days as (
    select distinct a.date
    from public.attendance as a
  ),
  member_presence as (
    select distinct a.date
    from public.attendance as a
    where a.member_id = p_member_id
      and a.is_present = true
  ),
  monthly_base as (
    select
      to_char(w.date, 'YYYY-MM') as month_key,
      date_trunc('month', w.date)::date as month_start,
      w.date,
      exists (
        select 1
        from member_presence as mp
        where mp.date = w.date
      ) as was_present
    from working_days as w
  )
  select
    mb.month_key,
    trim(to_char(mb.month_start, 'Month YYYY')) as display_month,
    count(*)::integer as total_working_days,
    count(*) filter (where mb.was_present)::integer as present_days,
    coalesce(array_agg(mb.date order by mb.date) filter (where not mb.was_present), '{}') as absent_dates,
    coalesce(
      round(
        (count(*) filter (where mb.was_present)::numeric / nullif(count(*), 0)) * 100,
        1
      ),
      0
    ) as percentage
  from monthly_base as mb
  group by mb.month_key, mb.month_start
  order by mb.month_key desc
$$;

create or replace function public.get_attendance_months()
returns table (
  month_key text,
  display_month text,
  total_working_days integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    to_char(date_trunc('month', a.date), 'YYYY-MM') as month_key,
    trim(to_char(date_trunc('month', a.date), 'Month YYYY')) as display_month,
    count(distinct a.date)::integer as total_working_days
  from public.attendance as a
  group by date_trunc('month', a.date)
  order by month_key desc
$$;

create or replace function public.get_monthly_attendance_report(p_month_key text)
returns table (
  member_id integer,
  member_name text,
  department text,
  role text,
  total_working_days integer,
  present_days integer,
  absent_dates date[],
  percentage numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with working_days as (
    select distinct a.date
    from public.attendance as a
    where to_char(a.date, 'YYYY-MM') = p_month_key
  ),
  member_presence as (
    select
      m.id as member_id,
      count(distinct a.date)::integer as present_days,
      coalesce(
        round(
          (
            count(distinct a.date)::numeric /
            nullif((select count(*) from working_days), 0)
          ) * 100,
          1
        ),
        0
      ) as percentage,
      coalesce(
        array(
          select wd.date
          from working_days as wd
          where not exists (
            select 1
            from public.attendance as a2
            where a2.member_id = m.id
              and a2.date = wd.date
              and a2.is_present = true
          )
          order by wd.date
        ),
        '{}'
      ) as absent_dates
    from public.members as m
    left join public.attendance as a
      on a.member_id = m.id
     and a.is_present = true
     and to_char(a.date, 'YYYY-MM') = p_month_key
    group by m.id
  )
  select
    m.id as member_id,
    m.name as member_name,
    m.department,
    m.role,
    (select count(*)::integer from working_days) as total_working_days,
    coalesce(mp.present_days, 0) as present_days,
    coalesce(mp.absent_dates, '{}') as absent_dates,
    coalesce(mp.percentage, 0) as percentage
  from public.members as m
  left join member_presence as mp
    on mp.member_id = m.id
  order by m.name asc
$$;

create or replace function public.find_member_attendance_by_identifier(
  p_search_type text,
  p_search_value text
)
returns table (
  member_id integer,
  member_name text,
  department text,
  role text,
  month_key text,
  display_month text,
  total_working_days integer,
  present_days integer,
  absent_dates date[],
  percentage numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with matched_member as (
    select m.id, m.name, m.department, m.role
    from public.members as m
    where (
      p_search_type = 'email'
      and lower(trim(m.email)) = lower(trim(coalesce(p_search_value, '')))
    ) or (
      p_search_type = 'mobile'
      and trim(coalesce(m.mobile, '')) = trim(coalesce(p_search_value, ''))
    )
    limit 1
  )
  select
    mm.id as member_id,
    mm.name as member_name,
    mm.department,
    mm.role,
    summary.month_key,
    summary.display_month,
    summary.total_working_days,
    summary.present_days,
    summary.absent_dates,
    summary.percentage
  from matched_member as mm
  left join lateral public.get_member_attendance_summary(mm.id) as summary on true
$$;

create or replace function public.record_attendance_for_date(
  p_date date,
  p_present_member_ids integer[] default '{}',
  p_mark_working_day boolean default true,
  p_absent_member_id integer default null
)
returns table (
  saved_present_count integer,
  working_day_recorded boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_present_member_ids integer[] := coalesce(
    array(
      select distinct unnest(coalesce(p_present_member_ids, '{}'))
    ),
    '{}'
  );
  v_fallback_member_id integer;
begin
  if not public.is_admin_member() then
    raise exception 'Only admin members can record attendance';
  end if;

  if p_date is null then
    raise exception 'Attendance date is required';
  end if;

  delete from public.attendance
  where date = p_date;

  if coalesce(array_length(v_present_member_ids, 1), 0) > 0 then
    insert into public.attendance (member_id, date, is_present)
    select member_id, p_date, true
    from unnest(v_present_member_ids) as member_id;

    return query
    select cardinality(v_present_member_ids), true;
    return;
  end if;

  if p_mark_working_day then
    v_fallback_member_id := p_absent_member_id;

    if v_fallback_member_id is null then
      select m.id
      into v_fallback_member_id
      from public.members as m
      order by m.id
      limit 1;
    end if;

    if v_fallback_member_id is null then
      raise exception 'Cannot record a working day without at least one member';
    end if;

    insert into public.attendance (member_id, date, is_present)
    values (v_fallback_member_id, p_date, false);

    return query
    select 0, true;
    return;
  end if;

  return query
  select 0, false;
end;
$$;

create or replace function public.get_session_feedback_summary()
returns table (
  session_id uuid,
  session_title text,
  session_date date,
  handler text,
  handler_id integer,
  feedback_count bigint,
  average_rating numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id as session_id,
    s.title as session_title,
    s.date as session_date,
    s.handler,
    s.handler_id,
    count(sf.id) as feedback_count,
    round(avg(sf.rating)::numeric, 1) as average_rating
  from public.sessions as s
  left join public.session_feedback as sf
    on sf.session_id = s.id
  where s.is_approved = true
  group by s.id, s.title, s.date, s.handler, s.handler_id
  order by s.date desc, s.title asc
$$;

with ranked_attendance as (
  select
    ctid,
    row_number() over (
      partition by member_id, date
      order by is_present desc, ctid desc
    ) as row_number_value
  from public.attendance
)
delete from public.attendance as a
using ranked_attendance as r
where a.ctid = r.ctid
  and r.row_number_value > 1;

create unique index if not exists attendance_member_date_unique_idx on public.attendance (member_id, date);
create index if not exists attendance_member_date_idx on public.attendance (member_id, date);
create index if not exists attendance_date_idx on public.attendance (date);
create index if not exists sessions_handler_date_idx on public.sessions (handler_id, date desc);
create index if not exists sessions_lookup_idx on public.sessions (title, handler, date);
create index if not exists session_feedback_session_created_idx on public.session_feedback (session_id, created_at desc);
create index if not exists session_feedback_member_date_idx on public.session_feedback (member_id, date desc);
create index if not exists session_interests_member_created_idx on public.session_interests (member_id, created_at desc);
create index if not exists notifications_member_created_idx on public.notifications (member_id, created_at desc);
create index if not exists push_subscriptions_member_idx on public.push_subscriptions (member_id);
create index if not exists feedback_status_created_idx on public.feedback (status, created_at desc);

grant execute on function public.check_member_registration_status(text) to anon, authenticated;
grant execute on function public.get_attendance_months() to authenticated;
grant execute on function public.get_monthly_attendance_report(text) to authenticated;
grant execute on function public.find_member_attendance_by_identifier(text, text) to anon, authenticated;
grant execute on function public.get_member_attendance_summary(integer) to authenticated;
grant execute on function public.record_attendance_for_date(date, integer[], boolean, integer) to authenticated;

alter table public.members enable row level security;
alter table public.attendance enable row level security;
alter table public.feedback enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.session_feedback enable row level security;
alter table public.session_interests enable row level security;
alter table public.sessions enable row level security;

drop policy if exists "members_select_self_or_admin" on public.members;
create policy "members_select_self_or_admin"
on public.members
for select
to authenticated
using (
  id = public.current_member_id()
  or public.is_admin_member()
);

drop policy if exists "members_admin_write" on public.members;
create policy "members_admin_write"
on public.members
for all
to authenticated
using (public.is_admin_member())
with check (public.is_admin_member());

drop policy if exists "attendance_select_self_or_admin" on public.attendance;
create policy "attendance_select_self_or_admin"
on public.attendance
for select
to authenticated
using (
  member_id = public.current_member_id()
  or public.is_admin_member()
);

drop policy if exists "attendance_admin_write" on public.attendance;
create policy "attendance_admin_write"
on public.attendance
for all
to authenticated
using (public.is_admin_member())
with check (public.is_admin_member());

drop policy if exists "feedback_admin_read" on public.feedback;
create policy "feedback_admin_read"
on public.feedback
for select
to authenticated
using (public.is_admin_member());

drop policy if exists "feedback_insert_authenticated" on public.feedback;
create policy "feedback_insert_authenticated"
on public.feedback
for insert
to authenticated
with check (true);

drop policy if exists "feedback_admin_update" on public.feedback;
create policy "feedback_admin_update"
on public.feedback
for update
to authenticated
using (public.is_admin_member())
with check (public.is_admin_member());

drop policy if exists "notifications_select_self_or_admin" on public.notifications;
create policy "notifications_select_self_or_admin"
on public.notifications
for select
to authenticated
using (
  member_id = public.current_member_id()
  or public.is_admin_member()
);

drop policy if exists "notifications_self_update_or_admin" on public.notifications;
create policy "notifications_self_update_or_admin"
on public.notifications
for update
to authenticated
using (
  member_id = public.current_member_id()
  or public.is_admin_member()
)
with check (
  member_id = public.current_member_id()
  or public.is_admin_member()
);

drop policy if exists "notifications_admin_insert" on public.notifications;
create policy "notifications_admin_insert"
on public.notifications
for insert
to authenticated
with check (public.is_admin_member());

drop policy if exists "push_subscriptions_self_or_admin_select" on public.push_subscriptions;
create policy "push_subscriptions_self_or_admin_select"
on public.push_subscriptions
for select
to authenticated
using (
  member_id = public.current_member_id()
  or public.is_admin_member()
);

drop policy if exists "push_subscriptions_self_insert_or_admin" on public.push_subscriptions;
create policy "push_subscriptions_self_insert_or_admin"
on public.push_subscriptions
for insert
to authenticated
with check (
  member_id = public.current_member_id()
  or public.is_admin_member()
);

drop policy if exists "push_subscriptions_self_delete_or_admin" on public.push_subscriptions;
create policy "push_subscriptions_self_delete_or_admin"
on public.push_subscriptions
for delete
to authenticated
using (
  member_id = public.current_member_id()
  or public.is_admin_member()
);

drop policy if exists "session_feedback_select_related_or_admin" on public.session_feedback;
create policy "session_feedback_select_related_or_admin"
on public.session_feedback
for select
to authenticated
using (
  member_id = public.current_member_id()
  or public.is_admin_member()
  or exists (
    select 1
    from public.sessions as s
    where s.id = session_feedback.session_id
      and s.handler_id = public.current_member_id()
  )
);

drop policy if exists "session_feedback_insert_self" on public.session_feedback;
create policy "session_feedback_insert_self"
on public.session_feedback
for insert
to authenticated
with check (
  member_id = public.current_member_id()
  or public.is_admin_member()
);

drop policy if exists "session_feedback_admin_delete" on public.session_feedback;
create policy "session_feedback_admin_delete"
on public.session_feedback
for delete
to authenticated
using (public.is_admin_member());

drop policy if exists "session_interests_select_self_or_admin" on public.session_interests;
create policy "session_interests_select_self_or_admin"
on public.session_interests
for select
to authenticated
using (
  member_id = public.current_member_id()
  or public.is_admin_member()
);

drop policy if exists "session_interests_insert_self" on public.session_interests;
create policy "session_interests_insert_self"
on public.session_interests
for insert
to authenticated
with check (
  member_id = public.current_member_id()
  or public.is_admin_member()
);

drop policy if exists "session_interests_admin_update" on public.session_interests;
create policy "session_interests_admin_update"
on public.session_interests
for update
to authenticated
using (public.is_admin_member())
with check (public.is_admin_member());

drop policy if exists "session_interests_admin_delete" on public.session_interests;
create policy "session_interests_admin_delete"
on public.session_interests
for delete
to authenticated
using (public.is_admin_member());

drop policy if exists "sessions_select_authenticated" on public.sessions;
create policy "sessions_select_authenticated"
on public.sessions
for select
to authenticated
using (true);

drop policy if exists "sessions_admin_write" on public.sessions;
create policy "sessions_admin_write"
on public.sessions
for all
to authenticated
using (public.is_admin_member())
with check (public.is_admin_member());
