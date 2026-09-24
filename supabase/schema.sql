create extension if not exists pgcrypto;

create table if not exists public.bookings (
  booking_id uuid primary key default gen_random_uuid(),
  cancel_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  customer_name text not null check (char_length(trim(customer_name)) between 1 and 120),
  phone text not null check (char_length(trim(phone)) between 1 and 40),
  service text not null check (char_length(trim(service)) between 1 and 1000),
  booking_date date not null,
  booking_time time without time zone not null,
  notes text not null default '' check (char_length(notes) <= 2000),
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_time_five_minutes
    check (
      mod(extract(minute from booking_time)::integer, 5) = 0
      and extract(second from booking_time) = 0
    )
);

-- Keep existing late appointments as history, but only allow new bookings through 19:00.
alter table public.bookings
  drop constraint if exists booking_time_business_hours;

alter table public.bookings
  add constraint booking_time_business_hours
  check (booking_time >= time '09:00' and booking_time <= time '19:00')
  not valid;

do $$
begin
  if not exists (
    select 1
    from public.bookings
    where booking_time < time '09:00' or booking_time > time '19:00'
  ) then
    alter table public.bookings validate constraint booking_time_business_hours;
  end if;
end;
$$;

create index if not exists bookings_slot_status_idx
  on public.bookings (booking_date, booking_time, status);

create index if not exists bookings_created_at_idx
  on public.bookings (created_at desc);

create unique index if not exists bookings_non_hour_unique_idx
  on public.bookings (booking_date, booking_time)
  where status <> 'cancelled' and extract(minute from booking_time) <> 0;

create or replace function public.set_booking_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_booking_updated_at_trigger on public.bookings;
create trigger set_booking_updated_at_trigger
before update on public.bookings
for each row execute function public.set_booking_updated_at();

create or replace function public.enforce_booking_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  max_bookings integer;
  current_booking_count integer;
  slot_key bigint;
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  slot_key := hashtextextended(
    new.booking_date::text || '|' || new.booking_time::text,
    0
  );
  perform pg_advisory_xact_lock(slot_key);

  if extract(minute from new.booking_time) = 0 then
    max_bookings := 3;
  else
    max_bookings := 1;
  end if;

  select count(*)
  into current_booking_count
  from public.bookings
  where booking_date = new.booking_date
    and booking_time = new.booking_time
    and status <> 'cancelled'
    and booking_id is distinct from new.booking_id;

  if current_booking_count >= max_bookings then
    raise exception using
      errcode = 'P0001',
      message = 'Khung giờ này đã đầy, vui lòng chọn giờ khác.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_booking_capacity_trigger on public.bookings;
create trigger enforce_booking_capacity_trigger
before insert or update of booking_date, booking_time, status
on public.bookings
for each row execute function public.enforce_booking_capacity();

alter table public.bookings enable row level security;
