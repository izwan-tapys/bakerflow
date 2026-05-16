'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { Order, OrderStatus, Product, PaymentStatus } from '@/lib/types';
import { OrderCard } from '@/components/orders/OrderCard';
import { updateOrderStatus } from '@/lib/services/baker.service';
import { Search, Clock, CheckCircle2, Flame, Package, Truck, CheckCheck, X } from 'lucide-react';

const STATUS_FILTERS: { label: string; value: OrderStatus; icon: any }[] = [
  { label: 'Pending', value: 'pending', icon: Clock },
  { label: 'Approved', value: 'approved', icon: CheckCircle2 },
  { label: 'Baking', value: 'production', icon: Flame },
  { label: 'Ready', value: 'ready', icon: Package },
  { label: 'On Way', value: 'otw', icon: Truck },
  { label: 'Done', value: 'completed', icon: CheckCheck },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<OrderStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal State
  const [showManual, setShowManual] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [manualForm, setManualForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: 'Self Pickup / Manual',
    product_id: '',
    quantity: 1,
    delivery_date: new Date().toISOString().split('T')[0],
    delivery_time: '15:00',
    special_notes: '',
    payment_status: 'unpaid' as PaymentStatus
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
      special_notes: manualForm.special_notes
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

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setManualForm({
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_address: order.customer_address,
      product_id: order.product_id || '',
      quantity: order.quantity,
      delivery_date: order.delivery_date,
      delivery_time: order.delivery_time || '15:00',
      special_notes: order.special_notes || '',
      payment_status: order.payment_status
    });
    setShowManual(true);
  };

  const handleUpdateOrder = async () => {
    if (!editingOrder) return;
    const product = products.find(p => p.id === manualForm.product_id);
    if (!product) return;

    const total_amount = product.price * manualForm.quantity;

    const { error } = await supabase.from('orders')
      .update({
        customer_name: manualForm.customer_name,
        customer_phone: manualForm.customer_phone,
        customer_address: manualForm.customer_address,
        product_id: product.id,
        product_name: product.name,
        quantity: manualForm.quantity,
        unit_price: product.price,
        total_amount,
        payment_status: manualForm.payment_status,
        delivery_date: manualForm.delivery_date,
        delivery_time: manualForm.delivery_time,
        special_notes: manualForm.special_notes,
      })
      .eq('id', editingOrder.id);

    if (error) {
      alert('Gagal update: ' + error.message);
      return;
    }

    setShowManual(false);
    setEditingOrder(null);
    loadData();
  };

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
    loadData();
  };

  const filtered = orders.filter(o => {
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      (o.customer_name ?? '').toLowerCase().includes(searchLower) ||
      (o.product_name ?? '').toLowerCase().includes(searchLower) ||
      (o.order_number ?? '').toLowerCase().includes(searchLower);
    
    const matchesStatus = o.status === filter;
    
    return matchesSearch && matchesStatus;
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-5 pb-4">
      {/* Unified Sticky Header Section */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="flex items-start justify-between pt-6 pb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Orders 📝</h1>
            <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Customer Orders</p>
          </div>
          <button 
            onClick={() => setShowManual(true)}
            className="h-10 px-4 bg-primary text-white rounded-xl font-black text-xs shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            + Manual Order
          </button>
        </div>

        {/* Filters & Search Combo */}
        <div className="space-y-3 pb-3">
          {/* Search Row */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30 w-3.5 h-3.5 pointer-events-none" />
            <input
              type="search"
              placeholder="Search by customer or order number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-muted bg-card focus:border-primary focus:outline-none text-xs font-bold shadow-sm"
            />
          </div>

          {/* Filter Pills Row */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
                  filter === f.value
                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/20 scale-105'
                    : 'bg-card text-foreground/40 border-muted hover:border-primary'
                }`}
              >
                <f.icon className={`w-3 h-3 ${filter === f.value ? 'text-white' : 'text-primary/70'}`} />
                {f.label}
              </button>
            ))}
          </div>
        </div>

          {/* Table Header */}
          <div className="grid grid-cols-[1fr_80px_100px] gap-4 px-2">
            <p className="text-[10px] font-black uppercase text-foreground/30 tracking-widest">Customer / Order</p>
            <p className="text-[10px] font-black uppercase text-foreground/30 tracking-widest text-center">Status</p>
            <p className="text-[10px] font-black uppercase text-foreground/30 tracking-widest text-right">Delivery</p>
          </div>
        </div>

      {/* Manual Order Modal (Same as before but with modernized classes) */}
      {showManual && createPortal(
        <div className="fixed inset-0 z-[100] bg-background/40 backdrop-blur-md flex items-center justify-center p-3 md:p-[5%]">
          <div className="bg-card w-full max-w-xl h-fit max-h-[90vh] rounded-xl p-8 shadow-2xl flex flex-col overflow-hidden border border-primary/10">
            <div className="flex justify-between items-center mb-6 flex-none">
              <p className="text-xl font-black text-foreground tracking-tight">{editingOrder ? 'Edit Order' : 'Add Manual Order'}</p>
              <button onClick={() => { setShowManual(false); setEditingOrder(null); }} className="w-10 h-10 flex items-center justify-center bg-primary/5 hover:bg-primary/10 transition-colors rounded-xl text-foreground/40">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-foreground/40 tracking-widest block mb-1">Customer Name</label>
                    <input value={manualForm.customer_name} onChange={e => setManualForm({...manualForm, customer_name: e.target.value})}
                      className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-foreground/40 tracking-widest block mb-1">Phone</label>
                    <input value={manualForm.customer_phone} onChange={e => setManualForm({...manualForm, customer_phone: e.target.value})} placeholder="0123456789"
                      className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-foreground/40 tracking-widest block mb-1">Address / Pickup</label>
                  <input value={manualForm.customer_address} onChange={e => setManualForm({...manualForm, customer_address: e.target.value})}
                    className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-foreground/40 tracking-widest block mb-1">Product</label>
                    <select value={manualForm.product_id} onChange={e => setManualForm({...manualForm, product_id: e.target.value})}
                      className="w-full h-12 px-3 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold bg-card">
                      <option value="">Select Product</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-foreground/40 tracking-widest block mb-1">Qty</label>
                    <input type="number" value={manualForm.quantity} onChange={e => setManualForm({...manualForm, quantity: +e.target.value})}
                      className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-foreground/40 tracking-widest block mb-1">Delivery Date</label>
                    <input type="date" value={manualForm.delivery_date} onChange={e => setManualForm({...manualForm, delivery_date: e.target.value})}
                      className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-foreground/40 tracking-widest block mb-1">Payment</label>
                    <select value={manualForm.payment_status} onChange={e => setManualForm({...manualForm, payment_status: e.target.value as any})}
                      className="w-full h-12 px-3 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold bg-card text-primary">
                      <option value="unpaid">🔴 UNPAID</option>
                      <option value="paid">🟢 PAID</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 flex-none">
              <button onClick={editingOrder ? handleUpdateOrder : handleAddManualOrder} disabled={!manualForm.customer_name || !manualForm.product_id}
                className="w-full h-16 bg-primary text-white rounded-xl font-black text-lg disabled:opacity-50 shadow-xl shadow-primary/20 transition-all">
                {editingOrder ? 'UPDATE ORDER' : 'SAVE ORDER'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Orders List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed border-muted">
          <div className="text-4xl mb-3">📭</div>
          <p className="font-bold text-foreground/40">No {filter} orders found</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-muted/50 overflow-hidden shadow-sm">
          <div className="divide-y divide-muted/20">
            {filtered.map(order => (
              <div key={order.id} className="contents">
                <div 
                  onClick={() => setExpandedId(expandedId === order.id ? null : (order.id ?? null))}
                  className={`grid grid-cols-[1fr_80px_100px] gap-4 items-center px-6 py-4 cursor-pointer transition-colors hover:bg-muted/10 ${expandedId === order.id ? 'bg-primary/5' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] flex-none transition-transform duration-300 ${expandedId === order.id ? 'rotate-90' : ''}`}>▶</span>
                      <p className="font-black text-foreground text-sm truncate">{order.product_name}</p>
                    </div>
                    <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-tighter ml-6">#{order.order_number} • For {order.customer_name} • ×{order.quantity}</p>
                  </div>
                  
                  <div className="flex justify-center">
                    <div className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest ${
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                      order.status === 'approved' ? 'bg-blue-100 text-blue-600' :
                      order.status === 'production' ? 'bg-orange-100 text-orange-600' :
                      order.status === 'completed' ? 'bg-green-100 text-green-600' :
                      'bg-muted text-foreground/40'
                    }`}>
                      {order.status}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-black text-primary leading-none">
                      {new Date(order.delivery_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })}
                    </p>
                    <p className="text-[10px] font-bold text-foreground/30">{order.delivery_time}</p>
                  </div>
                </div>

                {expandedId === order.id && (
                  <div className="bg-muted/5 px-8 py-8 border-b border-muted/20 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div>
                          <p className="text-[9px] font-black uppercase text-foreground/30 tracking-widest mb-2">Order Details</p>
                          <p className="text-sm font-black text-foreground leading-tight">{order.product_name}</p>
                          <p className="text-xs font-bold text-foreground/60 mt-1">Qty: {order.quantity} | RM {order.total_amount.toFixed(2)}</p>
                        </div>
                        
                        <div>
                          <p className="text-[9px] font-black uppercase text-foreground/30 tracking-widest mb-2">Customer & Address</p>
                          <p className="text-sm font-bold text-foreground/80">{order.customer_phone}</p>
                          <p className="text-sm text-foreground/60 mt-1 leading-relaxed">{order.customer_address}</p>
                        </div>

                        {order.special_notes && (
                          <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-xl">
                            <p className="text-[9px] font-black uppercase text-yellow-600 tracking-widest mb-1">Notes</p>
                            <p className="text-xs font-bold text-yellow-700">{order.special_notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <p className="text-[9px] font-black uppercase text-foreground/30 tracking-widest mb-2">Actions</p>
                        <div className="grid grid-cols-2 gap-2">
                          {order.status === 'pending' && (
                            <button onClick={() => handleStatusChange(order.id!, 'approved')} className="h-12 rounded-xl bg-blue-500 text-white font-black text-xs shadow-lg shadow-blue-200">APPROVE</button>
                          )}
                          {order.status === 'approved' && (
                            <button onClick={() => handleStatusChange(order.id!, 'production')} className="h-12 rounded-xl bg-orange-500 text-white font-black text-xs shadow-lg shadow-orange-200">START BAKING</button>
                          )}
                          {order.status === 'production' && (
                            <button onClick={() => handleStatusChange(order.id!, 'ready')} className="h-12 rounded-xl bg-green-500 text-white font-black text-xs shadow-lg shadow-green-200">MARK READY</button>
                          )}
                          <button onClick={() => handleEditOrder(order)} className="h-12 rounded-xl bg-muted text-foreground/60 font-black text-xs">EDIT INFO</button>
                        </div>
                        <p className="text-[10px] text-center font-bold text-foreground/30 italic">Payment: {order.payment_status.toUpperCase()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
