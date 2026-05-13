# PRODUCT REQUIREMENTS DOCUMENT (PRD): BakerFlow
**Project Code:** BAKERFLOW-PWA-2026
**Version:** 1.0 (MVP)
**Stack:** Next.js (Vercel/v0), Supabase, Antigravity IDE, Google Maps API.
**Status:** Ready for Development

---

## 1. PRODUCT VISION & STRATEGY
**BakerFlow** adalah asisten digital "Single-Player" untuk *home-bakers* solo. Fokus utama adalah menghapuskan "Administrative Friction" melalui automasi aliran kerja (workflow) dari tempahan hingga penghantaran (COD).

---

## 2. USER PERSONA
**The "Solo-Baker" (e.g., Kawan Bini Wan):**
- Menguruskan produksi, admin, dan penghantaran (kereta sendiri).
- **Pain Points:** Terlebih ambil order (overbooked), tersalah kira caj COD (rugi minyak), dan penat menaip manual di WhatsApp.

---

## 3. FUNCTIONAL REQUIREMENTS (MVP)

### 3.1 Visual Capacity Engine (Calendar)
- **Daily Slot Limit:** Baker boleh menetapkan had maksimum order sehari (e.g., 5 slot).
- **Heatmap Calendar:** Paparan visual status slot (Hijau: Kosong, Kuning: 1-2 slot tinggal, Merah: Full).
- **Blockout Dates:** Kebolehan menutup terus tarikh tertentu (e.g., cuti raya/kenduri).

### 3.2 Smart Logistics Engine (GMap Distance)
- **Origin-Based Routing:** Kira jarak dari rumah baker ke alamat pelanggan menggunakan **Google Maps Distance Matrix API**.
- **Dynamic Pricing:** Automatik padankan jarak (KM) dengan zon harga yang telah ditetapkan (Zon A, B, C).
- **Manual Adjustment:** Benarkan baker tambah kos parking/tol secara manual.

### 3.3 WhatsApp Automation (Deep Link)
- **Zero-Server Logic:** Menggunakan `wa.me` deep links untuk menghantar mesej dari akaun peribadi baker.
- **Dynamic Templates:**
  - `CONFIRM`: Invois ringkas + Maklumat Deposit.
  - `OTW`: Notifikasi "Saya sedang menuju ke alamat anda" + **Baki COD tepat**.

### 3.4 Financial Audit Trail
- **Balance Tracker:** Automatik kira `(Harga + Delivery) - Deposit = Baki COD`.
- **Status Toggling:** Tukar status order (Pending -> Confirmed -> OTW -> Completed).

---

## 4. TECHNICAL ARCHITECTURE

- **UI/UX:** Diperkasakan oleh **Vercel (v0.dev)** – Mobile-first, Tailwind CSS, Shadcn UI.
- **Backend:** **Supabase** (PostgreSQL) – Real-time database & Auth.
- **IDE:** **Antigravity** – Untuk pembangunan pantas dan integrasi cloud.
- **Deployment:** **Vercel** – Untuk hosting PWA yang pantas dan berskala.

---

## 5. DATABASE SCHEMA (POSTGRESQL)

```sql
-- Table: baker_settings (Setup Awal)
CREATE TABLE baker_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users,
  home_address TEXT,
  daily_limit INT DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: delivery_zones (Rules COD)
CREATE TABLE delivery_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baker_id UUID REFERENCES auth.users,
  max_km NUMERIC,
  fee NUMERIC
);

-- Table: orders (Data Transaksi)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baker_id UUID REFERENCES auth.users,
  cust_name TEXT,
  cust_phone TEXT,
  cust_address TEXT,
  product_name TEXT,
  price_product NUMERIC,
  price_delivery NUMERIC,
  deposit_amount NUMERIC,
  balance_due NUMERIC GENERATED ALWAYS AS ((price_product + price_delivery) - deposit_amount) STORED,
  delivery_date DATE,
  status TEXT DEFAULT 'pending' -- pending, confirmed, otw, completed
);