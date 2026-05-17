// =========================================================================
// 🔍 BAKERFLOW LIVE SYNC ENDPOINT DIAGNOSTIC SCRIPT
// =========================================================================
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Baca .env.local secara manual
let supabaseUrl = '';
let supabaseKey = '';

try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
      const matchUrl = line.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)$/);
      const matchKey = line.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)$/);
      if (matchUrl) supabaseUrl = matchUrl[1].trim();
      if (matchKey) supabaseKey = matchKey[1].trim();
    });
  }
} catch (e) {}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLiveSync() {
  console.log("=========================================================================");
  console.log("          ⚡ MENJALANKAN LIVE SYNC API ENDPOINT TEST ⚡");
  console.log("=========================================================================");

  // 1. Cari satu order yang bertaraf 'approved' atau 'production'
  const { data: orders, error: orderErr } = await supabase
    .from('orders')
    .select('*, product:products(*)')
    .in('status', ['approved', 'production'])
    .limit(1);

  if (orderErr) {
    console.error("❌ Ralat mencari order:", orderErr.message);
    process.exit(1);
  }

  if (!orders || orders.length === 0) {
    console.log("⚠️ Tiada order dengan status 'approved' atau 'production' dijumpai!");
    console.log("   -> Sila tukar sekurang-kurangnya satu status order ke 'Approved' di UI portal!");
    process.exit(0);
  }

  const order = orders[0];
  console.log(`✅ MENEMUI PESANAN UNTUK DIUJI:`);
  console.log(`   - Order ID     : ${order.id}`);
  console.log(`   - Order Number : ${order.order_number}`);
  console.log(`   - Customer     : ${order.customer_name}`);
  console.log(`   - Product      : ${order.product_name}`);
  console.log(`   - Quantity     : ${order.quantity}`);
  console.log(`   - Delivery     : ${order.delivery_date} @ ${order.delivery_time || '15:00'}`);

  // 2. Buat simulasi panggillan API Route
  console.log("\n🔗 Menghantar request ke local API Route '/api/sync/calendar'...");
  try {
    const res = await fetch('http://localhost:3000/api/sync/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baker_id: order.baker_id,
        action: 'sync_order',
        order_id: order.id
      })
    });

    const data = await res.json();
    console.log(`\n📬 RESPON DARIPADA API ENDPOINT (Status: ${res.status}):`);
    console.log(JSON.stringify(data, null, 2));

    if (res.ok && data.success) {
      console.log("\n🎉 SYNC BERJAYA! Tugasan SKE berjaya ditulis ke Google Calendar!");
    } else {
      console.log("\n❌ SYNC GAGAL! Sila rujuk ralat di atas.");
    }
  } catch (err) {
    console.error("\n❌ Ralat menyambung ke server tempatan (localhost:3000):", err.message);
    console.log("💡 Pastikan aplikasi Next.js sedang berjalan di localhost:3000!");
  }

  console.log("=========================================================================");
}

testLiveSync();
