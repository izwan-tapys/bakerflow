'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Order, OrderStatus, Product } from '@/lib/types';
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
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Manual Order State
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: 'Self Pickup / Manual',
    product_id: '',
    quantity: 1,
    delivery_date: new Date().toISOString().split('T')[0],
    delivery_time: '15:00',
    special_notes: '',
    payment_status: 'unpaid' as const
  });

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [ordersRes, productsRes] = await Promise.all([
      supabase.from('orders').select('*').eq('baker_id', user.id).order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('baker_id', user.id).eq('is_active', true)
    ]);

    setOrders(ordersRes.data || []);
    setProducts(productsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddManualOrder = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const product = products.find(p => p.id === manualForm.product_id);
    if (!product) {
      alert('Sila pilih produk!');
      return;
    }

    const total_amount = product.price * manualForm.quantity;

    const { error } = await supabase.from('orders').insert({
      baker_id: user.id,
      customer_name: manualForm.customer_name,
      customer_phone: manualForm.customer_phone || '000000000',
      customer_address: manualForm.customer_address,
      product_id: product.id,
      product_name: product.name,
      quantity: manualForm.quantity,
      unit_price: product.price,
      total_amount,
      payment_status: manualForm.payment_status,
      delivery_date: manualForm.delivery_date,
      delivery_time: manualForm.delivery_time,
      status: 'approved',
      special_notes: manualForm.special_notes,
      order_number: `M-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
    });

    if (error) {
      alert('Gagal simpan: ' + error.message);
      return;
    }

    setShowManual(false);
    setManualForm({
      customer_name: '',
      customer_phone: '',
      customer_address: 'Self Pickup / Manual',
      product_id: '',
      quantity: 1,
      delivery_date: new Date().toISOString().split('T')[0],
      delivery_time: '15:00',
      special_notes: '',
      payment_status: 'unpaid'
    });
    loadData();
  };

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    await updateOrderStatus(orderId, status);
    loadData();
  };

  const filtered = orders.filter(o =>
    o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    o.product_name.toLowerCase().includes(search.toLowerCase()) ||
    o.order_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Orders 📝</h1>
          <p className="text-foreground/50 text-sm">Manage all your customer orders</p>
        </div>
        <button 
          onClick={() => setShowManual(true)}
          className="h-10 px-4 bg-primary text-white rounded-xl font-bold text-sm shadow-md shadow-primary/20 hover:scale-105 transition-all"
        >
          + Manual Order
        </button>
      </div>

      {/* Manual Order Modal */}
      {showManual && (
        <div className="bg-white rounded-2xl border-2 border-primary/20 p-5 space-y-4 shadow-xl">
          <p className="font-black text-foreground">Add Manual Order</p>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-foreground/40">Customer Name</label>
                <input value={manualForm.customer_name} onChange={e => setManualForm({...manualForm, customer_name: e.target.value})}
                  className="w-full h-11 px-3 rounded-xl border border-muted focus:border-primary outline-none text-sm font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-foreground/40">Customer Phone</label>
                <input value={manualForm.customer_phone} onChange={e => setManualForm({...manualForm, customer_phone: e.target.value})} placeholder="0123456789"
                  className="w-full h-11 px-3 rounded-xl border border-muted focus:border-primary outline-none text-sm font-bold" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-foreground/40">Delivery/Pickup Address</label>
              <input value={manualForm.customer_address} onChange={e => setManualForm({...manualForm, customer_address: e.target.value})}
                className="w-full h-11 px-3 rounded-xl border border-muted focus:border-primary outline-none text-sm font-bold" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-foreground/40">Product</label>
                <select value={manualForm.product_id} onChange={e => setManualForm({...manualForm, product_id: e.target.value})}
                  className="w-full h-11 px-2 rounded-xl border border-muted focus:border-primary outline-none text-sm font-bold bg-white">
                  <option value="">Select Product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (RM{p.price})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-foreground/40">Quantity</label>
                <input type="number" value={manualForm.quantity} onChange={e => setManualForm({...manualForm, quantity: +e.target.value})}
                  className="w-full h-11 px-3 rounded-xl border border-muted focus:border-primary outline-none text-sm font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-foreground/40">Date</label>
                <input type="date" value={manualForm.delivery_date} onChange={e => setManualForm({...manualForm, delivery_date: e.target.value})}
                  className="w-full h-11 px-3 rounded-xl border border-muted focus:border-primary outline-none text-sm font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-foreground/40">Payment</label>
                <select value={manualForm.payment_status} onChange={e => setManualForm({...manualForm, payment_status: e.target.value as any})}
                  className="w-full h-11 px-2 rounded-xl border border-muted focus:border-primary outline-none text-sm font-bold bg-white">
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-foreground/40">Special Note (Optional)</label>
              <textarea value={manualForm.special_notes} onChange={e => setManualForm({...manualForm, special_notes: e.target.value})} rows={2}
                className="w-full px-3 py-2 rounded-xl border border-muted focus:border-primary outline-none text-sm font-bold resize-none" />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowManual(false)} className="flex-1 h-11 rounded-xl border-2 border-muted font-bold text-sm">Cancel</button>
            <button onClick={handleAddManualOrder} disabled={!manualForm.customer_name || !manualForm.product_id}
              className="flex-2 bg-primary text-white rounded-xl font-bold text-sm px-6 disabled:opacity-50 shadow-md shadow-primary/20">
              Save Order
            </button>
          </div>
        </div>
      )}

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
            <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} onRefresh={loadData} />
          ))}
        </div>
      )}
    </div>
  );
}
