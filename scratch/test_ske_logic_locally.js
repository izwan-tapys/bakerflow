// =========================================================================
// 🧠 BAKERFLOW LIVE SKE LOGIC DEBUGGER (DIRECT RUN)
// =========================================================================
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Baca .env.local secara manual
let supabaseUrl = '';
let supabaseKey = '';
let googleClientId = '';
let googleClientSecret = '';

try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
      const matchUrl = line.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)$/);
      const matchKey = line.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)$/);
      const matchClientId = line.match(/^NEXT_PUBLIC_GOOGLE_CLIENT_ID\s*=\s*(.*)$/);
      const matchClientSecret = line.match(/^GOOGLE_CLIENT_SECRET\s*=\s*(.*)$/);
      
      if (matchUrl) supabaseUrl = matchUrl[1].trim();
      if (matchKey) supabaseKey = matchKey[1].trim();
      if (matchClientId) googleClientId = matchClientId[1].trim();
      if (matchClientSecret) googleClientSecret = matchClientSecret[1].trim();
    });
  }
} catch (e) {}

const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Google Calendar Helper Functions (Direct Implementation to avoid CJS/TS issues)
async function getOrRefreshAccessToken(bakerId) {
  try {
    const { data: creds, error } = await supabase
      .from('baker_google_credentials')
      .select('*')
      .eq('baker_id', bakerId)
      .maybeSingle();

    if (error || !creds) {
      console.error("   ❌ [Token Check] Kredensial tidak dijumpai di DB untuk Baker ID:", bakerId);
      return null;
    }

    const now = Date.now();
    if (Number(creds.expiry_date) > now + 300000) {
      return creds.access_token;
    }

    console.log("   🔄 [Token Check] Token hampir/telah tamat. Melakukan refresh...");
    const bodyParams = {
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: creds.refresh_token,
      grant_type: 'refresh_token',
    };

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(bodyParams).toString(),
    });

    if (!res.ok) {
      throw new Error(`Google token refresh failed: ${res.statusText}`);
    }

    const tokenData = await res.json();
    const newAccessToken = tokenData.access_token;
    const newExpiry = Date.now() + (tokenData.expires_in * 1000);

    await supabase
      .from('baker_google_credentials')
      .update({
        access_token: newAccessToken,
        expiry_date: newExpiry,
      })
      .eq('baker_id', bakerId);

    console.log("   ✅ [Token Check] Token berjaya diperbaharui!");
    return newAccessToken;
  } catch (err) {
    console.error('   ❌ Error in getOrRefreshAccessToken:', err.message);
    return null;
  }
}

function getEventTimes(dateStr, startTimeStr, durationMin) {
  const startObj = new Date(`${dateStr}T${startTimeStr}:00`);
  const endObj = new Date(startObj.getTime() + durationMin * 60 * 1000);
  const pad = (n) => n.toString().padStart(2, '0');
  const toISOStringWithTZ = (d) => {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  return {
    startISO: toISOStringWithTZ(startObj),
    endISO: toISOStringWithTZ(endObj),
  };
}

async function insertGoogleEvent(bakerId, task) {
  try {
    const accessToken = await getOrRefreshAccessToken(bakerId);
    if (!accessToken) {
      console.error("   ❌ [Google API] Gagal mendapatkan access token.");
      return null;
    }

    const { startISO, endISO } = getEventTimes(task.date, task.start_time, task.duration);
    const body = {
      summary: task.title,
      description: task.description,
      start: { dateTime: startISO, timeZone: 'Asia/Kuala_Lumpur' },
      end: { dateTime: endISO, timeZone: 'Asia/Kuala_Lumpur' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 },
          { method: 'popup', minutes: 5 },
        ],
      },
    };

    console.log(`   📡 [Google API] Menghantar request insert event: "${task.title}"...`);
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`   ❌ [Google API] Ralat Google (Status: ${res.status}): ${errText}`);
      return null;
    }

    const data = await res.json();
    console.log(`   ✅ [Google API] Berjaya disinkron! Event ID: ${data.id}`);
    return data.id;
  } catch (err) {
    console.error('   ❌ [Google API] Exception during event insert:', err.message);
    return null;
  }
}

