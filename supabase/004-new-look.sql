-- New look update: run once in Supabase > SQL Editor.

-- Pickup day for each drop (powers the calendar and countdown on the confirmation page).
alter table drops add column if not exists pickup_date date;
update drops
set pickup_date = ((closes_at at time zone 'America/Denver')::date + 2)
where pickup_date is null;

-- Reviews no longer need an order code. Reviews that come from an order page are still linked.
alter table reviews alter column order_id drop not null;

-- Recipes: what one batch of each bake makes, and its ingredients.
alter table products add column if not exists batch_yield integer not null default 1 check (batch_yield > 0);

create table if not exists recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  amount numeric not null check (amount >= 0),
  unit text not null default 'g' check (unit in ('g','ml','each')),
  sort integer not null default 0
);
alter table recipe_ingredients enable row level security;
