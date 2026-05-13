'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Order, OrderStatus } from '@/lib/types';
import { SmartTimeline } from '@/components/dashboard/SmartTimeline';
import { OrderCard } from '@/components/orders/OrderCard';
import { updateOrderStatus } from '@/lib/services/baker.service';

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
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);

  const loadDashboardData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [settingsRes, todayRes, pendingRes, productionRes, revenueRes] = await Promise.all([
      supabase.from('baker_settings').select('shop_name').eq('baker_id', user.id).single(),
      supabase.from('orders').select('*').eq('baker_id', user.id).eq('delivery_date', today).order('created_at'),
      supabase.from('orders').select('*').eq('baker_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').eq('baker_id', user.id).in('status', ['approved', 'production', 'ready']),
      supabase.from('orders').select('total_amount').eq('baker_id', user.id).eq('payment_status', 'paid').gte('created_at', startOfMonth.toISOString()),
    ]);

    if (settingsRes.data) setShopName(settingsRes.data.shop_name);
    
    // Inject Mock Data if no real orders found
    if (!todayRes.data?.length && !pendingRes.data?.length && !productionRes.data?.length) {
      const mockOrders: Order[] = [
        {
          id: '1',
          customer_name: 'Siti Aminah',
          customer_phone: '0123456789',
          customer_address: 'Subang Jaya',
          product_name: 'Chocolate Moist Cake',
          quantity: 1,
          unit_price: 85,
          delivery_fee: 5,
          total_amount: 90,
          delivery_date: today,
          status: 'production',
          payment_status: 'paid',
          distance_km: 4.2
        },
        {
          id: '2',
          customer_name: 'Ahmad Zaki',
          customer_phone: '0198765432',
          customer_address: 'Shah Alam',
          product_name: 'Pandan Gula Melaka',
          quantity: 2,
          unit_price: 60,
          delivery_fee: 10,
          total_amount: 130,
          delivery_date: today,
          status: 'ready',
          payment_status: 'paid',
          distance_km: 12.5
        },
        {
          id: '3',
          customer_name: 'Sarah Tan',
          customer_phone: '0172223333',
          customer_address: 'Kuala Lumpur',
          product_name: 'Red Velvet cupcakes',
          quantity: 12,
          unit_price: 5,
          delivery_fee: 15,
          total_amount: 75,
          delivery_date: today,
          status: 'pending',
          payment_status: 'unpaid',
          distance_km: 8.0
        }
      ];
      
      setTodayOrders(mockOrders.filter(o => o.status !== 'pending'));
      setPendingOrders(mockOrders.filter(o => o.status === 'pending'));
      setProductionOrders(mockOrders.filter(o => ['approved', 'production', 'ready'].includes(o.status)));
      setMonthlyRevenue(1450.50);
    } else {
      if (todayRes.data) setTodayOrders(todayRes.data);
      if (pendingRes.data) setPendingOrders(pendingRes.data);
      if (productionRes.data) setProductionOrders(productionRes.data);
      if (revenueRes.data) {
        const total = revenueRes.data.reduce((sum: number, o: { total_amount: number }) => sum + (o.total_amount || 0), 0);
        setMonthlyRevenue(total);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    await updateOrderStatus(orderId, status);
    loadDashboardData(); // Refresh
  };

  const todayCollection = todayOrders
    .filter(o => o.payment_status !== 'paid')
    .reduce((sum, o) => sum + o.total_amount, 0);

  const allOrdersForTimeline = [...todayOrders, ...productionOrders];

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 bg-muted rounded-2xl" />
        <div className="h-32 bg-muted rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">
          {getGreeting()}, {shopName}! 👋
        </h1>
        <p className="text-foreground/50 text-sm mt-1">
          {new Date().toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Smart Timeline */}
      <SmartTimeline orders={allOrdersForTimeline} />

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-muted/50 text-center">
          <p className="text-3xl font-extrabold text-primary">{todayOrders.length}</p>
          <p className="text-xs text-foreground/60 mt-1 font-medium">Today&apos;s Deliveries</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-muted/50 text-center">
          <p className="text-3xl font-extrabold text-orange-500">{pendingOrders.length}</p>
          <p className="text-xs text-foreground/60 mt-1 font-medium">Pending Approval</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-muted/50 text-center">
          <p className="text-xl font-extrabold text-green-600">RM{todayCollection.toFixed(0)}</p>
          <p className="text-xs text-foreground/60 mt-1 font-medium">Collect Today</p>
        </div>
      </div>

      {/* Monthly Revenue */}
      <div className="bg-gradient-to-r from-primary to-accent rounded-2xl p-5 text-white">
        <p className="text-sm font-medium opacity-80">Monthly Revenue</p>
        <p className="text-3xl font-extrabold mt-1">RM {monthlyRevenue.toFixed(2)}</p>
        <p className="text-xs opacity-70 mt-1">{new Date().toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Pending Approvals */}
      {pendingOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            ⏳ Pending Approvals
            <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">{pendingOrders.length}</span>
          </h2>
          {pendingOrders.map(order => (
            <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}

      {/* Production Orders */}
      {productionOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            🍳 Kitchen Tasks
          </h2>
          {productionOrders.map(order => (
            <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {pendingOrders.length === 0 && productionOrders.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <div className="text-5xl">🎉</div>
          <p className="text-foreground/60 font-medium">All clear! No pending tasks.</p>
          <p className="text-foreground/40 text-sm">New orders will appear here automatically.</p>
        </div>
      )}
    </div>
  );
}
