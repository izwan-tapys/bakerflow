'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Order, OrderStatus } from '@/lib/types';
import { OrderCard } from '@/components/orders/OrderCard';
import { updateOrderStatus } from '@/lib/services/baker.service';

const STATUS_FILTERS: { label: string; value: OrderStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: '⏳ Pending', value: 'pending' },
  { label: '✅ Approved', value: 'approved' },
  { label: '🔥 Baking', value: 'production' },
  { label: '📦 Ready', value: 'ready' },
  { label: '🚗 On Way', value: 'otw' },
  { label: '✓ Done', value: 'completed' },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadOrders = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from('orders')
      .select('*')
      .eq('baker_id', user.id)
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data } = await query;
    setOrders(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    await updateOrderStatus(orderId, status);
    loadOrders();
  };

  const filtered = orders.filter(o =>
    o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    o.product_name.toLowerCase().includes(search.toLowerCase()) ||
    o.order_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-4">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Orders</h1>
        <p className="text-foreground/50 text-sm">Manage all your customer orders</p>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40">🔍</span>
        <input
          type="search"
          placeholder="Search by name, product, order no..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-12 pl-10 pr-4 rounded-2xl border-2 border-muted bg-white focus:border-primary focus:outline-none text-sm"
        />
      </div>

      {/* Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              filter === f.value
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-white text-foreground/60 border border-muted hover:border-primary hover:text-primary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <div className="text-4xl">📭</div>
          <p className="text-foreground/50 font-medium">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => (
            <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}
