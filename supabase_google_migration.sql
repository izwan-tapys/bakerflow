-- 1. Cipta jadual kelayakan Google Credentials
CREATE TABLE IF NOT EXISTS baker_google_credentials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  baker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expiry_date BIGINT NOT NULL, -- Unix timestamp (milisaat) kelucutan token
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE baker_google_credentials ENABLE ROW LEVEL SECURITY;

-- Cipta Polisi RLS untuk Bakers menguruskan kredensial mereka sendiri
CREATE POLICY "Bakers can manage their own Google credentials"
ON baker_google_credentials FOR ALL
TO authenticated
USING (auth.uid() = baker_id)
WITH CHECK (auth.uid() = baker_id);

-- 2. Tambah lajur google_event_id ke jadual tugasan manual (baker_custom_tasks)
ALTER TABLE baker_custom_tasks ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255) NULL;

-- 3. Tambah lajur google_event_id ke jadual pesanan/order (orders) bagi menjejaki tugasan baking auto
ALTER TABLE orders ADD COLUMN IF NOT EXISTS google_prep_event_id VARCHAR(255) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS google_bake_event_id VARCHAR(255) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS google_cool_event_id VARCHAR(255) NULL;
