create table if not exists public.users (
  open_id text primary key,
  remaining_count integer not null default 10
    check (remaining_count >= 0),
  membership_type text not null default 'none'
    check (membership_type in ('none', 'month', 'quarter', 'year')),
  membership_expiry timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  order_no text primary key,
  open_id text not null references public.users(open_id) on delete restrict,
  plan_type text not null
    check (plan_type in ('month', 'quarter', 'year')),
  amount integer not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists orders_open_id_idx
  on public.orders(open_id);

create index if not exists orders_status_idx
  on public.orders(status);

alter table public.users enable row level security;
alter table public.orders enable row level security;

create or replace function public.check_user_quota(p_open_id text)
returns table(can_answer boolean, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user public.users%rowtype;
begin
  if p_open_id is null or btrim(p_open_id) = '' then
    raise exception 'INVALID_OPEN_ID';
  end if;

  insert into public.users (open_id)
  values (btrim(p_open_id))
  on conflict (open_id) do nothing;

  select *
  into current_user
  from public.users
  where open_id = btrim(p_open_id);

  return query
  select
    (
      current_user.membership_type <> 'none'
      and current_user.membership_expiry > now()
    )
    or current_user.remaining_count > 0,
    current_user.remaining_count;
end;
$$;

create or replace function public.deduct_user_quota(p_open_id text)
returns table(success boolean, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user public.users%rowtype;
begin
  if p_open_id is null or btrim(p_open_id) = '' then
    raise exception 'INVALID_OPEN_ID';
  end if;

  insert into public.users (open_id)
  values (btrim(p_open_id))
  on conflict (open_id) do nothing;

  select *
  into current_user
  from public.users
  where open_id = btrim(p_open_id)
  for update;

  if (
    current_user.membership_type <> 'none'
    and current_user.membership_expiry > now()
  ) then
    return query select true, current_user.remaining_count;
    return;
  end if;

  if current_user.remaining_count <= 0 then
    return query select false, 0;
    return;
  end if;

  update public.users
  set
    remaining_count = remaining_count - 1,
    updated_at = now()
  where open_id = current_user.open_id
  returning remaining_count into current_user.remaining_count;

  return query select true, current_user.remaining_count;
end;
$$;

create or replace function public.create_membership_order(
  p_order_no text,
  p_open_id text,
  p_plan_type text,
  p_amount integer
)
returns table(order_no text, amount integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_amount integer;
begin
  if p_order_no is null or btrim(p_order_no) = '' then
    raise exception 'INVALID_ORDER_NO';
  end if;

  if p_open_id is null or btrim(p_open_id) = '' then
    raise exception 'INVALID_OPEN_ID';
  end if;

  expected_amount := case p_plan_type
    when 'month' then 990
    when 'quarter' then 2990
    when 'year' then 9900
    else null
  end;

  if expected_amount is null or p_amount <> expected_amount then
    raise exception 'INVALID_PLAN_OR_AMOUNT';
  end if;

  insert into public.users (open_id)
  values (btrim(p_open_id))
  on conflict (open_id) do nothing;

  insert into public.orders (
    order_no,
    open_id,
    plan_type,
    amount,
    status
  )
  values (
    btrim(p_order_no),
    btrim(p_open_id),
    p_plan_type,
    p_amount,
    'pending'
  );

  return query select btrim(p_order_no), p_amount;
end;
$$;

create or replace function public.complete_membership_order(p_order_no text)
returns table(
  order_no text,
  status text,
  membership_type text,
  membership_expiry timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.orders%rowtype;
  current_user public.users%rowtype;
  base_expiry timestamptz;
  new_expiry timestamptz;
begin
  select *
  into current_order
  from public.orders
  where orders.order_no = btrim(p_order_no)
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  select *
  into current_user
  from public.users
  where open_id = current_order.open_id
  for update;

  if current_order.status = 'paid' then
    return query
    select
      current_order.order_no,
      current_order.status,
      current_user.membership_type,
      current_user.membership_expiry;
    return;
  end if;

  base_expiry := case
    when current_user.membership_expiry > now()
      then current_user.membership_expiry
    else now()
  end;

  new_expiry := base_expiry + case current_order.plan_type
    when 'month' then interval '30 days'
    when 'quarter' then interval '90 days'
    when 'year' then interval '365 days'
  end;

  update public.orders
  set
    status = 'paid',
    paid_at = now()
  where orders.order_no = current_order.order_no;

  update public.users
  set
    membership_type = current_order.plan_type,
    membership_expiry = new_expiry,
    updated_at = now()
  where open_id = current_order.open_id;

  return query
  select
    current_order.order_no,
    'paid'::text,
    current_order.plan_type,
    new_expiry;
end;
$$;

revoke all on function public.check_user_quota(text) from public;
revoke all on function public.deduct_user_quota(text) from public;
revoke all on function public.create_membership_order(text, text, text, integer)
  from public;
revoke all on function public.complete_membership_order(text) from public;

grant execute on function public.check_user_quota(text) to anon;
grant execute on function public.deduct_user_quota(text) to anon;
grant execute on function public.create_membership_order(text, text, text, integer)
  to anon;
grant execute on function public.complete_membership_order(text) to anon;
