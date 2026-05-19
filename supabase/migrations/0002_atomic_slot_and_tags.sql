-- =====================================================================
-- 0002 — Atomic slot reservation, specialization tags, payment status
-- =====================================================================

-- ---------- provider specialization tags (from positive review sentiment) ----------
alter table providers
  add column if not exists specialization_tags text[] not null default '{}';

-- ---------- payment status on bookings ----------
do $$ begin
  create type payment_status as enum ('unpaid','authorized','captured','failed','refunded');
exception when duplicate_object then null; end $$;

alter table bookings
  add column if not exists payment_status payment_status not null default 'unpaid';

alter table bookings
  add column if not exists payment_attempts int not null default 0;

-- ---------- atomic slot reservation ----------
-- Returns either {status:'confirmed', booking_id} or {status:'conflict', overlapping_booking_id}.
-- pg_advisory_xact_lock serializes concurrent attempts on the same provider so the
-- overlap check + insert form one logical transaction. Two simultaneous requests
-- will see one win and the other receive 'conflict'.
create or replace function reserve_slot(
  p_provider_id uuid,
  p_profile_id  uuid,
  p_service     service_type,
  p_complexity  complexity,
  p_urgency     urgency_level,
  p_request_text text,
  p_parsed_intent jsonb,
  p_location_raw text,
  p_location_lat double precision,
  p_location_lng double precision,
  p_scheduled_start timestamptz,
  p_scheduled_end   timestamptz,
  p_buffer_min int,
  p_price_breakdown jsonb,
  p_total_price int,
  p_notification_log jsonb
) returns jsonb
language plpgsql as $$
declare
  v_overlap uuid;
  v_booking_id uuid;
  v_buffer interval := make_interval(mins := p_buffer_min);
begin
  -- serialize per-provider
  perform pg_advisory_xact_lock(hashtext(p_provider_id::text));

  -- overlap check including buffer on both sides
  select id into v_overlap
    from bookings
   where provider_id = p_provider_id
     and status in ('confirmed','en_route','in_progress')
     and tstzrange(scheduled_start - v_buffer, scheduled_end + v_buffer, '[]')
         && tstzrange(p_scheduled_start, p_scheduled_end, '[]')
   limit 1;

  if v_overlap is not null then
    return jsonb_build_object('status','conflict','overlapping_booking_id', v_overlap);
  end if;

  insert into bookings (
    profile_id, provider_id, service, complexity_hint, urgency,
    request_text, parsed_intent, location_raw, location_lat, location_lng,
    scheduled_start, scheduled_end, status, price_breakdown, total_price,
    notification_log
  ) values (
    p_profile_id, p_provider_id, p_service, p_complexity, p_urgency,
    p_request_text, p_parsed_intent, p_location_raw, p_location_lat, p_location_lng,
    p_scheduled_start, p_scheduled_end, 'confirmed', p_price_breakdown, p_total_price,
    coalesce(p_notification_log, '[]'::jsonb)
  ) returning id into v_booking_id;

  -- bump provider's jobs_today
  update providers set jobs_today = jobs_today + 1 where id = p_provider_id;

  return jsonb_build_object('status','confirmed','booking_id', v_booking_id);
end $$;

-- ---------- helper: insert a waitlist row ----------
create or replace function add_to_waitlist(
  p_profile_id uuid,
  p_service service_type,
  p_area text,
  p_requested_after timestamptz,
  p_requested_before timestamptz,
  p_parsed_intent jsonb
) returns uuid
language sql as $$
  insert into waitlist (profile_id, service, area, requested_after, requested_before, parsed_intent, status)
  values (p_profile_id, p_service, p_area, p_requested_after, p_requested_before, p_parsed_intent, 'waiting')
  returning id;
$$;