// 3. Main Logic Execution
async function debugSkeSync() {
  console.log("=========================================================================");
  console.log("            🧠 BAKERFLOW SKE BACKEND LINE-BY-LINE DEBUGGER 🧠");
  console.log("=========================================================================");

  const orderId = '261f0643-9153-4d75-a25c-e0e19127d754'; // Order Abu yang diuji
  console.log(`1. Membaca data tempahan (Order ID: ${orderId})...`);
  
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderErr || !order) {
    console.error("❌ Ralat: Tempahan tidak dijumpai di database!", orderErr ? orderErr.message : '');
    process.exit(1);
  }

  console.log(`   - Ditemui: Pesanan ${order.order_number} oleh ${order.customer_name}`);
  console.log(`   - Tarikh Penghantaran: ${order.delivery_date} @ ${order.delivery_time || '15:00'}`);

  console.log("\n2. Membaca data produk...");
  const { data: product, error: prodErr } = await supabase
    .from('products')
    .select('*')
    .eq('id', order.product_id)
    .single();

  if (prodErr) {
    console.warn("⚠️ Amaran ralat membaca produk, fallback digunakan:", prodErr.message);
  }
  console.log(`   - Nama Produk: ${product ? product.name : 'Sour Dough Bread (Fallback)'}`);

  console.log("\n3. Membaca tetapan dapur...");
  const { data: settings } = await supabase
    .from('baker_settings')
    .select('*')
    .eq('baker_id', order.baker_id)
    .maybeSingle();

  const ovenBcuCapacity = settings?.oven_bcu_capacity ?? 4;
  const chillerBcuCapacity = settings?.chiller_bcu_capacity ?? 8;
  console.log(`   - Kapasiti Oven   : ${ovenBcuCapacity} BCU`);
  console.log(`   - Kapasiti Chiller: ${chillerBcuCapacity} BCU`);

  // SKE Calculations
  const prep = product?.prep_time || 30;
  const bake = product?.bake_time || 45;
  const cool = product?.cool_time || 60;
  const deliveryTime = order.delivery_time || '15:00';

  const getProductBCU = (p) => {
    if (!p) return 1.0;
    const unit = p.measurement_unit || 'inch';
    if (unit === 'inch') {
      const size = p.product_size_inches || 8;
      if (size <= 6) return 0.5;
      if (size <= 8) return 1.0;
      if (size <= 10) return 1.5;
      return 2.0;
    } else if (unit === 'gram') {
      const weight = p.product_weight_grams || 500;
      if (weight <= 300) return 0.25;
      if (weight <= 600) return 0.5;
      if (weight <= 1000) return 1.0;
      return 2.0;
    }
    return 1.0;
  };

  const currentBcu = getProductBCU(product);
  const orderBcu = currentBcu * order.quantity;

  console.log("\n4. Mengira Batching & Beban Chiller SKE...");
  const { data: sameDayOrders } = await supabase
    .from('orders')
    .select('*, product:products(*)')
    .eq('baker_id', order.baker_id)
    .eq('delivery_date', order.delivery_date)
    .in('status', ['approved', 'production'])
    .order('created_at', { ascending: true });

  const validOrders = (sameDayOrders || []).filter(o => o.product_id);
  let currentBatchBcu = 0;
  let batchNumber = 1;
  let myBatch = 1;
  let totalDayBcu = 0;

  for (const o of validOrders) {
    const oProduct = o.product || {};
    const oBcu = getProductBCU(oProduct) * o.quantity;
    totalDayBcu += oBcu;

    if (currentBatchBcu + oBcu > ovenBcuCapacity) {
      batchNumber += 1;
      currentBatchBcu = oBcu;
    } else {
      currentBatchBcu += oBcu;
    }

    if (o.id === order.id) {
      myBatch = batchNumber;
    }
  }

  const isChillerOverloaded = totalDayBcu > chillerBcuCapacity;
  console.log(`   - Oven Grouping: Batch ${myBatch}/${batchNumber}`);
  console.log(`   - Jumlah Beban Chiller: ${totalDayBcu.toFixed(1)}/${chillerBcuCapacity} BCU`);

  // Formatting dates & times
  const toTimeStr = (d) => {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };
  
  const toDateStr = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  console.log("\n5. Menghitung garis masa (Timeline Timings)...");
  // Pastikan tarikh delivery dibersihkan daripada timezones
  const cleanDateStr = typeof order.delivery_date === 'string'
    ? order.delivery_date.substring(0, 10)
    : new Date(order.delivery_date).toISOString().substring(0, 10);

  console.log(`   - Cleaned Delivery Date: "${cleanDateStr}"`);
  console.log(`   - Delivery Time        : "${deliveryTime}"`);

  const readyTime = new Date(`${cleanDateStr}T${deliveryTime}:00`);
  const startCoolTime = new Date(readyTime.getTime() - cool * 60000);
  const batchShiftOffset = (myBatch - 1) * (bake + 10);
  const startBakeTime = new Date(startCoolTime.getTime() - (bake + batchShiftOffset) * 60000);

  const proofingTime = ((product?.proofing_time_hours || 0) * 60) + (product?.proofing_time_minutes || 0);
  const isLongProofing = proofingTime >= 240;

  let startPrepTime;
  let prepDate;
  let proofingNote = '';

  if (isLongProofing) {
    const prevDay = new Date(readyTime.getTime() - 86400000);
    prepDate = toDateStr(prevDay);
    startPrepTime = new Date(`${prepDate}T14:00:00`);
    proofingNote = `\n\n⚠️ Masa perapan semalaman dikesan (${product?.proofing_time_hours || 0}j ${product?.proofing_time_minutes || 0}m)!`;
  } else {
    const startProofingTime = new Date(startBakeTime.getTime() - proofingTime * 60000);
    startPrepTime = new Date(startProofingTime.getTime() - prep * 60000);
    prepDate = toDateStr(startPrepTime);
    if (proofingTime > 0) {
      proofingNote = `\n\n💡 Mengambil kira masa perapan ${proofingTime} minit.`;
    }
  }

  const bowlCleanup = product?.bowl_cleanup_minutes || 15;
  const cleanUpNote = validOrders.length > 1 ? `\n\n🥣 Termasuk 15m basuh mixer.` : '';
  const chillerAlertNote = isChillerOverloaded ? `\n\n⚠️ AMARAN PETI SEJUK PENUH!` : '';

  console.log(`   - Prep Event Time : ${prepDate} @ ${toTimeStr(startPrepTime)} (${prep}m)`);
  console.log(`   - Bake Event Time : ${toDateStr(startBakeTime)} @ ${toTimeStr(startBakeTime)} (${bake}m)`);
  console.log(`   - Cool Event Time : ${toDateStr(startCoolTime)} @ ${toTimeStr(startCoolTime)} (${cool}m)`);

  console.log("\n6. Menjalankan penyinkronan Google Calendar (Live API POST)...");

  console.log("   --> Menghantar Tugasan PREP...");
  const prepEventId = await insertGoogleEvent(order.baker_id, {
    title: `🥣 Prep: ${order.product_name} (x${order.quantity}) - ${order.customer_name}`,
    description: `Fasa penyediaan adunan.#${order.order_number}.${proofingNote}${cleanUpNote}`,
    date: prepDate,
    start_time: toTimeStr(startPrepTime),
    duration: prep + (validOrders.length > 1 ? bowlCleanup : 0)
  });

  console.log("   --> Menghantar Tugasan BAKE...");
  const bakeEventId = await insertGoogleEvent(order.baker_id, {
    title: `🔥 Bake [Batch ${myBatch}/${batchNumber}]: ${order.product_name} (x${order.quantity})`,
    description: `Fasa pembakaran oven.#${order.order_number}.\n\nBatch ${myBatch}/${batchNumber}.${chillerAlertNote}`,
    date: toDateStr(startBakeTime),
    start_time: toTimeStr(startBakeTime),
    duration: bake
  });

  console.log("   --> Menghantar Tugasan COOL...");
  const coolEventId = await insertGoogleEvent(order.baker_id, {
    title: `❄️ Cool: ${order.product_name} (x${order.quantity}) - ${order.customer_name}`,
    description: `Fasa penyejukan & QC.#${order.order_number}.${chillerAlertNote}`,
    date: toDateStr(startCoolTime),
    start_time: toTimeStr(startCoolTime),
    duration: cool
  });

  console.log("\n7. Keputusan Ujian Janaan:");
  console.log(`   - Prep Google Event ID: ${prepEventId ? '✅ ' + prepEventId : '❌ GAGAL'}`);
  console.log(`   - Bake Google Event ID: ${bakeEventId ? '✅ ' + bakeEventId : '❌ GAGAL'}`);
  console.log(`   - Cool Google Event ID: ${coolEventId ? '✅ ' + coolEventId : '❌ GAGAL'}`);

  if (prepEventId && bakeEventId && coolEventId) {
    console.log("\n🎉 DIAGNOSTIK MENUNJUKKAN OPERASI SKE DAN GOOGLE CALENDAR ADALAH 100% SUKSES!");
  } else {
    console.error("\n❌ TERDAPAT KEGAGALAN DALAM KANVAS API GOOGLE CALENDAR. Sila semak log ralat Google di atas.");
  }

  console.log("=========================================================================");
}

debugSkeSync();
