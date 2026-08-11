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
alter table products add column if not exists status text default 'approved' check (status in ('pending', 'approved', 'rejected'));
alter table products add column if not exists ai_flagged boolean default false;
alter table products add column if not exists ai_confidence numeric default 0.0;
alter table products add column if not exists gst_rate numeric(5,2) default 0;
alter table products drop constraint if exists gst_rate_check;
alter table products add constraint gst_rate_check check (gst_rate >= 0 and gst_rate <= 100);
-- Existing products should be approved by default
update products set status = 'approved' where status = 'pending';

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
drop policy if exists "Retailers can view their own products" on products;
drop policy if exists "Retailers can insert their own products." on products;
drop policy if exists "Retailers can update their own products." on products;
drop policy if exists "Retailers can delete their own products." on products;
drop policy if exists "Admins can manage products" on products;

-- Create policies for the products table
-- Customers can see approved products
create policy "Products are viewable by everyone." on products for select using (status = 'approved');

-- Retailers can view their own products and insert/update/delete them
create policy "Retailers can view their own products" on products for select using (auth.uid() = retailer_id);
create policy "Retailers can insert their own products." on products for insert with check (auth.uid() = retailer_id);
create policy "Retailers can update their own products." on products for update using (auth.uid() = retailer_id);
create policy "Retailers can delete their own products." on products for delete using (auth.uid() = retailer_id);

create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.users 
    where id = auth.uid() 
    and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Admins can do anything with products
create policy "Admins can manage products" on products for all using (
  public.is_admin()
);
drop policy if exists "Admins can delete products" on products;
create policy "Admins can delete products" on products for delete using (
  public.is_admin()
);

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
  role text default 'retailer',
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Update check constraint to allow 'admin'
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('customer', 'retailer', 'admin'));

-- Ensure the email column exists (CREATE TABLE IF NOT EXISTS won't add new columns)
alter table public.users add column if not exists email text;

-- Enable RLS on users table
alter table public.users enable row level security;

-- Drop ALL existing policies on public.users to clear any infinite recursion bugs
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
    END LOOP;
END
$$;

-- Allow users to read their own profile
create policy "Users can read own profile" on public.users
  for select using (auth.uid() = id);

-- Allow users to update their own profile
create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- Allow Admins to select all users
create policy "Admins can view all users" on public.users
  for select using (
    public.is_admin()
  );

-- Trigger to create a user profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, role, email)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if it exists to avoid errors on re-run
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill emails for existing users who have NULL emails
update public.users
set email = auth_users.email
from auth.users as auth_users
where public.users.id = auth_users.id
and public.users.email is null;

-- RPC function to allow Admins to safely delete any product bypassing RLS issues
create or replace function public.delete_product_as_admin(target_product_id uuid)
returns boolean as $$
begin
  -- Use the existing is_admin security definer function to check permissions
  if not public.is_admin() then
    raise exception 'Unauthorized: Only admins can perform this action.';
  end if;

  -- Delete the product (cascading into flash_sales due to our FK update)
  delete from public.products where id = target_product_id;
  
  return true;
end;
$$ language plpgsql security definer;

-- Ensure the function is accessible to the Supabase API
GRANT EXECUTE ON FUNCTION public.delete_product_as_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_product_as_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;


-- ==========================================
-- ORDERS AND PAYMENTS ADDITIONS
-- ==========================================

