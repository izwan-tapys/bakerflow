'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Order, OrderStatus } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { updateOrderStatus } from '@/lib/services/baker.service';
import { 
  Truck, 
  CheckCircle2, 
  MapPin, 
  MessageCircle, 
  Navigation, 
  Clock, 
  CheckCheck,
  AlertCircle,
  Phone,
  Package
} from 'lucide-react';

type TabType = 'ready' | 'otw' | 'completed';

export default function DeliveryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('ready');
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('baker_id', user.id)
        .eq('status', activeTab)
        .order('delivery_date');
      if (data) setOrders(data);
      else setOrders([]);
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleStatusTransition = async (orderId: string, nextStatus: OrderStatus) => {
    setActioningId(orderId);
    const result = await updateOrderStatus(orderId, nextStatus);
    if (result.success) {
      // Reload current tab orders
      await loadOrders();
    } else {
      alert(`Failed to update status: ${result.message}`);
    }
    setActioningId(null);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Unified Sticky Header Section */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="pt-8 pb-4 flex items-center gap-3">
          <Truck className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-black text-foreground">Delivery</h1>
            <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Logistics & Dispatch</p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex bg-muted/40 p-1.5 rounded-xl border border-muted/50 overflow-x-auto no-scrollbar">
          {(['ready', 'otw', 'completed'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                activeTab === tab 
                  ? 'bg-card text-primary shadow-sm scale-100 font-bold border border-muted/20' 
                  : 'text-foreground/40 hover:text-foreground/75'
              }`}
            >
              {tab === 'ready' && <Package className="w-3.5 h-3.5" />}
              {tab === 'otw' && <Truck className="w-3.5 h-3.5" />}
              {tab === 'completed' && <CheckCheck className="w-3.5 h-3.5" />}
              {tab === 'ready' ? 'Ready' : tab === 'otw' ? 'In Transit' : 'History'}
            </button>
          ))}
        </div>

        {/* Orders Listing */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-muted/50 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-xl border-2 border-dashed border-muted space-y-4">
            <div className="flex justify-center text-muted">
              {activeTab === 'ready' ? (
                <Package className="w-12 h-12" />
              ) : activeTab === 'otw' ? (
                <Truck className="w-12 h-12" />
              ) : (
                <CheckCheck className="w-12 h-12" />
              )}
            </div>
            <p className="font-bold text-foreground/45 italic text-sm">
              {activeTab === 'ready' && 'No orders queued for dispatch.'}
              {activeTab === 'otw' && 'No packages currently in transit.'}
              {activeTab === 'completed' && 'No delivery records found.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <div 
                key={order.id} 
                className="bg-card rounded-xl p-5 border border-muted/50 shadow-sm space-y-4 hover:border-primary/10 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-foreground/30 uppercase tracking-wider">#{order.order_number || (order.id ?? '').slice(0, 8)}</span>
                    <h3 className="font-extrabold text-foreground text-base mt-0.5">{order.customer_name}</h3>
                    <p className="text-xs font-semibold text-primary/80 flex items-center gap-1.5 mt-1">
                      <Package className="w-3.5 h-3.5" /> {order.product_name} &times; {order.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-foreground/30 uppercase">Scheduled Delivery</p>
                    <p className="text-xs font-black text-foreground/80 mt-0.5">{formatDate(order.delivery_date)}</p>
                    <p className="text-[10px] font-bold text-primary mt-0.5">{order.delivery_time || 'No specific time'}</p>
                  </div>
                </div>

                {/* Logistics details */}
                <div className="bg-muted/15 rounded-xl p-3.5 space-y-2 border border-muted/30">
                  <div className="flex items-start gap-2 text-xs text-foreground/75">
                    <MapPin className="w-4 h-4 text-primary flex-none mt-0.5" />
                    <div>
                      <p className="font-bold text-foreground/80">Delivery Address</p>
                      <p className="mt-0.5 leading-relaxed font-medium">{order.customer_address}</p>
                    </div>
                  </div>

                  {order.special_notes && (
                    <div className="text-xs italic bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 p-2.5 rounded-lg border border-amber-100/30 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 flex-none mt-0.5" />
                      <span>&ldquo;{order.special_notes}&rdquo;</span>
                    </div>
                  )}
                </div>

                {/* Dispatch Controls */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  {activeTab === 'ready' && (
                    <button 
                      onClick={() => handleStatusTransition(order.id!, 'otw')}
                      disabled={actioningId === order.id}
                      className="flex-1 h-11 bg-primary text-white rounded-xl font-black text-xs shadow-md shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Truck className="w-4 h-4" /> 
                      {actioningId === order.id ? 'DISPATCHING...' : 'OUT FOR DELIVERY'}
                    </button>
                  )}

                  {activeTab === 'otw' && (
                    <button 
                      onClick={() => handleStatusTransition(order.id!, 'completed')}
                      disabled={actioningId === order.id}
                      className="flex-1 h-11 bg-green-600 text-white rounded-xl font-black text-xs shadow-md shadow-green-200/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" /> 
                      {actioningId === order.id ? 'COMPLETING...' : 'MARK AS DELIVERED'}
                    </button>
                  )}

                  {/* Customer Quick Links */}
                  <div className="flex gap-2">
                    <a
                      href={`https://wa.me/60${order.customer_phone?.replace(/^0/, '')}?text=${encodeURIComponent(
                        `Hi ${order.customer_name}! This is BakerFlow logistics. Regarding your order #${order.order_number || (order.id ?? '').slice(0, 8)} (${order.product_name} x ${order.quantity}): We are delivering to your address: ${order.customer_address}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-11 h-11 bg-green-50 text-green-700 hover:bg-green-100 transition-colors rounded-xl flex items-center justify-center border-2 border-green-100 flex-none"
                      title="WhatsApp Customer"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>

                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer_address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-11 h-11 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors rounded-xl flex items-center justify-center border-2 border-blue-100 flex-none"
                      title="Open in Maps"
                    >
                      <Navigation className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
