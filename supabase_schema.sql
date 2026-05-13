-- ============================================
-- BakerFlow Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. BAKER SETTINGS
-- ============================================
CREATE TABLE baker_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  baker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL DEFAULT 'My Bakery',
  home_address TEXT,
  home_lat DECIMAL(10, 8),
  home_lng DECIMAL(11, 8),
  daily_capacity INT NOT NULL DEFAULT 5,
  whatsapp_number TEXT,
  bank_name TEXT,
  bank_account TEXT,
  bank_holder TEXT,
  toyyibpay_secret_key TEXT,
  toyyibpay_category_id TEXT,
  gmaps_api_key TEXT,
  is_setup_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. DELIVERY ZONES
-- ============================================
CREATE TABLE delivery_zones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  baker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  zone_name TEXT NOT NULL,
  min_km DECIMAL(5, 2) NOT NULL DEFAULT 0,
  max_km DECIMAL(5, 2) NOT NULL,
  fee DECIMAL(8, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. PRODUCTS
-- ============================================
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  baker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(8, 2) NOT NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. ORDERS
-- ============================================
CREATE TYPE order_status AS ENUM (
  'pending',
  'approved',
  'production',
  'ready',
  'otw',
  'completed',
  'cancelled'
);

CREATE TYPE payment_method AS ENUM (
  'toyyibpay',
  'manual_transfer',
  'cod'
);

CREATE TYPE payment_status AS ENUM (
  'unpaid',
  'pending_verification',
  'paid'
);

CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  baker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE,

  -- Customer Info
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  customer_lat DECIMAL(10, 8),
  customer_lng DECIMAL(11, 8),

  -- Order Details
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(8, 2) NOT NULL,
  delivery_fee DECIMAL(8, 2) DEFAULT 0,
  distance_km DECIMAL(6, 2),
  total_amount DECIMAL(8, 2) NOT NULL,

  -- Dates
  delivery_date DATE NOT NULL,
  delivery_time TEXT,

  -- Status
  status order_status DEFAULT 'pending',

  -- Payment
  payment_method payment_method,
  payment_status payment_status DEFAULT 'unpaid',
  receipt_url TEXT,
  toyyibpay_bill_code TEXT,
  paid_at TIMESTAMPTZ,

  -- Notes
  special_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'BF-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- ============================================
-- 5. INGREDIENTS (Moving Average Inventory)
-- ============================================
CREATE TABLE ingredients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  baker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',  -- g, kg, ml, L, pcs
  current_stock DECIMAL(10, 3) DEFAULT 0,
  avg_cost_per_unit DECIMAL(10, 4) DEFAULT 0,  -- Moving Average Cost
  low_stock_threshold DECIMAL(10, 3) DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. INGREDIENT PURCHASE LOG (for Moving Average)
-- ============================================
CREATE TABLE ingredient_purchases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  baker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL(10, 3) NOT NULL,
  unit_cost DECIMAL(10, 4) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. RECIPES
-- ============================================
CREATE TABLE recipes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  baker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_needed DECIMAL(10, 3) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE baker_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Baker can only see their own data
CREATE POLICY "Baker: own data only" ON baker_settings FOR ALL USING (baker_id = auth.uid());
CREATE POLICY "Baker: own zones" ON delivery_zones FOR ALL USING (baker_id = auth.uid());
CREATE POLICY "Baker: own products" ON products FOR ALL USING (baker_id = auth.uid());
CREATE POLICY "Baker: own orders" ON orders FOR ALL USING (baker_id = auth.uid());
CREATE POLICY "Baker: own ingredients" ON ingredients FOR ALL USING (baker_id = auth.uid());
CREATE POLICY "Baker: own purchases" ON ingredient_purchases FOR ALL USING (baker_id = auth.uid());
CREATE POLICY "Baker: own recipes" ON recipes FOR ALL USING (baker_id = auth.uid());

-- Public can read products and check order availability
CREATE POLICY "Public: read active products" ON products FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public: insert orders" ON orders FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Public: read orders by date" ON orders FOR SELECT USING (TRUE);