-- 1. Create Orders Table
CREATE TABLE if not exists orders (
  order_id text primary key,
  user_id uuid references auth.users(id),
  customer_name text,
  customer_email text,
  items jsonb not null default '[]'::jsonb,
  product_total numeric not null default 0,
  shipping numeric not null default 0,
  tax numeric not null default 0,
  discount numeric not null default 0,
  final_amount numeric not null default 0,
  order_status text not null default 'Confirmed',
  shipping_address jsonb,
  payment_method text,
  retailer_id uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure existing 'orders' table gets all required columns
ALTER TABLE if exists orders ADD COLUMN if not exists order_id text;
ALTER TABLE if exists orders ADD COLUMN if not exists user_id uuid references auth.users(id);
ALTER TABLE if exists orders ADD COLUMN if not exists items jsonb;
ALTER TABLE if exists orders ADD COLUMN if not exists product_total numeric;
ALTER TABLE if exists orders ADD COLUMN if not exists shipping numeric;
ALTER TABLE if exists orders ADD COLUMN if not exists tax numeric;
ALTER TABLE if exists orders ADD COLUMN if not exists discount numeric default 0;
ALTER TABLE if exists orders ADD COLUMN if not exists final_amount numeric;
ALTER TABLE if exists orders ADD COLUMN if not exists order_status text default 'Confirmed';
ALTER TABLE if exists orders ADD COLUMN if not exists cart_items jsonb;
ALTER TABLE if exists orders ADD COLUMN if not exists shipping_address jsonb;
ALTER TABLE if exists orders ADD COLUMN if not exists payment_method text;

-- 2. Create Payments Table
CREATE TABLE if not exists payments (
  transaction_id text primary key,
  order_id text,
  user_id uuid references auth.users(id),
  amount numeric not null,
  method text not null, -- 'UPI' | 'Card' | 'Net Banking' | 'Wallet'
  method_details jsonb, -- masked only, e.g. {"last4":"4242"} or {"upi":"user@oksbi"}
  status text not null, -- 'Success' | 'Failed'
  failure_reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Flash Sales / Events Table
CREATE TABLE if not exists flash_sales (
  id uuid default uuid_generate_v4() primary key,
  retailer_id uuid references auth.users(id),
  title text not null,
  description text,
  product_id uuid references products(id) on delete cascade,
  discount_percentage numeric default 0,
  image_url text,
  valid_until timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure existing 'flash_sales' table gets the new column!
ALTER TABLE if exists flash_sales DROP CONSTRAINT if exists flash_sales_product_id_fkey;
ALTER TABLE if exists flash_sales ADD COLUMN if not exists product_id uuid references products(id) on delete cascade;
ALTER TABLE if exists flash_sales ADD COLUMN if not exists product_ids uuid[] default '{}';
ALTER TABLE if exists flash_sales ADD CONSTRAINT flash_sales_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Setup Row Level Security (RLS) policies
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sales ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to allow clean re-runs
drop policy if exists "Public profiles are viewable by everyone." on flash_sales;
drop policy if exists "Retailers can insert flash sales" on flash_sales;
drop policy if exists "Retailers can update their own flash sales" on flash_sales;
drop policy if exists "Retailers can delete their own flash sales" on flash_sales;

drop policy if exists "Public select orders" on orders;
drop policy if exists "Public insert orders" on orders;
drop policy if exists "Public update orders" on orders;
drop policy if exists "Retailers can view their orders" on orders;
drop policy if exists "Admins can view all orders" on orders;
drop policy if exists "Anyone can insert orders" on orders;
drop policy if exists "Users can view own orders" on orders;
drop policy if exists "Users can insert own orders" on orders;

drop policy if exists "Public select payments" on payments;
drop policy if exists "Public insert payments" on payments;
drop policy if exists "Users can view own payments" on payments;
drop policy if exists "Users can insert own payments" on payments;

-- Flash Sales policies
CREATE POLICY "Public profiles are viewable by everyone." ON flash_sales FOR SELECT USING (true);
CREATE POLICY "Retailers can insert flash sales" ON flash_sales FOR INSERT WITH CHECK (auth.uid() = retailer_id);
CREATE POLICY "Retailers can update their own flash sales" ON flash_sales FOR UPDATE USING (auth.uid() = retailer_id);
CREATE POLICY "Retailers can delete their own flash sales" ON flash_sales FOR DELETE USING (auth.uid() = retailer_id);

-- Orders RLS policies (allow customers & retailers to view and insert orders)
CREATE POLICY "Public select orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update orders" ON orders FOR UPDATE USING (true);

-- Payments RLS policies
CREATE POLICY "Public select payments" ON payments FOR SELECT USING (true);
CREATE POLICY "Public insert payments" ON payments FOR INSERT WITH CHECK (true);

-- ----------------------------------------------------
-- REVIEWS & RATINGS TABLE & AGGREGATE TRIGGER
-- ----------------------------------------------------

-- Drop old tables safely
DROP VIEW IF EXISTS product_ratings CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS product_rating_summary CASCADE;
DROP TABLE IF EXISTS product_reviews CASCADE;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create product_reviews
CREATE TABLE IF NOT EXISTS product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL,
    customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_title TEXT,
    review_text TEXT NOT NULL CHECK (char_length(trim(review_text)) > 0),
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0 CHECK (helpful_count >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create product_rating_summary
CREATE TABLE IF NOT EXISTS product_rating_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL UNIQUE,
    average_rating NUMERIC(3,2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    rating_5_count INTEGER DEFAULT 0,
    rating_4_count INTEGER DEFAULT 0,
    rating_3_count INTEGER DEFAULT 0,
    rating_2_count INTEGER DEFAULT 0,
    rating_1_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for product_reviews updated_at
DROP TRIGGER IF EXISTS trg_product_reviews_updated_at ON product_reviews;
CREATE TRIGGER trg_product_reviews_updated_at
BEFORE UPDATE ON product_reviews
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Aggregation Function
CREATE OR REPLACE FUNCTION update_product_rating_summary()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
    WITH agg AS (
        SELECT 
            COALESCE(AVG(rating), 0) as avg_rating,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE rating = 5) as r5,
            COUNT(*) FILTER (WHERE rating = 4) as r4,
            COUNT(*) FILTER (WHERE rating = 3) as r3,
            COUNT(*) FILTER (WHERE rating = 2) as r2,
            COUNT(*) FILTER (WHERE rating = 1) as r1
        FROM product_reviews
        WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
          AND is_approved = TRUE
    )
    INSERT INTO product_rating_summary (product_id, average_rating, total_reviews, rating_5_count, rating_4_count, rating_3_count, rating_2_count, rating_1_count)
    SELECT COALESCE(NEW.product_id, OLD.product_id), agg.avg_rating, agg.total, agg.r5, agg.r4, agg.r3, agg.r2, agg.r1 FROM agg
    ON CONFLICT (product_id) DO UPDATE SET
        average_rating = EXCLUDED.average_rating,
        total_reviews = EXCLUDED.total_reviews,
        rating_5_count = EXCLUDED.rating_5_count,
        rating_4_count = EXCLUDED.rating_4_count,
        rating_3_count = EXCLUDED.rating_3_count,
        rating_2_count = EXCLUDED.rating_2_count,
        rating_1_count = EXCLUDED.rating_1_count,
        updated_at = NOW();

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Aggregation Trigger
DROP TRIGGER IF EXISTS trg_update_rating_summary ON product_reviews;
CREATE TRIGGER trg_update_rating_summary
AFTER INSERT OR UPDATE OR DELETE ON product_reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating_summary();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_customer_id ON product_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_rating ON product_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_product_reviews_created_at ON product_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_product_reviews_is_approved ON product_reviews(is_approved);
CREATE INDEX IF NOT EXISTS idx_rating_summary_product_id ON product_rating_summary(product_id);

-- Enable RLS
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_rating_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_rating_summary
DROP POLICY IF EXISTS "Public read rating summary" ON product_rating_summary;
CREATE POLICY "Public read rating summary" ON product_rating_summary FOR SELECT USING (true);

-- RLS Policies for product_reviews
DROP POLICY IF EXISTS "Public read approved reviews" ON product_reviews;
DROP POLICY IF EXISTS "Users can insert own reviews" ON product_reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON product_reviews;
DROP POLICY IF EXISTS "Users can delete own reviews" ON product_reviews;
DROP POLICY IF EXISTS "Admins/Retailers full access to reviews" ON product_reviews;

CREATE POLICY "Public read approved reviews" ON product_reviews FOR SELECT USING (is_approved = TRUE);
CREATE POLICY "Users can insert own reviews" ON product_reviews FOR INSERT WITH CHECK (auth.uid() = customer_id OR customer_id IS NULL);
CREATE POLICY "Users can update own reviews" ON product_reviews FOR UPDATE USING (auth.uid() = customer_id OR customer_id IS NULL) WITH CHECK (auth.uid() = customer_id OR customer_id IS NULL);
CREATE POLICY "Users can delete own reviews" ON product_reviews FOR DELETE USING (auth.uid() = customer_id OR customer_id IS NULL);

CREATE POLICY "Admins/Retailers full access to reviews" ON product_reviews
USING (
    EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'retailer')
    )
);

-- Refresh the PostgREST schema cache so the API recognizes novel columns instantly
NOTIFY pgrst, 'reload schema';
