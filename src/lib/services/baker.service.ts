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
  // 1. Get current order to check status and product info
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order) return false;

  // 2. Logic: If finishing production (Mark Ready), deduct actual stock
  // Only deduct if transitioning to 'ready' from an active state and hasn't been deducted before
  const isTransitioningToReady = status === 'ready' && !['ready', 'otw', 'completed'].includes(order.status);
  
  if (isTransitioningToReady && order.product_id) {
    const { data: recipes } = await supabase.from('recipes').select('*').eq('product_id', order.product_id);
    
    if (recipes && recipes.length > 0) {
      for (const recipe of recipes) {
        const amountToDeduct = recipe.quantity_needed * order.quantity;
        
        // Update ingredient stock using atomic decrement (or fetch and update)
        const { data: currentIng } = await supabase.from('ingredients').select('current_stock').eq('id', recipe.ingredient_id).single();
        if (currentIng) {
          await supabase.from('ingredients')
            .update({ current_stock: Math.max(0, currentIng.current_stock - amountToDeduct) })
            .eq('id', recipe.ingredient_id);
        }
      }
    }
  }

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
