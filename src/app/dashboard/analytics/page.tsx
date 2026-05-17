'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  Truck, 
  Calendar,
  AlertCircle,
  BarChart3,
  ArrowUpRight
} from 'lucide-react';

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  pendingDeliveries: number;
  statusBreakdown: Record<string, number>;
  recentOrders: any[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>({
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    pendingDeliveries: 0,
    statusBreakdown: {},
    recentOrders: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch all orders for this baker
        const { data: orders } = await supabase
          .from('orders')
          .select('*')
          .eq('baker_id', user.id);

        if (orders && orders.length > 0) {
          // 1. Calculate metrics
          const completedOrPaid = orders.filter(o => o.status !== 'cancelled');
          const totalRevenue = completedOrPaid.reduce((sum, o) => sum + (o.total_amount || 0), 0);
          const totalOrders = orders.length;
          const avgOrderValue = totalOrders > 0 ? totalRevenue / completedOrPaid.length : 0;
          
          const pendingDeliveries = orders.filter(o => ['approved', 'production', 'ready', 'otw'].includes(o.status)).length;

          // 2. Status breakdown
          const breakdown: Record<string, number> = {};
          orders.forEach(o => {
            breakdown[o.status] = (breakdown[o.status] || 0) + 1;
          });

          // 3. Recent 5 orders
          const sortedOrders = [...orders]
            .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
            .slice(0, 5);

          setData({
            totalRevenue,
            totalOrders,
            avgOrderValue,
            pendingDeliveries,
            statusBreakdown: breakdown,
            recentOrders: sortedOrders
          });
        }
      }
      setLoading(false);
    };

    fetchAnalytics();
  }, []);

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-amber-100 dark:bg-amber-950/30', text: 'text-amber-800 dark:text-amber-400', label: 'Pending Approval' },
    approved: { bg: 'bg-blue-100 dark:bg-blue-950/30', text: 'text-blue-800 dark:text-blue-400', label: 'Confirmed' },
    production: { bg: 'bg-orange-100 dark:bg-orange-950/30', text: 'text-orange-800 dark:text-orange-400', label: 'Baking' },
    ready: { bg: 'bg-purple-100 dark:bg-purple-950/30', text: 'text-purple-800 dark:text-purple-400', label: 'Ready' },
    otw: { bg: 'bg-cyan-100 dark:bg-cyan-950/30', text: 'text-cyan-800 dark:text-cyan-400', label: 'In Transit' },
    completed: { bg: 'bg-green-100 dark:bg-green-950/30', text: 'text-green-800 dark:text-green-400', label: 'Delivered' },
    cancelled: { bg: 'bg-rose-100 dark:bg-rose-950/30', text: 'text-rose-800 dark:text-rose-400', label: 'Cancelled' },
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="pt-8 pb-4 flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-black text-foreground">Analytics</h1>
            <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Business Intelligence</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-muted/50 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Dashboard Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Revenue */}
            <div className="bg-card p-5 rounded-xl border border-muted/50 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-foreground/45 tracking-wider">Total Sales</p>
                <h3 className="text-2xl font-black text-foreground">RM {data.totalRevenue.toFixed(2)}</h3>
                <p className="text-[10px] font-semibold text-green-600 flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> Live revenue data
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            {/* Total Orders */}
            <div className="bg-card p-5 rounded-xl border border-muted/50 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-foreground/45 tracking-wider">Total Orders</p>
                <h3 className="text-2xl font-black text-foreground">{data.totalOrders}</h3>
                <p className="text-[10px] font-semibold text-primary/80">Received lifetime orders</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <ShoppingBag className="w-6 h-6" />
              </div>
            </div>

            {/* Average Ticket */}
            <div className="bg-card p-5 rounded-xl border border-muted/50 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-foreground/45 tracking-wider">Average Basket</p>
                <h3 className="text-2xl font-black text-foreground">RM {data.avgOrderValue.toFixed(2)}</h3>
                <p className="text-[10px] font-semibold text-foreground/40">Average value per ticket</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            {/* Pending Dispatch */}
            <div className="bg-card p-5 rounded-xl border border-muted/50 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-foreground/45 tracking-wider">Active Queue</p>
                <h3 className="text-2xl font-black text-foreground">{data.pendingDeliveries}</h3>
                <p className="text-[10px] font-semibold text-amber-600">Awaiting preparation/delivery</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Operational breakdown */}
            <div className="bg-card p-5 rounded-xl border border-muted/50 shadow-sm space-y-4 lg:col-span-1">
              <h3 className="font-extrabold text-foreground text-sm uppercase tracking-wider text-foreground/75">Order Flow Stats</h3>
              <div className="space-y-3">
                {Object.keys(statusColors).map(status => {
                  const count = data.statusBreakdown[status] || 0;
                  const percent = data.totalOrders > 0 ? (count / data.totalOrders) * 100 : 0;
                  const meta = statusColors[status];

                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${meta.bg} ${meta.text}`}>
                          {meta.label}
                        </span>
                        <span className="text-foreground/70">{count} order{count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            status === 'completed' ? 'bg-green-500' :
                            status === 'cancelled' ? 'bg-red-400' : 'bg-primary'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Live Orders */}
            <div className="bg-card p-5 rounded-xl border border-muted/50 shadow-sm space-y-4 lg:col-span-2">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold text-foreground text-sm uppercase tracking-wider text-foreground/75">Recent Customer Transactions</h3>
                <span className="text-[10px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded-lg uppercase">Live Feed</span>
              </div>

              {data.recentOrders.length === 0 ? (
                <p className="text-center text-xs text-foreground/40 italic py-10 font-semibold">No transactions recorded yet.</p>
              ) : (
                <div className="divide-y divide-muted/30">
                  {data.recentOrders.map(order => {
                    const meta = statusColors[order.status] || { bg: 'bg-muted', text: 'text-foreground/50', label: 'Unknown' };
                    return (
                      <div key={order.id} className="py-3 flex justify-between items-center first:pt-0 last:pb-0">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">{order.customer_name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${meta.bg} ${meta.text}`}>
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/50 font-medium">
                            {order.product_name} &times; {order.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-foreground text-sm">RM {order.total_amount?.toFixed(2)}</p>
                          <p className="text-[9px] font-bold text-foreground/30 flex items-center gap-1 justify-end mt-0.5">
                            <Calendar className="w-3 h-3" /> {formatDate(order.delivery_date)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
