'use client';

import { Order, OrderStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: OrderStatus;
}

const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  pending:    { label: 'Pending',     color: 'bg-yellow-100 text-yellow-700' },
  approved:   { label: 'Approved',   color: 'bg-blue-100 text-blue-700' },
  production: { label: 'Baking 🔥',  color: 'bg-orange-100 text-orange-700' },
  ready:      { label: 'Ready ✓',    color: 'bg-green-100 text-green-700' },
  otw:        { label: 'On the Way', color: 'bg-purple-100 text-purple-700' },
  completed:  { label: 'Done',       color: 'bg-gray-100 text-gray-600' },
  cancelled:  { label: 'Cancelled',  color: 'bg-red-100 text-red-600' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.color}`}>
      {config.label}
    </span>
  );
}

interface OrderCardProps {
  order: Order;
  onStatusChange?: (orderId: string, status: OrderStatus) => void;
  onEdit?: (order: Order) => void;
  onRefresh?: () => void;
}

export function OrderCard({ order, onStatusChange, onEdit, onRefresh }: OrderCardProps) {
  const formatCurrency = (amount: number) => `RM ${amount.toFixed(2)}`;

  const getNextStatus = (current: OrderStatus): OrderStatus | null => {
    const flow: Record<OrderStatus, OrderStatus | null> = {
      pending:    'approved',
      approved:   'production',
      production: 'ready',
      ready:      'otw',
      otw:        'completed',
      completed:  null,
      cancelled:  null,
    };
    return flow[current];
  };

  const nextStatus = getNextStatus(order.status);

  const nextStatusLabel: Record<OrderStatus, string> = {
    pending:    'Approve',
    approved:   'Start Baking',
    production: 'Mark Ready',
    ready:      'Start Delivery',
    otw:        'Mark Completed',
    completed:  '',
    cancelled:  '',
  };

  const handlePaymentToggle = async () => {
    const newStatus = order.payment_status === 'paid' ? 'unpaid' : 'paid';
    const { updatePaymentStatus } = await import('@/lib/services/baker.service');
    const success = await updatePaymentStatus(order.id!, newStatus);
    if (success && onRefresh) {
      onRefresh();
    } else if (success && onStatusChange) {
      // Fallback if onRefresh not provided
      onStatusChange(order.id!, order.status);
    }
  };

  const isToday = order.delivery_date === new Date().toISOString().split('T')[0];
  const isTomorrow = order.delivery_date === new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const handleCopyLabel = () => {
    const label = `🏷️ *ORDER LABEL*\n------------------\n👤 *Customer:* ${order.customer_name}\n🧁 *Product:* ${order.product_name} x${order.quantity}\n📅 *Date:* ${order.delivery_date}\n📝 *Note:* ${order.special_notes || '-'}\n------------------\n#BakerFlow`;
    navigator.clipboard.writeText(label);
    alert('Label copied to clipboard! Paste it into your printer or notes.');
  };

  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${isToday ? 'border-red-500 shadow-lg ring-1 ring-red-100' : 'border-muted/50'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-black text-foreground text-lg leading-tight">{order.customer_name}</p>
            {isToday ? (
              <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase animate-pulse">TODAY! 🔥</span>
            ) : isTomorrow ? (
              <span className="bg-orange-400 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase">Tomorrow</span>
            ) : null}
          </div>
          <p className="text-sm font-bold text-foreground/60">{order.product_name} × {order.quantity}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1">
            {onEdit && (
              <button 
                onClick={() => onEdit(order)}
                className="p-1.5 hover:bg-muted rounded-lg text-foreground/40 transition-colors"
                title="Edit Order"
              >
                ✏️
              </button>
            )}
            <StatusBadge status={order.status} />
          </div>
        </div>
      </div>

      {order.special_notes && (
        <div className="bg-yellow-50 p-2.5 rounded-xl border border-yellow-100">
          <p className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-0.5">Special Note 📝</p>
          <p className="text-xs font-bold text-yellow-800">{order.special_notes}</p>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs font-bold text-foreground/40">
        <span className={isToday ? 'text-red-500' : ''}>📅 {order.delivery_date}</span>
        {order.distance_km && <span>📍 {order.distance_km} km</span>}
        <div className="ml-auto flex items-center gap-2">
          {order.payment_status === 'paid' ? (
            <span className="text-[9px] font-black uppercase bg-green-100 text-green-700 px-2 py-0.5 rounded-md">Paid</span>
          ) : (
            <span className="text-[9px] font-black uppercase bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md">Unpaid</span>
          )}
          <span className="font-black text-foreground text-sm">{formatCurrency(order.total_amount)}</span>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleCopyLabel}
          className="w-10 h-10 rounded-xl border border-muted hover:bg-muted flex items-center justify-center text-lg shadow-sm transition-all"
          title="Copy Label"
        >
          📋
        </button>

        <button
          onClick={handlePaymentToggle}
          className={`flex-1 h-10 rounded-xl font-bold text-xs transition-all border-2 ${
            order.payment_status === 'paid' 
              ? 'border-muted text-foreground/50 hover:bg-muted' 
              : 'border-green-200 text-green-600 bg-green-50 hover:bg-green-100'
          }`}
        >
          {order.payment_status === 'paid' ? 'Unpaid' : 'Mark Paid'}
        </button>

        {nextStatus && onStatusChange && (
          <button
            onClick={() => onStatusChange(order.id!, nextStatus)}
            className="flex-[2] h-10 rounded-xl bg-primary text-white font-black text-xs shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            {nextStatusLabel[order.status]} →
          </button>
        )}
      </div>
    </div>
  );
}
