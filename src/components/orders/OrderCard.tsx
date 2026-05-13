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
}

export function OrderCard({ order, onStatusChange }: OrderCardProps) {
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
        <span className="ml-auto font-bold text-foreground">{formatCurrency(order.total_amount)}</span>
      </div>

      {nextStatus && onStatusChange && (
        <button
          onClick={() => onStatusChange(order.id!, nextStatus)}
          className="w-full h-10 rounded-xl bg-primary/10 text-primary font-semibold text-sm hover:bg-primary hover:text-white transition-all"
        >
          {nextStatusLabel[order.status]} →
        </button>
      )}
    </div>
  );
}
