'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Order, OrderStatus } from '@/lib/types';
import { updateOrderStatus } from '@/lib/services/baker.service';
import { formatDate } from '@/lib/utils';

function ProductionCard({ order, onStatusChange, onRefresh }: { order: Order; onStatusChange: (id: string, s: OrderStatus) => void; onRefresh?: () => void }) {
  const nextStatus: Record<string, { label: string; status: OrderStatus; color: string }> = {
    approved: { label: 'Start Baking 🔥', status: 'production', color: 'bg-orange-500' },
    production: { label: 'Mark as Ready ✅', status: 'ready', color: 'bg-green-600' },
    ready: { label: 'Out for Delivery 🚗', status: 'otw', color: 'bg-blue-600' },
  };

  const next = nextStatus[order.status];

  return (
    <div className="bg-white rounded-2xl p-5 border-2 border-muted/50 space-y-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-extrabold text-foreground text-lg">{order.product_name}</p>
          <p className="text-sm text-foreground/60">× {order.quantity} • For {order.customer_name}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
          order.status === 'approved' ? 'bg-blue-500' :
          order.status === 'production' ? 'bg-orange-500' :
          'bg-green-600'
        }`}>
          {order.status === 'approved' ? 'Queued' :
           order.status === 'production' ? 'Baking 🔥' : 'Ready ✅'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-foreground/50 text-xs font-medium">Delivery Date</p>
          <p className="font-bold text-foreground mt-0.5">
            {formatDate(order.delivery_date)}
          </p>
        </div>
        <button 
          onClick={async () => {
            const newStatus = order.payment_status === 'paid' ? 'unpaid' : 'paid';
            const { updatePaymentStatus } = await import('@/lib/services/baker.service');
            const success = await updatePaymentStatus(order.id!, newStatus);
            if (success && onRefresh) onRefresh();
            else if (success) onStatusChange(order.id!, order.status);
          }}
          className={`rounded-xl p-3 text-left transition-colors border-2 ${
            order.payment_status === 'paid' ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200 hover:bg-orange-100'
          }`}
        >
          <p className={`text-xs font-bold uppercase ${order.payment_status === 'paid' ? 'text-green-700/60' : 'text-orange-700/60'}`}>Payment</p>
          <p className={`font-black mt-0.5 ${order.payment_status === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>
            {order.payment_status === 'paid' ? '✅ Paid' : '⏳ Mark Paid'}
          </p>
        </button>
      </div>

      {order.special_notes && (
        <div className="bg-accent/10 rounded-xl p-3 text-sm text-foreground/70">
          📝 <span className="font-medium">{order.special_notes}</span>
        </div>
      )}

      {/* WhatsApp Button */}
      <a
        href={`https://wa.me/60${order.customer_phone?.replace(/^0/, '')}?text=${encodeURIComponent(
          `Hi ${order.customer_name}! 👋 Your order of *${order.product_name}* (×${order.quantity}) is now ${
            order.status === 'production' ? 'being baked 🔥' : 'ready for delivery ✅'
          }. Thank you for ordering from us! 🎂`
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-green-50 text-green-700 font-semibold text-sm hover:bg-green-100 transition-colors"
      >
        <span>💬</span> WhatsApp Customer
      </a>

      {next && (
        <button
          onClick={() => onStatusChange(order.id!, next.status)}
          className={`w-full h-12 rounded-xl text-white font-bold transition-all hover:scale-[1.02] active:scale-95 ${next.color}`}
        >
          {next.label}
        </button>
      )}
    </div>
  );
}

import { KitchenTabs } from '@/components/dashboard/KitchenTabs';

export default function ProductionPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('baker_id', user.id)
      .in('status', ['approved', 'production', 'ready'])
      .order('delivery_date', { ascending: true });

    setOrders(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    const result = await updateOrderStatus(orderId, status);
    if (!result.success) {
      if (confirm(`${result.message}\n\nNak pergi ke Inventory untuk restock sekarang?`)) {
        window.location.href = '/dashboard/inventory';
      }
      return;
    }
    loadOrders();
  };

  const [activeTab, setActiveTab] = useState<'queued' | 'baking' | 'ready'>('baking');
  const scrollRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      node.addEventListener('scroll', () => {
        const index = Math.round(node.scrollLeft / node.clientWidth);
        const tabs: ('queued' | 'baking' | 'ready')[] = ['baking', 'queued', 'ready'];
        if (tabs[index]) setActiveTab(tabs[index]);
      }, { passive: true });
    }
  }, []);

  const scrollToTab = (tab: 'queued' | 'baking' | 'ready') => {
    const node = document.getElementById('production-scroll-container');
    if (!node) return;
    const tabs = ['baking', 'queued', 'ready'];
    const index = tabs.indexOf(tab);
    node.scrollTo({ left: index * node.clientWidth, behavior: 'smooth' });
    setActiveTab(tab);
  };

  const queued = orders.filter(o => o.status === 'approved');
  const baking = orders.filter(o => o.status === 'production');
  const ready = orders.filter(o => o.status === 'ready');

  // Sort baking to show first since it's most active
  const sections = [
    { id: 'baking' as const, label: '🔥 Baking', count: baking.length, data: baking, empty: 'No items in the oven.' },
    { id: 'queued' as const, label: '📋 Queued', count: queued.length, data: queued, empty: 'No queued orders.' },
    { id: 'ready' as const, label: '✅ Ready', count: ready.length, data: ready, empty: 'Nothing ready yet.' }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden -m-6 p-6 space-y-6">
      <div className="flex-none space-y-4">
        <KitchenTabs />
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Kitchen 🍳</h1>
          <p className="text-foreground/50 text-sm">Track your production workflow</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-muted/50 p-1 rounded-2xl border border-muted/50">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => scrollToTab(s.id)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                activeTab === s.id ? 'bg-white text-primary shadow-sm scale-[1.02]' : 'text-foreground/40'
              }`}
            >
              {s.label}
              {s.count > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === s.id ? 'bg-primary/10 text-primary' : 'bg-foreground/10 text-foreground/40'}`}>{s.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />)}</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <div className="text-5xl">🎉</div>
            <p className="text-foreground/50 font-medium">Kitchen is clear!</p>
            <p className="text-foreground/40 text-sm">No active production tasks right now.</p>
          </div>
        ) : (
          <div 
            id="production-scroll-container"
            ref={scrollRef}
            className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth"
          >
            {sections.map(s => (
              <div key={s.id} className="w-full h-full flex-none snap-center px-0.5">
                <div className="h-full overflow-y-auto pr-1 space-y-4 pb-20 no-scrollbar">
                  {s.data.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-foreground/20 space-y-2 grayscale opacity-50">
                      <div className="text-4xl">{s.id === 'baking' ? '🔥' : s.id === 'queued' ? '📋' : '✅'}</div>
                      <p className="text-xs font-bold uppercase tracking-widest">{s.empty}</p>
                    </div>
                  ) : (
                    s.data.map(o => <ProductionCard key={o.id} order={o} onStatusChange={handleStatusChange} onRefresh={loadOrders} />)
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
