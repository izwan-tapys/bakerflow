// =========================================================================
// 🔍 BAKERFLOW GOOGLE SYNC DIAGNOSTIC SCRIPT (ROBUST MANUAL)
// =========================================================================
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Baca .env.local secara manual tanpa dotenv!
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
} catch (e) {
  console.error("❌ Ralat membaca fail .env.local:", e.message);
}

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Ralat: Kunci Supabase tidak dijumpai di dalam .env.local!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runDiagnostics() {
  console.log("=========================================================================");
  console.log("            🔍 MEMULAKAN DIAGNOSTIK GOOGLE CALENDAR & DATABASE 🔍");
  console.log("=========================================================================");

  // 1. Semak Kredensial Google
  console.log("\n1. Menyemak Kredensial Google di Jadual 'baker_google_credentials'...");
  const { data: creds, error: credsErr } = await supabase
    .from('baker_google_credentials')
    .select('*');

  if (credsErr) {
    console.error("❌ Ralat menyemak kredensial:", credsErr.message);
  } else if (!creds || creds.length === 0) {
    console.log("⚠️ AMARAN: Tiada sebarang rekod kredensial Google ditemui!");
    console.log("   -> Maknanya Kak Sue/tuan belum klik 'Connect' di Settings untuk sambung Google Calendar!");
  } else {
    console.log(`✅ BERJAYA: Menemui ${creds.length} akaun Google berdaftar.`);
    creds.forEach((c, idx) => {
      console.log(`   [Akaun ${idx + 1}] Baker ID: ${c.baker_id}`);
      console.log(`   - Token Expiry: ${new Date(Number(c.expiry_date)).toLocaleString()}`);
      console.log(`   - Token Valid? ${Number(c.expiry_date) > Date.now() ? 'YA' : 'TIDAK (Perlu refresh automatik)'}`);
    });
  }

  // 2. Semak Lajur 'orders'
  console.log("\n2. Menyemak Lajur 'google_event_id' di Jadual 'orders'...");
  const { data: testOrder, error: orderErr } = await supabase
    .from('orders')
    .select('*')
    .limit(1);

  if (orderErr) {
    console.error("❌ Ralat membaca jadual orders:", orderErr.message);
  } else if (testOrder && testOrder.length > 0) {
    const order = testOrder[0];
    const hasPrep = 'google_prep_event_id' in order;
    const hasBake = 'google_bake_event_id' in order;
    const hasCool = 'google_cool_event_id' in order;

    console.log(`   - google_prep_event_id : ${hasPrep ? '✅ WUJUD' : '❌ TIADA (Sebab ralat sync!)'}`);
    console.log(`   - google_bake_event_id : ${hasBake ? '✅ WUJUD' : '❌ TIADA (Sebab ralat sync!)'}`);
    console.log(`   - google_cool_event_id : ${hasCool ? '✅ WUJUD' : '❌ TIADA (Sebab ralat sync!)'}`);

    if (!hasPrep || !hasBake || !hasCool) {
      console.log("\n💡 ANALISIS TINDAKAN:");
      console.log("   -> Tuan perlu salin & jalankan semula Bahagian C di fail 'supabase_google_migration.sql'");
      console.log("      di dalam Supabase SQL Editor untuk menambah lajur-lajur tersebut!");
    } else {
      console.log("\n✅ Struktur jadual orders di database Supabase adalah SEMPURNA!");
    }
  } else {
    console.log("ℹ️ Tiada order ditemui untuk diperiksa lajurnya, tetapi tiada ralat sql.");
  }

  console.log("\n=========================================================================");
  console.log("                 🏁 DIAGNOSTIK SELESAI DIJALANKAN 🏁");
  console.log("=========================================================================");
}

runDiagnostics();
