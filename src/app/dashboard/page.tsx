'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Order, OrderStatus, Product, BakerSettings } from '@/lib/types';
import { SmartTimeline } from '@/components/dashboard/SmartTimeline';
import { OrderCard } from '@/components/orders/OrderCard';
import { updateOrderStatus } from '@/lib/services/baker.service';
import { formatDate } from '@/lib/utils';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState('Baker');
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [productionOrders, setProductionOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<BakerSettings | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);

  const loadDashboardData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const today = new Date().toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [settingsRes, todayRes, pendingRes, productionRes, revenueRes, productsRes] = await Promise.all([
      supabase.from('baker_settings').select('*').eq('baker_id', user.id).limit(1).single(),
      supabase.from('orders').select('*').eq('baker_id', user.id).eq('delivery_date', today).order('created_at'),
      supabase.from('orders').select('*').eq('baker_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').eq('baker_id', user.id).in('status', ['approved', 'production', 'ready']),
      supabase.from('orders').select('total_amount').eq('baker_id', user.id).eq('payment_status', 'paid').gte('created_at', startOfMonth.toISOString()),
      supabase.from('products').select('*').eq('baker_id', user.id)
    ]);

    if (settingsRes.data) {
      setSettings(settingsRes.data);
      setShopName(settingsRes.data.shop_name);
    }
    
    if (productsRes.data) setProducts(productsRes.data);
    if (todayRes.data) setTodayOrders(todayRes.data);
    if (pendingRes.data) setPendingOrders(pendingRes.data);
    if (productionRes.data) setProductionOrders(productionRes.data);
    if (revenueRes.data) {
      const total = revenueRes.data.reduce((sum: number, o: { total_amount: number }) => sum + (o.total_amount || 0), 0);
      setMonthlyRevenue(total);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    const result = await updateOrderStatus(orderId, status);
    if (!result.success) {
      if (confirm(`${result.message}\n\nNak pergi ke Inventory untuk restock sekarang?`)) {
        window.location.href = '/kitchen/inventory';
      }
      return;
    }
    
    if (result.warning) {
      if (confirm(`${result.warning}\n\nOrder telah di-approve. Nak ke page Inventory untuk tengok Shopping List?`)) {
        window.location.href = '/kitchen/inventory';
      }
    }
    loadDashboardData(); // Refresh
  };

  const todayCollection = todayOrders
    .filter(o => o.payment_status !== 'paid')
    .reduce((sum, o) => sum + o.total_amount, 0);

  const allOrdersForTimeline = [...todayOrders, ...productionOrders];

  const schedule = todayOrders.map(order => {
    const product = products.find(p => p.id === order.product_id);
    if (!product) return null;
    const deadline = settings?.delivery_start_time || '15:00';
    const [deadH, deadM] = deadline.split(':').map(Number);
    const readyTime = new Date();
    readyTime.setHours(deadH, deadM, 0, 0);

    const startCool = new Date(readyTime.getTime() - (product.cool_time || 60) * 60000);
    const startBake = new Date(startCool.getTime() - (product.bake_time || 45) * 60000);
    const startPrep = new Date(startBake.getTime() - (product.prep_time || 30) * 60000);

    return { ...order, product, startPrep, startBake, readyTime };
  }).filter(Boolean).sort((a: any, b: any) => a.startPrep.getTime() - b.startPrep.getTime());

  const nextTask = (schedule as any[]).find(s => s.startPrep > new Date());

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 bg-muted rounded-2xl" />
        <div className="h-32 bg-muted rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="pt-6 pb-4">
          <p className="text-foreground/30 font-black text-[10px] uppercase tracking-[0.2em] mb-1">Morning Briefing ☀️</p>
          <h1 className="text-2xl font-black text-foreground">Good Morning, {shopName}!</h1>
        </div>
      </div>
      <div className="bg-gradient-to-br from-primary to-primary-dark rounded-3xl p-6 text-white shadow-xl shadow-primary/20">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm border border-white/10">
            <p className="text-[10px] font-bold uppercase opacity-60">Today&apos;s Orders</p>
            <p className="text-xl font-black">{todayOrders.length}</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm border border-white/10">
            <p className="text-[10px] font-bold uppercase opacity-60">To Collect</p>
            <p className="text-xl font-black text-green-300">RM {todayCollection.toFixed(2)}</p>
          </div>
        </div>

        {nextTask && (
          <div className="mt-5 pt-5 border-t border-white/10 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-xl animate-bounce">⏰</div>
            <div>
              <p className="text-[10px] font-bold uppercase opacity-60">Next Action</p>
              <p className="font-black text-sm">Prep {nextTask.product.name} at {nextTask.startPrep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-muted/50 shadow-sm">
          <p className="text-[10px] font-black text-foreground/30 uppercase tracking-widest mb-1">Monthly Sales</p>
          <p className="text-2xl font-black text-primary">RM {monthlyRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-muted/50 shadow-sm flex flex-col justify-center items-center gap-1">
          <Link href="/dashboard/planner" className="text-xs font-bold text-primary bg-primary/5 px-4 py-2 rounded-xl hover:bg-primary/10 transition-all">
            View Full Schedule 📅
          </Link>
        </div>
      </div>

      {/* Today's Agenda Summary */}
      <div className="bg-white rounded-3xl p-5 border border-muted/50 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-foreground flex items-center gap-2">
            Today&apos;s Agenda
            <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full uppercase font-black">Timeline</span>
          </h2>
        </div>

        {schedule.length === 0 ? (
          <div className="text-center py-10 bg-muted/5 rounded-2xl border-2 border-dashed border-muted">
            <p className="text-sm font-bold text-foreground/40 italic">Nothing scheduled for today yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedule.slice(0, 3).map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-muted last:border-0">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-muted/30 flex flex-col items-center justify-center">
                    <p className="text-[10px] font-black text-primary">{item.startPrep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div>
                    <p className="font-bold text-foreground leading-tight">{item.product.name}</p>
                    <p className="text-xs text-foreground/40">For {item.customer_name}</p>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${
                  item.status === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                }`}>
                  {item.status}
                </div>
              </div>
            ))}
            {schedule.length > 3 && (
              <Link href="/dashboard/planner" className="block text-center text-xs font-bold text-primary/60 hover:text-primary transition-colors pt-2">
                + See {schedule.length - 3} more tasks in Planner
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Pending Approval Section */}
      {pendingOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-black text-foreground flex items-center gap-2">
            🚨 Needs Attention
            <span className="bg-red-100 text-red-600 text-xs font-black px-2 py-0.5 rounded-full tracking-tighter">{pendingOrders.length}</span>
          </h2>
          {pendingOrders.map(order => (
            <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} onRefresh={loadDashboardData} />
          ))}
        </div>
      )}
      
      {/* Empty State */}
      {pendingOrders.length === 0 && productionOrders.length === 0 && schedule.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <div className="text-5xl">🎉</div>
          <p className="text-foreground/60 font-medium">All clear! No pending tasks.</p>
        </div>
      )}
    </div>
  );
}
