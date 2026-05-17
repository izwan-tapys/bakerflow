// =========================================================================
// 🔄 BAKERFLOW ONBOARDING RESET UTILITY
// =========================================================================
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Baca .env.local secara manual
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

async function resetOnboarding() {
  console.log("=========================================================================");
  console.log("              🔄 MEMULAKAN SET SEMULA STATUS ONBOARDING 🔄");
  console.log("=========================================================================");

  // Dapatkan baker_id dari jadual kredensial Google sedia ada
  const { data: creds } = await supabase
    .from('baker_google_credentials')
    .select('baker_id')
    .limit(1)
    .maybeSingle();

  const bakerId = creds?.baker_id || '3e0145ff-b615-43aa-93ec-c546a1f5a4f1';

  console.log(`1. Baker ID dikesan: ${bakerId}`);

  // Setkan is_setup_complete = false dan kosongkan nilai kapasiti di database
  console.log("2. Mengemas kini baker_settings di database...");
  const { error } = await supabase
    .from('baker_settings')
    .update({
      is_setup_complete: false,
      oven_bcu_capacity: null,
      chiller_bcu_capacity: null,
      mixer_bowl_capacity_liters: null
    })
    .eq('baker_id', bakerId);

  if (error) {
    console.error("❌ Ralat semasa set semula:", error.message);
  } else {
    console.log("\n🎉 BERJAYA! Status Onboarding Kak Sue telah diset semula!");
    console.log("   -> Nilai Kapasiti Oven, Chiller, dan Mixer telah dikosongkan.");
    console.log("   -> Apabila tuan buka portal esok, sistem akan membawa tuan terus ke onboarding wizard!");
  }
  console.log("=========================================================================");
}

resetOnboarding();
