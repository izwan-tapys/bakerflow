'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Order } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function DeliveryPage() {
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReadyOrders = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('orders')
          .select('*')
          .eq('baker_id', user.id)
          .eq('status', 'ready')
          .order('delivery_date');
        if (data) setReadyOrders(data);
      }
      setLoading(false);
    };
    fetchReadyOrders();
  }, []);

  return (
    <div className="space-y-6 pb-20">
      {/* Unified Sticky Header Section */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-foreground">Delivery 🚚</h1>
          <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Logistic Hub</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex bg-muted/30 p-1 rounded-xl border border-muted/50 overflow-x-auto no-scrollbar">
          {['Ready', 'In Transit', 'History'].map(tab => (
            <button
              key={tab}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                tab === 'Ready' ? 'bg-card text-primary shadow-sm' : 'text-foreground/40'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}
          </div>
        ) : readyOrders.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border-2 border-dashed border-muted space-y-4">
            <div className="text-5xl">🏘️</div>
            <p className="font-bold text-foreground/40 italic">No orders ready for delivery yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {readyOrders.map(order => (
              <div key={order.id} className="bg-card rounded-2xl p-5 border border-muted/50 shadow-sm flex items-center justify-between">
                <div>
                  <p className="font-black text-foreground">#{order.order_number || (order.id ?? '').slice(0,8)}</p>
                  <p className="text-xs font-bold text-foreground/40">{order.customer_name}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black uppercase">
                      Ready
                    </span>
                    <span className="text-[10px] font-bold text-foreground/30 italic">
                      Due: {formatDate(order.delivery_date)}
                    </span>
                  </div>
                </div>
                <button className="h-12 px-6 bg-primary text-white rounded-xl font-black text-xs shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                  OUT FOR DELIVERY 🚗
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
