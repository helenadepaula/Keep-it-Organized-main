-- Keep it Organized database setup

-- Tables

-- Note categories
create table if not exists categories (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  color      text not null default 'blue',
  created_at timestamptz default now()
);

-- Folders (organize notes)
create table if not exists folders (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  color      text not null default 'blue',
  created_at timestamptz default now()
);

-- Notes (can be in multiple folders)
create table if not exists notes (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  content     text default '',
  category_id uuid references categories(id) on delete set null,
  folder_ids  uuid[] default '{}',
  deadline    date,
  deleted_at  timestamptz,       -- null = active, not null = in trash
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- User preferences (category order)
create table if not exists user_settings (
  user_id   uuid references auth.users(id) on delete cascade primary key,
  cat_order uuid[] default '{}'
);

-- Row Level Security (users can only see their own data)

alter table categories   enable row level security;
alter table folders      enable row level security;
alter table notes        enable row level security;
alter table user_settings enable row level security;

create policy "Users access own categories"
  on categories for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users access own folders"
  on folders for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users access own notes"
  on notes for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users access own settings"
  on user_settings for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);