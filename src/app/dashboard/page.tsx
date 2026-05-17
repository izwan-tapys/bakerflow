'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Order, OrderStatus, Product, BakerSettings } from '@/lib/types';
import { SmartTimeline } from '@/components/dashboard/SmartTimeline';
import { OrderCard } from '@/components/orders/OrderCard';
import { updateOrderStatus } from '@/lib/services/baker.service';
import { formatDate } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { 
  Sun, 
  CloudSun, 
  Moon, 
  Share2, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2,
  TrendingUp,
  Receipt,
  Check
} from 'lucide-react';

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
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'warning' | 'info' | 'danger';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

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
      supabase.from('baker_settings').select('*').eq('baker_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('orders').select('*').eq('baker_id', user.id).eq('delivery_date', today).order('created_at'),
      supabase.from('orders').select('*').eq('baker_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').eq('baker_id', user.id).in('status', ['approved', 'production', 'ready']),
      supabase.from('orders').select('total_amount').eq('baker_id', user.id).eq('payment_status', 'paid').gte('created_at', startOfMonth.toISOString()),
      supabase.from('products').select('*').eq('baker_id', user.id)
    ]);

    if (settingsRes.data && settingsRes.data.length > 0) {
      const activeSettings = settingsRes.data[0];
      setSettings(activeSettings);
      setShopName(activeSettings.shop_name);

      // Clean up duplicate settings under user's authentic context
      if (settingsRes.data.length > 1) {
        const duplicateIds = settingsRes.data.slice(1).map(r => r.id);
        supabase.from('baker_settings').delete().in('id', duplicateIds).then(({ error }) => {
          if (error) console.error('Failed to clean duplicate settings:', error);
          else console.log('Cleaned up duplicate settings rows successfully!');
        });
      }
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
      setConfirmDialog({
        isOpen: true,
        title: 'Restock Required 🚨',
        message: `${result.message}. Nak pergi ke Inventory untuk restock sekarang?`,
        confirmText: 'Go to Inventory',
        cancelText: 'Cancel',
        type: 'warning',
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          window.location.href = '/kitchen/inventory';
        }
      });
      return;
    }
    
    if (result.warning) {
      setConfirmDialog({
        isOpen: true,
        title: 'Order Approved! 🎉',
        message: `${result.warning}. Nak ke page Inventory untuk tengok Shopping List?`,
        confirmText: 'Go to Inventory',
        cancelText: 'Maybe Later',
        type: 'info',
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          window.location.href = '/kitchen/inventory';
        }
      });
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

  const GreetingIcon = () => {
    const hour = new Date().getHours();
    if (hour < 12) return <Sun className="w-3 h-3 text-orange-400" />;
    if (hour < 17) return <CloudSun className="w-3 h-3 text-orange-400" />;
    return <Moon className="w-3 h-3 text-indigo-400" />;
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 bg-muted rounded-xl" />
        <div className="h-32 bg-muted rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md pb-0 -mx-4 px-4 border-b border-primary/5">
        <div className="pt-6 pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GreetingIcon />
              <p className="text-foreground/30 font-black text-[10px] uppercase tracking-[0.2em]">{getGreeting()}</p>
            </div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">{shopName}</h1>
          </div>
          <button 
            onClick={() => {
              const slug = shopName.toLowerCase().replace(/ /g, '-');
              const url = `${window.location.origin}/${slug}`;
              navigator.clipboard.writeText(url);
              alert('Order Link Copied! 🧁\n' + url);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary/5 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95 border border-primary/10"
          >
            <Share2 className="w-3.5 h-3.5" /> Share Link
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-primary via-primary to-primary-dark rounded-xl p-6 text-white shadow-sm relative overflow-hidden group">
        <div className="grid grid-cols-2 gap-4 relative z-10">
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-md border border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Today&apos;s Orders</p>
            <p className="text-2xl font-black">{todayOrders.length}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-md border border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">To Collect</p>
            <p className="text-2xl font-black text-green-300">RM {todayCollection.toFixed(2)}</p>
          </div>
        </div>

        {nextTask && (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase opacity-60">Next Action</p>
              <p className="font-bold text-sm">Prep {nextTask.product.name} at {nextTask.startPrep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl p-4 border border-primary/5 shadow-sm">
          <p className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] mb-2">Monthly Sales</p>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <p className="text-xl font-black text-primary tracking-tight">RM {monthlyRevenue.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-primary/5 shadow-sm flex flex-col justify-center items-center gap-2">
          <Link href="/dashboard/planner" className="w-full text-center text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-3 py-2 rounded-lg hover:bg-primary hover:text-white transition-all border border-primary/10 flex items-center justify-center gap-2">
            <Calendar className="w-3.5 h-3.5" /> Planner
          </Link>
        </div>
      </div>

      {/* Today's Agenda Summary */}
      <div className="bg-card rounded-xl p-6 border border-primary/5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-foreground flex items-center gap-2">
            Today&apos;s Agenda
            <span className="bg-primary/5 text-primary text-[10px] px-2 py-0.5 rounded-full uppercase font-black tracking-widest border border-primary/10">Timeline</span>
          </h2>
        </div>

        {schedule.length === 0 ? (
          <div className="text-center py-10 bg-muted/20 rounded-xl border-2 border-dashed border-primary/10">
            <CheckCircle2 className="w-10 h-10 text-primary/20 mx-auto mb-2" />
            <p className="text-sm font-bold text-foreground/40 italic">Nothing scheduled for today yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedule.slice(0, 3).map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-primary/5 last:border-0 group">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/5 flex flex-col items-center justify-center border border-primary/10 group-hover:bg-primary transition-colors">
                    <p className="text-[10px] font-black text-primary group-hover:text-white">{item.startPrep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div>
                    <p className="font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">{item.product.name}</p>
                    <p className="text-xs font-medium text-foreground/40 italic">For {item.customer_name}</p>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                  item.status === 'pending' ? 'bg-orange-500/5 text-orange-600 border-orange-500/10' : 'bg-green-500/5 text-green-600 border-green-500/10'
                }`}>
                  {item.status}
                </div>
              </div>
            ))}
            {schedule.length > 3 && (
              <Link href="/dashboard/planner" className="block text-center text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 hover:text-primary transition-all pt-2">
                + Explore Full Planner
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Pending Approval Section */}
      {pendingOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-black text-foreground flex items-center gap-2">
            <div className="p-1.5 bg-red-500/10 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            Needs Attention
            <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full tracking-tighter shadow-sm">{pendingOrders.length}</span>
          </h2>
          <div className="space-y-3">
            {pendingOrders.map(order => (
              <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} onRefresh={loadDashboardData} />
            ))}
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {pendingOrders.length === 0 && productionOrders.length === 0 && schedule.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <div className="relative inline-block">
            <CheckCircle2 className="w-12 h-12 text-primary opacity-10 mx-auto" />
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Check className="w-5 h-5 text-primary" />
            </motion.div>
          </div>
          <p className="text-foreground/40 font-bold uppercase tracking-[0.2em] text-[10px]">All clear! No pending tasks.</p>
        </div>
      )}

      {/* Modern Premium Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
