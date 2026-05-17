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

    // C. HANDLE SYNC ORDER (PREP, BAKE, COOL PHASES)
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

      const prep = product?.prep_time || 30;
      const bake = product?.bake_time || 45;
      const cool = product?.cool_time || 60;
      const deliveryTime = order.delivery_time || '15:00';

      // Parse ready time
      const readyTime = new Date(`${order.delivery_date}T${deliveryTime}:00`);
      const startCoolTime = new Date(readyTime.getTime() - cool * 60000);
      const startBakeTime = new Date(startCoolTime.getTime() - bake * 60000);
      const startPrepTime = new Date(startBakeTime.getTime() - prep * 60000);

      const toTimeStr = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      const toDateStr = (d: Date) => {
        const offset = d.getTimezoneOffset();
        const localD = new Date(d.getTime() - (offset * 60 * 1000));
        return localD.toISOString().split('T')[0];
      };

      // Clean old events if they exist
      if (order.google_prep_event_id) await deleteGoogleEvent(baker_id, order.google_prep_event_id).catch(() => {});
      if (order.google_bake_event_id) await deleteGoogleEvent(baker_id, order.google_bake_event_id).catch(() => {});
      if (order.google_cool_event_id) await deleteGoogleEvent(baker_id, order.google_cool_event_id).catch(() => {});

      // Insert 3 new events
      const prepEventId = await insertGoogleEvent(baker_id, {
        title: `🥣 Prep: ${order.product_name} (x${order.quantity}) - ${order.customer_name}`,
        description: `Fasa penyediaan adunan dan bahan untuk pesanan #${order.order_number}.`,
        date: toDateStr(startPrepTime),
        start_time: toTimeStr(startPrepTime),
        duration: prep
      }).catch(() => null);

      const bakeEventId = await insertGoogleEvent(baker_id, {
        title: `🔥 Bake: ${order.product_name} (x${order.quantity}) - ${order.customer_name}`,
        description: `Fasa pembakaran di dalam oven untuk pesanan #${order.order_number}.`,
        date: toDateStr(startBakeTime),
        start_time: toTimeStr(startBakeTime),
        duration: bake
      }).catch(() => null);

      const coolEventId = await insertGoogleEvent(baker_id, {
        title: `❄️ Cool: ${order.product_name} (x${order.quantity}) - ${order.customer_name}`,
        description: `Fasa penyejukan, pembungkusan & QC untuk pesanan #${order.order_number}.`,
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
        cool_id: coolEventId
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
