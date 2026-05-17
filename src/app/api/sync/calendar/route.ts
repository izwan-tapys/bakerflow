import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { insertGoogleEvent, deleteGoogleEvent } from '@/lib/services/googleCalendar';

export async function POST(request: Request) {
  try {
    const { baker_id, action, task, eventId, order_id } = await request.json();

    if (!baker_id || !action) {
      return NextResponse.json({ error: 'Missing baker_id or action' }, { status: 400 });
    }

    // A. HANDLE INSERT CUSTOM EVENT
    if (action === 'insert') {
      if (!task) {
        return NextResponse.json({ error: 'Missing task payload for insertion' }, { status: 400 });
      }

      const gEventId = await insertGoogleEvent(baker_id, task);
      
      if (!gEventId) {
        return NextResponse.json({ error: 'Failed to insert event into Google Calendar' }, { status: 500 });
      }

      return NextResponse.json({ success: true, google_event_id: gEventId });
    }

    // B. HANDLE DELETE CUSTOM EVENT
    if (action === 'delete') {
      if (!eventId) {
        return NextResponse.json({ error: 'Missing eventId for deletion' }, { status: 400 });
      }

      const success = await deleteGoogleEvent(baker_id, eventId);
      
      if (!success) {
        return NextResponse.json({ error: 'Failed to delete event from Google Calendar' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // C. HANDLE SYNC ORDER (PREP, BAKE, COOL PHASES WITH SKE SCHEDULER ENGINE)
    if (action === 'sync_order') {
      if (!order_id) {
        return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
      }

      // Fetch order
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', order_id)
        .single();

      if (orderErr || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      // Fetch product
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', order.product_id)
        .single();

      // Fetch baker settings
      const { data: settings } = await supabase
        .from('baker_settings')
        .select('*')
        .eq('baker_id', baker_id)
        .maybeSingle();

      const ovenBcuCapacity = settings?.oven_bcu_capacity ?? 4;
      const chillerBcuCapacity = settings?.chiller_bcu_capacity ?? 8;

      const prep = product?.prep_time || 30;
      const bake = product?.bake_time || 45;
      const cool = product?.cool_time || 60;
      const deliveryTime = order.delivery_time || '15:00';

      // 1. Calculate BCU for dynamic oven & chiller capacity checking
      const getProductBCU = (p: any): number => {
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

      // 2. Fetch same-day approved/production orders to calculate Batching and total load
      const { data: sameDayOrders } = await supabase
        .from('orders')
        .select('*, product:products(*)')
        .eq('baker_id', baker_id)
        .eq('delivery_date', order.delivery_date)
        .in('status', ['approved', 'production'])
        .order('created_at', { ascending: true });

      const validOrders = (sameDayOrders || []).filter(o => o.product_id);

      // Determine batches of baking based on oven capacity
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

      // Check for chiller capacity alerts
      const isChillerOverloaded = totalDayBcu > chillerBcuCapacity;

      // Helper date formatting utilities
      const toTimeStr = (d: Date) => {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      };
      
      const toDateStr = (d: Date) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      // 3. Compute Event Timings backward from requested delivery date & deliveryTime
      const cleanDateStr = typeof order.delivery_date === 'string'
        ? order.delivery_date.substring(0, 10)
        : new Date(order.delivery_date).toISOString().substring(0, 10);
      const readyTime = new Date(`${cleanDateStr}T${deliveryTime}:00`);
      const startCoolTime = new Date(readyTime.getTime() - cool * 60000);

      // Batch baking offset shift (Work backwards: earlier batches get baked earlier to complete on time)
      const batchShiftOffset = (myBatch - 1) * (bake + 10); // 10 min transition buffer
      const startBakeTime = new Date(startCoolTime.getTime() - (bake + batchShiftOffset) * 60000);

      // 4. Proofing Splitter (Task 4.1)
      const proofingTime = ((product?.proofing_time_hours || 0) * 60) + (product?.proofing_time_minutes || 0);
      const isLongProofing = proofingTime >= 240; // 4 hours or more triggers overnight prep shift

      let startPrepTime: Date;
      let prepDate: string;
      let proofingNote = '';

      if (isLongProofing) {
        // Split prep to day before (Ferment overnight)
        const prevDay = new Date(readyTime.getTime() - 86400000);
        prepDate = toDateStr(prevDay);
        // Prepping at 2:00 PM on previous afternoon is standard practice for overnight fermentation
        startPrepTime = new Date(`${prepDate}T14:00:00`);
        proofingNote = `\n\n⚠️ Masa perapan semalaman dikesan (${product?.proofing_time_hours || 0}j ${product?.proofing_time_minutes || 0}m)! Adunan disediakan pada petang hari sebelumnya agar sedia dibakar pagi esok.`;
      } else {
        // Short proofing: remains on the same day
        const startProofingTime = new Date(startBakeTime.getTime() - proofingTime * 60000);
        startPrepTime = new Date(startProofingTime.getTime() - prep * 60000);
        prepDate = toDateStr(startPrepTime);
        if (proofingTime > 0) {
          proofingNote = `\n\n💡 Mengambil kira masa perapan ${proofingTime} minit sebelum pembakaran.`;
        }
      }

      // 5. Stand Mixer washing cleanup buffer note (Task 4.3)
      const bowlCleanup = product?.bowl_cleanup_minutes || 15;
      const cleanUpNote = validOrders.length > 1 
        ? `\n\n🥣 Termasuk 15 minit masa basuh mixer/mangkuk sebelum mula! (Sila basuh & rehatkan mangkuk mixer sebelum adunan ini).` 
        : '';

      // 6. Chiller Overload Alerts warning note
      const chillerAlertNote = isChillerOverloaded
        ? `\n\n⚠️ AMARAN PETI SEJUK PENUH: Jumlah muatan hari ini (${totalDayBcu.toFixed(1)}/${chillerBcuCapacity} BCU). Chiller melebihi had kapasiti Kak Sue! Sila susun kotak dengan berhati-hati.`
        : '';

      // Clean old events if they exist
      if (order.google_prep_event_id) await deleteGoogleEvent(baker_id, order.google_prep_event_id).catch(() => {});
      if (order.google_bake_event_id) await deleteGoogleEvent(baker_id, order.google_bake_event_id).catch(() => {});
      if (order.google_cool_event_id) await deleteGoogleEvent(baker_id, order.google_cool_event_id).catch(() => {});

      // Insert 3 new events to Google Calendar with detailed descriptions
      const prepEventId = await insertGoogleEvent(baker_id, {
        title: `🥣 Prep: ${order.product_name} (x${order.quantity}) - ${order.customer_name}`,
        description: `Fasa penyediaan adunan dan bahan untuk pesanan #${order.order_number}.${proofingNote}${cleanUpNote}`,
        date: prepDate,
        start_time: toTimeStr(startPrepTime),
        duration: prep + (validOrders.length > 1 ? bowlCleanup : 0)
      }).catch(() => null);

      const bakeEventId = await insertGoogleEvent(baker_id, {
        title: `🔥 Bake [Batch ${myBatch}/${batchNumber}]: ${order.product_name} (x${order.quantity})`,
        description: `Fasa pembakaran di dalam oven untuk pesanan #${order.order_number}.\n\n💡 SKE Oven Batching: Pesanan ini disusun di pusingan Batch ${myBatch}/${batchNumber} (Muatan Oven: ${orderBcu.toFixed(1)}/${ovenBcuCapacity} BCU).${chillerAlertNote}`,
        date: toDateStr(startBakeTime),
        start_time: toTimeStr(startBakeTime),
        duration: bake
      }).catch(() => null);

      const coolEventId = await insertGoogleEvent(baker_id, {
        title: `❄️ Cool: ${order.product_name} (x${order.quantity}) - ${order.customer_name}`,
        description: `Fasa penyejukan, pembungkusan & QC untuk pesanan #${order.order_number}.${chillerAlertNote}`,
        date: toDateStr(startCoolTime),
        start_time: toTimeStr(startCoolTime),
        duration: cool
      }).catch(() => null);

      // Save event IDs back to database
      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          google_prep_event_id: prepEventId,
          google_bake_event_id: bakeEventId,
          google_cool_event_id: coolEventId
        })
        .eq('id', order_id);

      if (updateErr) {
        return NextResponse.json({ error: 'Failed to update order event IDs' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        prep_id: prepEventId,
        bake_id: bakeEventId,
        cool_id: coolEventId,
        ske: {
          batch: myBatch,
          total_batches: batchNumber,
          total_day_bcu: totalDayBcu,
          is_chiller_overloaded: isChillerOverloaded,
          is_long_proofing: isLongProofing
        }
      });
    }

    // D. HANDLE DELETE ORDER EVENTS
    if (action === 'delete_order') {
      if (!order_id) {
        return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
      }

      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', order_id)
        .single();

      if (order) {
        if (order.google_prep_event_id) await deleteGoogleEvent(baker_id, order.google_prep_event_id).catch(() => {});
        if (order.google_bake_event_id) await deleteGoogleEvent(baker_id, order.google_bake_event_id).catch(() => {});
        if (order.google_cool_event_id) await deleteGoogleEvent(baker_id, order.google_cool_event_id).catch(() => {});

        await supabase
          .from('orders')
          .update({
            google_prep_event_id: null,
            google_bake_event_id: null,
            google_cool_event_id: null
          })
          .eq('id', order_id);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in secure calendar sync gateway:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
