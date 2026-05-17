'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Order, Product, BakerSettings } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { Calendar, ChefHat, Moon, Clock, CalendarDays, Trash2, Sparkles } from 'lucide-react';
import { Toast } from '@/components/ui/Toast';

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
  const [overrideData, setOverrideData] = useState<{
    id?: string;
    isBlocked: boolean;
    customCapacity: number;
    reason: string;
  } | null>(null);
  const [savingOverride, setSavingOverride] = useState(false);
  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type?: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    message: '',
    type: 'success'
  });
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

    // Helper async function to fetch blocked date defensively and resolve PostgrestBuilder .catch type checking
    const getBlockedDate = async () => {
      try {
        const { data, error } = await supabase
          .from('baker_blocked_dates')
          .select('*')
          .eq('baker_id', user.id)
          .eq('blocked_date', selectedDate)
          .maybeSingle();
        if (error) return null;
        return data;
      } catch (e) {
        return null;
      }
    };

    const [settingsRes, ordersRes, productsRes, blockedData] = await Promise.all([
      supabase.from('baker_settings').select('*').eq('baker_id', user.id).single(),
      supabase.from('orders').select('*').eq('baker_id', user.id).eq('delivery_date', selectedDate).in('status', ['pending', 'approved', 'production', 'ready', 'otw']),
      supabase.from('products').select('*').eq('baker_id', user.id),
      getBlockedDate()
    ]);

    setSettings(settingsRes.data);
    setOrders(ordersRes.data || []);
    setProducts(productsRes.data || []);

    if (blockedData) {
      setOverrideData({
        id: blockedData.id,
        isBlocked: blockedData.custom_capacity === 0 || blockedData.custom_capacity === null,
        customCapacity: blockedData.custom_capacity !== null && blockedData.custom_capacity !== 0 ? blockedData.custom_capacity : (settingsRes.data?.daily_capacity || 5),
        reason: blockedData.reason || ''
      });
    } else {
      setOverrideData({
        isBlocked: false,
        customCapacity: settingsRes.data?.daily_capacity || 5,
        reason: ''
      });
    }

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

  const handleSaveOverride = async () => {
    setSavingOverride(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User session not found');

      const payload: any = {
        baker_id: user.id,
        blocked_date: selectedDate,
        reason: overrideData?.reason || '',
      };

      if (overrideData?.isBlocked) {
        payload.custom_capacity = 0; // Closed / 0 slots
      } else {
        payload.custom_capacity = overrideData?.customCapacity ?? settings?.daily_capacity ?? 5;
      }

      if (overrideData?.id) {
        payload.id = overrideData.id;
      }

      const { data, error } = await supabase
        .from('baker_blocked_dates')
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setOverrideData({
          id: data.id,
          isBlocked: data.custom_capacity === 0 || data.custom_capacity === null,
          customCapacity: data.custom_capacity !== null && data.custom_capacity !== 0 ? data.custom_capacity : (settings?.daily_capacity || 5),
          reason: data.reason || ''
        });
        
        setToast({
          isOpen: true,
          message: 'Had slot/cuti berjaya dikemas kini! 📅',
          type: 'success'
        });
      }
    } catch (err: any) {
      setToast({
        isOpen: true,
        message: err.message || 'Gagal menyimpan tetapan. Pastikan jadual database telah dicipta.',
        type: 'error'
      });
    } finally {
      setSavingOverride(false);
    }
  };

  const handleResetOverride = async () => {
    if (!overrideData?.id) return;
    setSavingOverride(true);
    try {
      const { error } = await supabase
        .from('baker_blocked_dates')
        .delete()
        .eq('id', overrideData.id);

      if (error) throw error;

      setOverrideData({
        isBlocked: false,
        customCapacity: settings?.daily_capacity || 5,
        reason: ''
      });

      setToast({
        isOpen: true,
        message: 'Kembali kepada tetapan default dapur! 🟢',
        type: 'success'
      });
    } catch (err: any) {
      setToast({
        isOpen: true,
        message: err.message || 'Gagal mereset tetapan.',
        type: 'error'
      });
    } finally {
      setSavingOverride(false);
    }
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
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-extrabold text-foreground">Planner</h1>
              <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Schedule for {formatDate(selectedDate)}</p>
            </div>
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
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-6 text-white shadow-lg shadow-orange-200">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <ChefHat className="w-10 h-10 text-white" />
            </div>
            <div>
              <p className="text-xs font-black uppercase opacity-70 tracking-widest">Today&apos;s Goal</p>
              <h2 className="text-xl font-black">Start Production at <span className="underline decoration-yellow-300">{schedule[0].prepStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></h2>
              <p className="text-sm opacity-80 font-bold">Total {schedule.length} orders to prepare.</p>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Window Setting */}
      {settings && (
        <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 flex items-center justify-between">
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

      {/* Google Calendar-style Capacity & Holiday Override Panel */}
      {overrideData && (
        <div className="bg-card rounded-2xl p-5 border border-muted/60 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-xl border ${
                overrideData.isBlocked 
                  ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                  : overrideData.customCapacity !== settings?.daily_capacity 
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' 
                    : 'bg-green-500/10 border-green-500/20 text-green-500'
              }`}>
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-foreground text-sm tracking-tight">Capacity & Holiday Control</h3>
                <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest mt-0.5">
                  Status: {
                    overrideData.isBlocked 
                      ? '🔴 Closed (0 Slots)' 
                      : overrideData.customCapacity !== settings?.daily_capacity 
                        ? `🟡 Custom Limit (${overrideData.customCapacity} Slots)` 
                        : `🟢 Open Default (${settings?.daily_capacity || 5} Slots)`
                  }
                </p>
              </div>
            </div>
            
            {overrideData.id && (
              <button
                disabled={savingOverride}
                onClick={handleResetOverride}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/5 hover:bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-red-500/10 active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Reset Default
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Mark Closed Button */}
            <button
              type="button"
              disabled={savingOverride}
              onClick={() => setOverrideData(prev => prev ? { ...prev, isBlocked: !prev.isBlocked } : null)}
              className={`py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all border flex items-center justify-center gap-2 ${
                overrideData.isBlocked
                  ? 'bg-red-500 border-red-600 text-white shadow-lg shadow-red-200'
                  : 'bg-muted/40 border-muted text-foreground/70 hover:bg-muted/60'
              }`}
            >
              🚪 {overrideData.isBlocked ? 'CLOSED (Holiday)' : 'Close this date'}
            </button>

            {/* Custom Capacity Stepper */}
            <div className={`flex items-center justify-between p-1 border rounded-xl bg-muted/20 ${
              overrideData.isBlocked ? 'opacity-40 pointer-events-none' : 'border-muted'
            }`}>
              <button
                type="button"
                disabled={overrideData.isBlocked || overrideData.customCapacity <= 1 || savingOverride}
                onClick={() => setOverrideData(prev => prev ? { ...prev, customCapacity: Math.max(1, prev.customCapacity - 1) } : null)}
                className="w-10 h-10 bg-card rounded-lg flex items-center justify-center font-bold text-lg text-foreground/60 border border-muted/50 hover:bg-muted/20 active:scale-95 transition-all"
              >
                −
              </button>
              <div className="text-center flex-1">
                <span className="text-sm font-black text-foreground block leading-none">{overrideData.customCapacity}</span>
                <span className="text-[8px] text-foreground/40 font-bold uppercase tracking-widest mt-0.5 block">Slots</span>
              </div>
              <button
                type="button"
                disabled={overrideData.isBlocked || overrideData.customCapacity >= 50 || savingOverride}
                onClick={() => setOverrideData(prev => prev ? { ...prev, customCapacity: Math.min(50, prev.customCapacity + 1) } : null)}
                className="w-10 h-10 bg-card rounded-lg flex items-center justify-center font-bold text-lg text-foreground/60 border border-muted/50 hover:bg-muted/20 active:scale-95 transition-all"
              >
                +
              </button>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-foreground/40 tracking-widest">
              Sebab Cuti / Nota (Papar di storefront pembeli)
            </label>
            <input
              type="text"
              placeholder="e.g. Cuti Raya Haji, Rehat weekend, Tempahan besar..."
              disabled={savingOverride}
              value={overrideData.reason}
              onChange={e => setOverrideData(prev => prev ? { ...prev, reason: e.target.value } : null)}
              className="w-full h-11 px-4 rounded-xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-xs font-semibold placeholder:text-foreground/20"
            />
          </div>

          {/* Save Action */}
          <button
            type="button"
            disabled={savingOverride}
            onClick={handleSaveOverride}
            className="w-full h-11 bg-primary hover:bg-primary/95 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md shadow-primary/10 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {savingOverride ? 'Saving...' : 'Save Capacity Changes'} <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : schedule.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed border-muted">
          <div className="flex justify-center mb-4 text-muted">
            <Moon className="w-12 h-12" />
          </div>
          <p className="font-bold text-foreground">No orders for this date.</p>
          <p className="text-sm text-foreground/40">You can rest well tonight!</p>
        </div>
      ) : (
        <div className="space-y-4 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-0.5 before:bg-muted">
          {schedule.map((item, idx) => (
            <div key={idx} className="relative pl-12 space-y-3">
              {/* Dot */}
              <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-card border-4 border-primary flex items-center justify-center z-10 shadow-sm">
                <span className="text-xs font-black text-primary">{idx + 1}</span>
              </div>

              <div className="bg-card rounded-xl p-4 border border-muted/50 shadow-sm space-y-4 hover:border-primary/30 transition-colors">
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
          className="fixed bottom-6 left-6 right-6 h-14 bg-green-500 text-white rounded-xl font-bold shadow-xl shadow-green-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <span>💬</span> Send Schedule to WhatsApp
        </button>
      )}

      {/* Modern Premium Toast */}
      {toast.isOpen && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(prev => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
}
