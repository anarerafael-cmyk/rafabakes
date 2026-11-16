-- Step 3 setup: run once in Supabase > SQL Editor.

-- Products you delete are hidden, not erased, so old orders still show their names.
alter table products add column if not exists archived boolean not null default false;

-- Public folder for product photos.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;
