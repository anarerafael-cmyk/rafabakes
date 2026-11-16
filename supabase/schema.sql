-- rafa bakes: database setup
-- Paste this whole file into Supabase > SQL Editor > New query, then Run.

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents > 0),
  allergens text[] not null default '{}',
  image_url text,
  badge text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists drops (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'this week''s drop',
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  pickup_label text not null,            -- e.g. 'Sat, 9–11 AM'
  pickup_location text not null default '',
  pickup_slots text[] not null default '{}', -- e.g. {'Sat 9–10 AM','Sat 10–11 AM'}
  created_at timestamptz not null default now()
);

create table if not exists drop_items (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references drops(id) on delete cascade,
  product_id uuid not null references products(id),
  cap integer not null check (cap >= 0),
  sort integer not null default 0,
  unique (drop_id, product_id)
);

create sequence if not exists order_number_seq start 1001;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  drop_id uuid not null references drops(id),
  customer_name text not null,
  customer_phone text not null,
  pickup_slot text not null,
  payment_method text not null check (payment_method in ('card','venmo','zelle')),
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  total_cents integer not null,
  stripe_session_id text,
  wants_drop_texts boolean not null default false,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  drop_item_id uuid not null references drop_items(id),
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null
);

-- Lock everything down: the website talks to the database only from the
-- server with the secret key, so the public key can't read or change anything.
alter table products enable row level security;
alter table drops enable row level security;
alter table drop_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- How many of each drop item are already taken (pending or paid orders).
create or replace view drop_item_stock as
select di.id as drop_item_id,
       di.cap,
       coalesce(sum(oi.quantity) filter (where o.status <> 'cancelled'), 0)::int as sold
from drop_items di
left join order_items oi on oi.drop_item_id = di.id
left join orders o on o.id = oi.order_id
group by di.id, di.cap;

-- Places an order in one step so two people can't buy the last loaf at once.
-- p_items: [{"drop_item_id": "...", "quantity": 2}, ...]
create or replace function place_order(
  p_drop_id uuid,
  p_name text,
  p_phone text,
  p_slot text,
  p_method text,
  p_wants_texts boolean,
  p_items jsonb
) returns table (order_id uuid, order_code text, total_cents integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drop drops%rowtype;
  v_item jsonb;
  v_di record;
  v_sold integer;
  v_qty integer;
  v_total integer := 0;
  v_order_id uuid;
  v_code text;
begin
  select * into v_drop from drops where id = p_drop_id;
  if not found then raise exception 'DROP_NOT_FOUND'; end if;
  if now() < v_drop.opens_at or now() > v_drop.closes_at then
    raise exception 'DROP_CLOSED';
  end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_ORDER'; end if;

  v_code := 'RAFA-' || nextval('order_number_seq');
  insert into orders (code, drop_id, customer_name, customer_phone, pickup_slot,
                      payment_method, total_cents, wants_drop_texts)
  values (v_code, p_drop_id, p_name, p_phone, p_slot, p_method, 0, p_wants_texts)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty < 1 then raise exception 'BAD_QUANTITY'; end if;

    select di.id, di.cap, p.name, p.price_cents into v_di
    from drop_items di join products p on p.id = di.product_id
    where di.id = (v_item->>'drop_item_id')::uuid and di.drop_id = p_drop_id
    for update of di;
    if not found then raise exception 'ITEM_NOT_IN_DROP'; end if;

    select sold into v_sold from drop_item_stock where drop_item_id = v_di.id;
    if v_sold + v_qty > v_di.cap then
      raise exception 'SOLD_OUT:%', v_di.name;
    end if;

    insert into order_items (order_id, drop_item_id, product_name, quantity, unit_price_cents)
    values (v_order_id, v_di.id, v_di.name, v_qty, v_di.price_cents);
    v_total := v_total + v_qty * v_di.price_cents;
  end loop;

  update orders set total_cents = v_total where id = v_order_id;
  return query select v_order_id, v_code, v_total;
end;
$$;

-- Starter menu and a first drop. Change these any time.
insert into products (name, description, price_cents, allergens, image_url, badge)
values
  ('plain sourdough', 'Flour, water, salt, sourdough culture. Naturally fermented, no preservatives.', 800, '{wheat}', '/plain-sourdough.jpg', 'small batch'),
  ('chocolate chip walnut (6)', 'Half dozen per box.', 1200, '{wheat,milk,eggs,walnuts}', null, 'new')
on conflict do nothing;
