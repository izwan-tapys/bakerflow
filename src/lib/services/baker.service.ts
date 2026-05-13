'use client';

import { supabase } from '@/lib/supabase';
import { BakerSettings, Order } from '@/lib/types';

export async function getBakerSettings(bakerId: string): Promise<BakerSettings | null> {
  const { data, error } = await supabase
    .from('baker_settings')
    .select('*')
    .eq('baker_id', bakerId)
    .single();

  if (error) return null;
  return data;
}

export async function getTodayOrders(bakerId: string): Promise<Order[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('baker_id', bakerId)
    .eq('delivery_date', today)
    .order('created_at', { ascending: true });

  if (error) return [];
  return data || [];
}

export async function getPendingOrders(bakerId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('baker_id', bakerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function getProductionOrders(bakerId: string): Promise<Order[]> {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('baker_id', bakerId)
    .in('status', ['approved', 'production'])
    .in('delivery_date', [today, tomorrow])
    .order('delivery_date', { ascending: true });

  if (error) return [];
  return data || [];
}

export async function updateOrderStatus(orderId: string, status: Order['status']): Promise<boolean> {
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  return !error;
}

export async function updatePaymentStatus(orderId: string, payment_status: 'unpaid' | 'paid'): Promise<boolean> {
  const { error } = await supabase
    .from('orders')
    .update({ payment_status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  return !error;
}

export async function getMonthlyRevenue(bakerId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('baker_id', bakerId)
    .eq('payment_status', 'paid')
    .gte('created_at', startOfMonth.toISOString());

  if (error || !data) return 0;
  return data.reduce((sum, order) => sum + (order.total_amount || 0), 0);
}
