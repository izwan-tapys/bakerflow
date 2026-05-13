'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Order, OrderStatus } from '@/lib/types';
import { updateOrderStatus } from '@/lib/services/baker.service';

function ProductionCard({ order, onStatusChange }: { order: Order; onStatusChange: (id: string, s: OrderStatus) => void }) {
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
            {new Date(order.delivery_date).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-foreground/50 text-xs font-medium">Payment</p>
          <p className={`font-bold mt-0.5 ${order.payment_status === 'paid' ? 'text-green-600' : 'text-orange-500'}`}>
            {order.payment_status === 'paid' ? '✅ Paid' : '⏳ Pending'}
          </p>
        </div>
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
    await updateOrderStatus(orderId, status);
    loadOrders();
  };

  const queued = orders.filter(o => o.status === 'approved');
  const baking = orders.filter(o => o.status === 'production');
  const ready = orders.filter(o => o.status === 'ready');

  return (
    <div className="space-y-6 pb-4">
      <KitchenTabs />

      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Kitchen 🍳</h1>
        <p className="text-foreground/50 text-sm">Track your production workflow</p>
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <div className="text-5xl">🎉</div>
          <p className="text-foreground/50 font-medium">Kitchen is clear!</p>
          <p className="text-foreground/40 text-sm">No active production tasks right now.</p>
        </div>
      ) : (
        <>
          {baking.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                🔥 Currently Baking
                <span className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full font-bold">{baking.length}</span>
              </h2>
              {baking.map(o => <ProductionCard key={o.id} order={o} onStatusChange={handleStatusChange} />)}
            </section>
          )}

          {queued.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                📋 Queued
                <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full font-bold">{queued.length}</span>
              </h2>
              {queued.map(o => <ProductionCard key={o.id} order={o} onStatusChange={handleStatusChange} />)}
            </section>
          )}

          {ready.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                ✅ Ready for Pickup/Delivery
                <span className="bg-green-100 text-green-600 text-xs px-2 py-0.5 rounded-full font-bold">{ready.length}</span>
              </h2>
              {ready.map(o => <ProductionCard key={o.id} order={o} onStatusChange={handleStatusChange} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
