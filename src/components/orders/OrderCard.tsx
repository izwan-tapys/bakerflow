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
  onRefresh?: () => void;
}

export function OrderCard({ order, onStatusChange, onRefresh }: OrderCardProps) {
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

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-muted/50 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-foreground">{order.customer_name}</p>
          <p className="text-sm text-foreground/60">{order.product_name} × {order.quantity}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="flex items-center gap-4 text-sm text-foreground/60">
        <span>📅 {order.delivery_date}</span>
        {order.distance_km && <span>📍 {order.distance_km} km</span>}
        <div className="ml-auto flex items-center gap-2">
          {order.payment_status === 'paid' ? (
            <span className="text-[10px] font-bold uppercase bg-green-100 text-green-700 px-2 py-0.5 rounded-md">Paid</span>
          ) : (
            <span className="text-[10px] font-bold uppercase bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md">Unpaid</span>
          )}
          <span className="font-bold text-foreground">{formatCurrency(order.total_amount)}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handlePaymentToggle}
          className={`flex-1 h-10 rounded-xl font-bold text-sm transition-all border-2 ${
            order.payment_status === 'paid' 
              ? 'border-muted text-foreground/50 hover:bg-muted' 
              : 'border-green-200 text-green-600 bg-green-50 hover:bg-green-100'
          }`}
        >
          {order.payment_status === 'paid' ? 'Mark Unpaid' : 'Mark as Paid'}
        </button>

        {nextStatus && onStatusChange && (
          <button
            onClick={() => onStatusChange(order.id!, nextStatus)}
            className="flex-[2] h-10 rounded-xl bg-primary text-white font-bold text-sm shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            {nextStatusLabel[order.status]} →
          </button>
        )}
      </div>
    </div>
  );
}
