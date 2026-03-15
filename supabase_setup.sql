-- Create the products table
create table if not exists products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  price numeric not null,
  rating numeric,
  reviews numeric default 0,
  category text,
  image text,
  in_stock boolean default true,
  retailer_id uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Safely add the columns if the table already existed
alter table products add column if not exists in_stock boolean default true;
alter table products add column if not exists retailer_id uuid references auth.users(id);

-- Insert initial mockup data so the store isn't empty (only if table is empty)
insert into products (name, description, price, rating, reviews, category, image)
select 'Aura Smart Glasses 2.0', 'Next-gen AR glasses with integrated visual assistant.', 399.99, 4.8, 1245, 'Electronics', 'https://images.unsplash.com/photo-1572635196237-14b3f28150cc?auto=format&fit=crop&q=80&w=800'
where not exists (select 1 from products);

insert into products (name, description, price, rating, reviews, category, image)
select 'Neural Link Headphones', 'Brainwave-adapting noise cancellation.', 249.50, 4.9, 890, 'Audio', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800'
where not exists (select 1 from products where name = 'Neural Link Headphones');

insert into products (name, description, price, rating, reviews, category, image)
select 'Quantum Fitness Tracker', 'Tracks vitality metrics using miniature sensors.', 129.99, 4.6, 3102, 'Wearables', 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?auto=format&fit=crop&q=80&w=800'
where not exists (select 1 from products where name = 'Quantum Fitness Tracker');

-- Enable row level security
alter table products enable row level security;

-- Drop existing policies if they exist to allow re-runs
drop policy if exists "Products are viewable by everyone." on products;
drop policy if exists "Products are insertable by everyone." on products;
drop policy if exists "Retailers can insert their own products." on products;
drop policy if exists "Retailers can update their own products." on products;
drop policy if exists "Retailers can delete their own products." on products;

-- Create policies for the products table
create policy "Products are viewable by everyone." on products for select using (true);
create policy "Retailers can insert their own products." on products for insert with check (auth.uid() = retailer_id);
create policy "Retailers can update their own products." on products for update using (auth.uid() = retailer_id);
create policy "Retailers can delete their own products." on products for delete using (auth.uid() = retailer_id);

-- Create a storage bucket for product images named 'product-images'
insert into storage.buckets (id, name, public) 
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Enable public read/write access to the storage bucket
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Public Upload" on storage.objects;

create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'product-images' );

create policy "Public Upload"
on storage.objects for insert
with check ( bucket_id = 'product-images' );

-- Create a table for users to store roles
create table if not exists public.users (
  id uuid references auth.users not null primary key,
  role text default 'retailer' check (role in ('customer', 'retailer')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on users table
alter table public.users enable row level security;

drop policy if exists "Users can read own profile" on public.users;
drop policy if exists "Users can update own profile" on public.users;

-- Allow users to read their own profile
create policy "Users can read own profile" on public.users
  for select using (auth.uid() = id);

-- Allow users to update their own profile
create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- Trigger to create a user profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, role)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'role', 'customer')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if it exists to avoid errors on re-run
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
