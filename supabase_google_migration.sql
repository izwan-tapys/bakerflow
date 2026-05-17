-- ============================================
-- A. CIPTA JADUAL PLANNER TUGASAN MANUAL
-- ============================================
CREATE TABLE IF NOT EXISTS baker_custom_tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  baker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  task_date DATE NOT NULL,
  start_time TIME NOT NULL, -- Menyokong format "14:00:00"
  duration INTEGER NOT NULL DEFAULT 30, -- Minit
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  google_event_id VARCHAR(255) NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aktifkan RLS untuk jadual tugasan manual
ALTER TABLE baker_custom_tasks ENABLE ROW LEVEL SECURITY;

-- Cipta polisi RLS
CREATE POLICY "Bakers can manage their own custom tasks"
ON baker_custom_tasks FOR ALL
TO authenticated
USING (auth.uid() = baker_id)
WITH CHECK (auth.uid() = baker_id);

-- ============================================
-- B. CIPTA JADUAL GOOGLE SYNC CREDENTIALS
-- ============================================
CREATE TABLE IF NOT EXISTS baker_google_credentials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  baker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expiry_date BIGINT NOT NULL, -- Unix timestamp kelucutan token
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Aktifkan RLS untuk jadual kelayakan Google
ALTER TABLE baker_google_credentials ENABLE ROW LEVEL SECURITY;

-- Cipta Polisi RLS untuk Bakers menguruskan kredensial mereka sendiri
CREATE POLICY "Bakers can manage their own Google credentials"
ON baker_google_credentials FOR ALL
TO authenticated
USING (auth.uid() = baker_id)
WITH CHECK (auth.uid() = baker_id);

-- ============================================
-- C. TAMBAH LAJUR TRACER GOOGLE CALENDAR
-- ============================================
-- Tambah lajur google_event_id ke jadual pesanan/order bagi menjejaki prep, bake, dan cool
ALTER TABLE orders ADD COLUMN IF NOT EXISTS google_prep_event_id VARCHAR(255) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS google_bake_event_id VARCHAR(255) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS google_cool_event_id VARCHAR(255) NULL;
