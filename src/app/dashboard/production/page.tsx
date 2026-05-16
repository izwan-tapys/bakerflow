'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Order, OrderStatus } from '@/lib/types';
import { updateOrderStatus } from '@/lib/services/baker.service';
import { formatDate } from '@/lib/utils';

import { checkOrderStock, updatePaymentStatus } from '@/lib/services/baker.service';
import { Flame, CheckCircle2, Truck, Clock, MessageCircle, AlertTriangle, Timer, Package, ChevronRight } from 'lucide-react';

function ProductionCard({ order, onStatusChange, onRefresh }: { order: Order; onStatusChange: (id: string, s: OrderStatus) => void; onRefresh?: () => void }) {
  const [stockStatus, setStockStatus] = useState<{ isOk: boolean; checked: boolean }>({ isOk: true, checked: false });

  useEffect(() => {
    if (order.status === 'approved') {
      checkOrderStock(order.id!).then(res => setStockStatus({ isOk: res.isOk, checked: true }));
    } else {
      setStockStatus({ isOk: true, checked: true });
    }
  }, [order.id, order.status]);

    approved: { label: 'START BAKING', status: 'production', color: 'bg-orange-500', icon: <Flame className="w-3 h-3" /> },
    production: { label: 'MARK AS READY', status: 'ready', color: 'bg-green-600', icon: <CheckCircle2 className="w-3 h-3" /> },
    ready: { label: 'OUT FOR DELIVERY', status: 'otw', color: 'bg-blue-600', icon: <Truck className="w-3 h-3" /> },

  const next = nextStatus[order.status];

  return (
    <div className="bg-card rounded-xl p-5 border-2 border-muted/50 space-y-4 shadow-sm">
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
           order.status === 'production' ? (
             <span className="flex items-center gap-1"><Flame className="w-3 h-3" /> Baking</span>
           ) : (
             <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Ready</span>
           )}
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
          <p className={`font-black mt-0.5 flex items-center gap-1 ${order.payment_status === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>
            {order.payment_status === 'paid' ? <CheckCircle2 className="w-4 h-4" /> : <Timer className="w-4 h-4" />}
            {order.payment_status === 'paid' ? 'Paid' : 'Mark Paid'}
          </p>
        </button>
      </div>

        <div className="bg-accent/10 rounded-xl p-3 text-sm text-foreground/70 flex items-start gap-2">
          <Package className="w-4 h-4 mt-0.5 flex-none" />
          <span className="font-medium">{order.special_notes}</span>
        </div>

      {/* WhatsApp Button */}
      <a
        href={`https://wa.me/60${order.customer_phone?.replace(/^0/, '')}?text=${encodeURIComponent(
          `Hi ${order.customer_name}! Your order of *${order.product_name}* (×${order.quantity}) is now ${
            order.status === 'production' ? 'being baked' : 'ready for delivery'
          }. Thank you for ordering from us!`
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-green-50 text-green-700 font-semibold text-sm hover:bg-green-100 transition-colors"
      >
        <MessageCircle className="w-4 h-4" /> WhatsApp Customer
      </a>

      {next && (
        <>
          {order.status === 'approved' && stockStatus.checked && !stockStatus.isOk ? (
            <button
              onClick={() => window.location.href = '/kitchen/inventory?filter=negative'}
              className="w-full h-12 rounded-xl bg-amber-500 text-white font-bold transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-5 h-5" /> Check Inventory (Insufficient Stock)
            </button>
          ) : (
            <button
              onClick={() => onStatusChange(order.id!, next.status)}
              className={`w-full h-12 rounded-xl text-white font-bold transition-all hover:scale-[1.02] active:scale-95 ${next.color}`}
            >
              {next.label}
            </button>
          )}
        </>
      )}
    </div>
  );
}


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
        window.location.href = '/kitchen/inventory';
      }
      return;
    }
    loadOrders();
  };

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const baking = orders.filter(o => o.status === 'production');
  const queued = orders.filter(o => o.status === 'approved');
  const ready = orders.filter(o => o.status === 'ready');

  return (
    <div className="space-y-5 pb-4">
      {/* Unified Sticky Header Section */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="flex items-start justify-between pt-6 pb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Production Line</h1>
            <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Kitchen Workflow</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            <span className="text-[10px] font-black uppercase text-foreground/40">{baking.length} Baking</span>
          </div>
        </div>

        {/* Column Headers */}
        <div className="pb-3 px-2">
          <div className="grid grid-cols-[1fr_80px_100px] gap-4">
            <p className="text-[10px] font-black uppercase text-foreground/30 tracking-widest">Product / Order</p>
            <p className="text-[10px] font-black uppercase text-foreground/30 tracking-widest text-center">Status</p>
            <p className="text-[10px] font-black uppercase text-foreground/30 tracking-widest text-right">Delivery</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed border-muted">
          <div className="flex justify-center mb-4 text-muted">
            <CheckCircle2 className="w-16 h-16" />
          </div>
          <p className="font-bold text-foreground/40 text-sm">Kitchen is clear!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Baking Section */}
          {baking.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[10px] font-black uppercase text-orange-600 tracking-[0.2em] px-2 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" /> Currently Baking
              </h2>
              <ProductionList orders={baking} expandedId={expandedId} setExpandedId={setExpandedId} onStatusChange={handleStatusChange} onRefresh={loadOrders} />
            </div>
          )}

          {/* Queued Section */}
          {queued.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] px-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" /> Queued
              </h2>
              <ProductionList orders={queued} expandedId={expandedId} setExpandedId={setExpandedId} onStatusChange={handleStatusChange} onRefresh={loadOrders} />
            </div>
          )}

          {/* Ready Section */}
          {ready.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[10px] font-black uppercase text-green-600 tracking-[0.2em] px-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Ready for Pickup/Delivery
              </h2>
              <ProductionList orders={ready} expandedId={expandedId} setExpandedId={setExpandedId} onStatusChange={handleStatusChange} onRefresh={loadOrders} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProductionList({ orders, expandedId, setExpandedId, onStatusChange, onRefresh }: { 
  orders: Order[]; 
  expandedId: string | null; 
  setExpandedId: (id: string | null) => void; 
  onStatusChange: (id: string, s: OrderStatus) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="bg-card rounded-xl border border-muted/50 overflow-hidden shadow-sm">
      <div className="divide-y divide-muted/20">
        {orders.map(order => (
          <ProductionRow 
            key={order.id} 
            order={order} 
            isExpanded={expandedId === order.id} 
            onExpand={() => setExpandedId(expandedId === order.id ? null : (order.id ?? null))}
            onStatusChange={onStatusChange}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </div>
  );
}

function ProductionRow({ order, isExpanded, onExpand, onStatusChange, onRefresh }: { 
  order: Order; 
  isExpanded: boolean; 
  onExpand: () => void;
  onStatusChange: (id: string, s: OrderStatus) => void;
  onRefresh: () => void;
}) {
  const [stockStatus, setStockStatus] = useState<{ isOk: boolean; checked: boolean }>({ isOk: true, checked: false });

  useEffect(() => {
    if (order.status === 'approved') {
      const { checkOrderStock } = require('@/lib/services/baker.service');
      checkOrderStock(order.id!).then((res: any) => setStockStatus({ isOk: res.isOk, checked: true }));
    } else {
      setStockStatus({ isOk: true, checked: true });
    }
  }, [order.id, order.status]);

  const nextStatus: Record<string, { label: string; status: OrderStatus; color: string; icon: React.ReactNode }> = {
    approved: { label: 'START BAKING', status: 'production', color: 'bg-orange-500', icon: <Flame className="w-3 h-3" /> },
    production: { label: 'MARK AS READY', status: 'ready', color: 'bg-green-600', icon: <CheckCircle2 className="w-3 h-3" /> },
    ready: { label: 'OUT FOR DELIVERY', status: 'otw', color: 'bg-blue-600', icon: <Truck className="w-3 h-3" /> },
  };

  const next = nextStatus[order.status];

  return (
    <div className="contents">
      <div 
        onClick={onExpand}
        className={`grid grid-cols-[1fr_80px_100px] gap-4 items-center px-6 py-4 cursor-pointer transition-colors hover:bg-muted/10 ${isExpanded ? 'bg-primary/5' : ''}`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] flex-none transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
            <p className="font-black text-foreground text-sm truncate">{order.product_name}</p>
          </div>
          <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-tighter ml-6">#{order.order_number} • For {order.customer_name} • ×{order.quantity}</p>
        </div>

        <div className="flex justify-center">
          <div className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest ${
            order.status === 'approved' ? 'bg-blue-100 text-blue-600' :
            order.status === 'production' ? 'bg-orange-100 text-orange-600' :
            'bg-green-100 text-green-600'
          }`}>
            {order.status === 'approved' ? 'Queued' : order.status}
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs font-black text-primary leading-none">
            {new Date(order.delivery_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })}
          </p>
          <p className="text-[10px] font-bold text-foreground/30">{order.delivery_time}</p>
        </div>
      </div>

      {isExpanded && (
        <div className="bg-muted/5 px-8 py-8 border-b border-muted/20 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <p className="text-[9px] font-black uppercase text-foreground/30 tracking-widest mb-2">Production Task</p>
                <p className="text-sm font-black text-foreground leading-tight">{order.product_name} (×{order.quantity})</p>
                <p className="text-xs font-bold text-foreground/60 mt-1">Order #{order.order_number}</p>
              </div>

              <div>
                <p className="text-[9px] font-black uppercase text-foreground/30 tracking-widest mb-2">Customer & Note</p>
                <p className="text-sm font-bold text-foreground/80">{order.customer_name} ({order.customer_phone})</p>
                {order.special_notes && (
                  <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-xl mt-2">
                    <p className="text-xs font-bold text-yellow-700 italic">“{order.special_notes}”</p>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    const newStatus = order.payment_status === 'paid' ? 'unpaid' : 'paid';
                    const { updatePaymentStatus } = await import('@/lib/services/baker.service');
                    const success = await updatePaymentStatus(order.id!, newStatus);
                    if (success) onRefresh();
                  }}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${
                    order.payment_status === 'paid' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-orange-50 border-orange-200 text-orange-600'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {order.payment_status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Timer className="w-3 h-3" />}
                    {order.payment_status === 'paid' ? 'PAID' : 'UNPAID'}
                  </span>
                </button>
                <a
                  href={`https://wa.me/60${order.customer_phone?.replace(/^0/, '')}?text=${encodeURIComponent(
                    `Hi ${order.customer_name}! Your order of *${order.product_name}* (×${order.quantity}) is now ${
                      order.status === 'production' ? 'being baked' : 'ready for delivery'
                    }. Thank you for ordering from us!`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-green-50 text-green-700 border-2 border-green-200"
                >
                  <MessageCircle className="w-3 h-3" /> WHATSAPP
                </a>
              </div>
            </div>

            <div className="flex flex-col justify-end">
              {next && (
                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase text-foreground/30 tracking-widest text-right mb-2">Next Step</p>
                  {order.status === 'approved' && stockStatus.checked && !stockStatus.isOk ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); window.location.href = '/kitchen/inventory?filter=negative'; }}
                      className="w-full h-14 rounded-xl bg-amber-500 text-white font-black text-sm shadow-xl shadow-amber-200 flex items-center justify-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4" /> INSUFFICIENT STOCK
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); onStatusChange(order.id!, next.status); }}
                      className={`w-full h-14 rounded-xl text-white font-black text-sm shadow-xl transition-all hover:scale-[1.02] ${next.color} ${
                        next.status === 'production' ? 'shadow-orange-200' : 'shadow-green-200'
                      }`}
                    >
                      {next.icon} {next.label}
                    </button>
                  )}
                  <p className="text-[10px] text-right font-bold text-foreground/30 italic">Target: {order.delivery_date} {order.delivery_time}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
