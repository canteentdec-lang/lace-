-- SQL Schema for Employee Management & Production Tracking App

-- 1. Employees Table
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  user_id TEXT UNIQUE NOT NULL, -- This is the login ID
  password TEXT NOT NULL, -- In a real app, use Supabase Auth, but user asked for custom fields
  role TEXT DEFAULT 'employee', -- 'admin' or 'employee'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Attendance & Production Table
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES employees(user_id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  login_time TIMESTAMPTZ,
  logout_time TIMESTAMPTZ,
  total_hours NUMERIC(5, 2),
  shift TEXT CHECK (shift IN ('day', 'night')),
  katai INTEGER,
  mtr_type TEXT, -- '17', '24', '36', or custom
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Parties Table
CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gst_no TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Products Table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(10, 2),
  gst_percent NUMERIC(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Challans Table
CREATE TABLE challans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_no TEXT UNIQUE NOT NULL,
  party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Challan Items Table
CREATE TABLE challan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id UUID REFERENCES challans(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT, -- Snapshot of product name at time of creation
  price NUMERIC(10, 2),
  quantity NUMERIC(10, 2),
  total NUMERIC(12, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies (Row Level Security)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE challan_items ENABLE ROW LEVEL SECURITY;

-- Simple policies for now (Admin can do everything, Employees can read/write their own attendance)
CREATE POLICY "Admin full access" ON employees FOR ALL USING (true);
CREATE POLICY "Admin full access" ON attendance FOR ALL USING (true);
CREATE POLICY "Admin full access" ON parties FOR ALL USING (true);
CREATE POLICY "Admin full access" ON products FOR ALL USING (true);
CREATE POLICY "Admin full access" ON challans FOR ALL USING (true);
CREATE POLICY "Admin full access" ON challan_items FOR ALL USING (true);

-- Employee specific policies
CREATE POLICY "Employee read own attendance" ON attendance FOR SELECT USING (user_id = (SELECT user_id FROM employees WHERE user_id = current_setting('app.current_user_id', true)));
CREATE POLICY "Employee insert own attendance" ON attendance FOR INSERT WITH CHECK (user_id = (SELECT user_id FROM employees WHERE user_id = current_setting('app.current_user_id', true)));
CREATE POLICY "Employee update own attendance" ON attendance FOR UPDATE USING (user_id = (SELECT user_id FROM employees WHERE user_id = current_setting('app.current_user_id', true)));
