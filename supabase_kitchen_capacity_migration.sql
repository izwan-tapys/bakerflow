-- =========================================================================
-- 🗄️ SUPABASE MIGRATION: KITCHEN CAPACITY & EQUIPMENT METRICS
-- =========================================================================
-- Arahan: Sila salin dan tampal (copy & paste) keseluruhan kod di bawah ke dalam 
-- SQL Editor di Dashboard Supabase anda (https://supabase.com) untuk melaksanakannya.
-- =========================================================================

-- 1. KEMAS KINI JADUAL 'baker_settings' (Tetapan Waktu & Kapasiti Perkakasan)
ALTER TABLE baker_settings ADD COLUMN IF NOT EXISTS production_start_time TIME DEFAULT '09:00:00';
ALTER TABLE baker_settings ADD COLUMN IF NOT EXISTS production_end_time TIME DEFAULT '15:00:00';
ALTER TABLE baker_settings ADD COLUMN IF NOT EXISTS mixer_bowl_capacity_liters DECIMAL DEFAULT 4.8;
ALTER TABLE baker_settings ADD COLUMN IF NOT EXISTS oven_bcu_capacity INTEGER DEFAULT 4; -- Had loyang 8-inci sekali bakar
ALTER TABLE baker_settings ADD COLUMN IF NOT EXISTS chiller_bcu_capacity INTEGER DEFAULT 8; -- Had kotak 8x8-inci sekali simpan

-- 2. KEMAS KINI JADUAL 'products' (Tetapan Ukuran Jualan, Proofing & Basuh Mixer)
ALTER TABLE products ADD COLUMN IF NOT EXISTS measurement_unit VARCHAR(20) DEFAULT 'inch'; -- 'inch' (saiz), 'gram' (berat), 'unit' (bekas)
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_size_inches INTEGER DEFAULT 8; -- Cth: Kek 8-inci
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_weight_grams INTEGER DEFAULT 500; -- Cth: Sourdough 500g
ALTER TABLE products ADD COLUMN IF NOT EXISTS box_size_inches INTEGER DEFAULT 8; -- Cth: Kotak 8x8
ALTER TABLE products ADD COLUMN IF NOT EXISTS proofing_time_hours INTEGER DEFAULT 0; -- Masa kembang adunan (Jam)
ALTER TABLE products ADD COLUMN IF NOT EXISTS proofing_time_minutes INTEGER DEFAULT 0; -- Masa kembang adunan (Minit)
ALTER TABLE products ADD COLUMN IF NOT EXISTS bowl_cleanup_minutes INTEGER DEFAULT 15; -- Masa basuh mixer/mangkuk sebelum mula resipi lain

-- 3. JALANKAN VERIFIKASI STRUKTUR LAJUR (Optional Debug)
COMMENT ON COLUMN baker_settings.oven_bcu_capacity IS 'Kapasiti oven diukur berdasarkan unit loyang bulat standard 8-inci (BCU)';
COMMENT ON COLUMN baker_settings.chiller_bcu_capacity IS 'Kapasiti chiller diukur berdasarkan kotak standard 8x8x4-inci (BCU)';
COMMENT ON COLUMN products.measurement_unit IS 'Pilihan unit jualan produk utama untuk penskalaan automatik';

-- =========================================================================
-- Selesai! Struktur database anda kini 100% bersedia untuk fasa UI & Algoritma!
-- =========================================================================
