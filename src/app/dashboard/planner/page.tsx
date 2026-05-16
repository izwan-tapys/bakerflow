'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Order, Product, BakerSettings } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface Task {
  id: string;
  orderNumber: string;
  customer: string;
  product: string;
  quantity: number;
  startTime: string;
  bakeTime: string;
  readyTime: string;
  type: 'prep' | 'bake' | 'cool' | 'delivery';
  duration: number;
}

export default function PlannerPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<BakerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const getLocalDate = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toLocaleDateString('en-CA');
  };

  const [selectedDate, setSelectedDate] = useState(getLocalDate(1)); // Default Tomorrow

  const loadPlannerData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [settingsRes, ordersRes, productsRes] = await Promise.all([
      supabase.from('baker_settings').select('*').eq('baker_id', user.id).single(),
      supabase.from('orders').select('*').eq('baker_id', user.id).eq('delivery_date', selectedDate).in('status', ['pending', 'approved', 'production', 'ready', 'otw']),
      supabase.from('products').select('*').eq('baker_id', user.id)
    ]);

    setSettings(settingsRes.data);
    setOrders(ordersRes.data || []);
    setProducts(productsRes.data || []);
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { loadPlannerData(); }, [loadPlannerData]);

  const updateDeliveryWindow = async (start: string, end: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase.from('baker_settings')
      .update({ delivery_start_time: start, delivery_end_time: end })
      .eq('baker_id', user.id);
    
    setSettings(prev => prev ? { ...prev, delivery_start_time: start, delivery_end_time: end } : null);
  };

  // Generate Timeline
  const generateSchedule = () => {
    if (orders.length === 0) return [];

    const deadline = settings?.delivery_start_time || '15:00'; // e.g. "15:00"
    const [deadH, deadM] = deadline.split(':').map(Number);
    const deadlineDate = new Date();
    deadlineDate.setHours(deadH, deadM, 0, 0);

    const schedule: any[] = [];

    orders.forEach(order => {
      const product = products.find(p => p.id === order.product_id);
      if (!product) return;

      const prep = product.prep_time || 30;
      const bake = product.bake_time || 45;
      const cool = product.cool_time || 60;

      // Calculate backwards
      const readyTime = new Date(deadlineDate);
      const startCoolTime = new Date(readyTime.getTime() - cool * 60000);
      const startBakeTime = new Date(startCoolTime.getTime() - bake * 60000);
      const startPrepTime = new Date(startBakeTime.getTime() - prep * 60000);

      schedule.push({
        orderId: order.id,
        customer: order.customer_name,
        product: product.name,
        qty: order.quantity,
        prepStart: startPrepTime,
        bakeStart: startBakeTime,
        coolStart: startCoolTime,
        ready: readyTime
      });
    });

    // Sort by earliest prep start
    return schedule.sort((a, b) => a.prepStart.getTime() - b.prepStart.getTime());
  };

  const schedule = generateSchedule();

  return (
    <div className="space-y-6 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="flex items-center justify-between pt-6 pb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Planner 📅</h1>
            <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Automated schedule for {formatDate(selectedDate)}</p>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="h-10 px-3 rounded-xl border-2 border-muted font-bold text-sm focus:border-primary outline-none"
          />
        </div>
      </div>

      {schedule.length > 0 && (
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl p-6 text-white shadow-lg shadow-orange-200">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl">👨‍🍳</div>
            <div>
              <p className="text-xs font-black uppercase opacity-70 tracking-widest">Today's Goal</p>
              <h2 className="text-xl font-black">Start Production at <span className="underline decoration-yellow-300">{schedule[0].prepStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></h2>
              <p className="text-sm opacity-80 font-bold">Total {schedule.length} orders to prepare.</p>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Window Setting */}
      {settings && (
        <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-primary tracking-widest">Delivery Window</p>
            <p className="font-bold text-foreground">{settings.delivery_start_time} - {settings.delivery_end_time}</p>
          </div>
          <div className="flex gap-2">
            <input 
              type="time" 
              value={settings.delivery_start_time} 
              onChange={e => updateDeliveryWindow(e.target.value, settings.delivery_end_time)}
              className="h-8 px-2 rounded-lg border border-primary/20 text-xs font-bold"
            />
            <span className="text-primary/30 self-center">to</span>
            <input 
              type="time" 
              value={settings.delivery_end_time} 
              onChange={e => updateDeliveryWindow(settings.delivery_start_time, e.target.value)}
              className="h-8 px-2 rounded-lg border border-primary/20 text-xs font-bold"
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />)}</div>
      ) : schedule.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed border-muted">
          <p className="text-4xl mb-4">🌙</p>
          <p className="font-bold text-foreground">No orders for this date.</p>
          <p className="text-sm text-foreground/40">You can rest well tonight!</p>
        </div>
      ) : (
        <div className="space-y-4 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-0.5 before:bg-muted">
          {schedule.map((item, idx) => (
            <div key={idx} className="relative pl-12 space-y-3">
              {/* Dot */}
              <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-white border-4 border-primary flex items-center justify-center z-10 shadow-sm">
                <span className="text-xs font-black text-primary">{idx + 1}</span>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-muted/50 shadow-sm space-y-4 hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-black text-lg text-foreground leading-tight">{item.customer}</p>
                    <p className="text-sm font-bold text-primary">{item.product} × {item.qty}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-foreground/30 uppercase">Deadline</p>
                    <p className="font-black text-primary">{item.ready.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-orange-50 rounded-xl p-2 border border-orange-100">
                    <p className="text-[9px] font-black text-orange-400 uppercase">1. Prep</p>
                    <p className="font-bold text-orange-700 text-xs">{item.prepStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-2 border border-red-100">
                    <p className="text-[9px] font-black text-red-400 uppercase">2. Bake</p>
                    <p className="font-bold text-red-700 text-xs">{item.bakeStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-2 border border-blue-100">
                    <p className="text-[9px] font-black text-blue-400 uppercase">3. Cool</p>
                    <p className="font-bold text-blue-700 text-xs">{item.coolStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {schedule.length > 0 && (
        <button 
          onClick={() => {
            const text = `📅 *BakersBestie Task List (${formatDate(selectedDate)})*\n\n` + 
              schedule.map((item, i) => 
                `${i+1}. *${item.customer}* (${item.product})\n` +
                `   🥣 Prep: ${item.prepStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n` +
                `   🔥 Bake: ${item.bakeStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n` +
                `   ✅ Ready: ${item.ready.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              ).join('\n\n');
            
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          }}
          className="fixed bottom-6 left-6 right-6 h-14 bg-green-500 text-white rounded-2xl font-bold shadow-xl shadow-green-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <span>💬</span> Send Schedule to WhatsApp
        </button>
      )}
    </div>
  );
}
