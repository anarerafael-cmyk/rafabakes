-- Opens a drop with both starter bakes. Edit the dates, times, location and caps,
-- then run it in Supabase > SQL Editor. (The menu screen in step 3 replaces this.)
with d as (
  insert into drops (opens_at, closes_at, pickup_label, pickup_location, pickup_slots)
  values (
    '2026-11-16 19:00 America/Denver',
    '2026-11-19 20:00 America/Denver',
    'Sat, 9–11 AM',
    '[YOUR PICKUP SPOT]',
    '{"Sat 9–10 AM","Sat 10–11 AM"}'
  )
  returning id
)
insert into drop_items (drop_id, product_id, cap, sort)
select d.id, p.id,
       case when p.name = 'plain sourdough' then 16 else 10 end,
       case when p.name = 'plain sourdough' then 0 else 1 end
from d, products p
where p.active;
