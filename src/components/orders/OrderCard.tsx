'use client';

import { useState } from 'react';
import { Toast } from '@/components/ui/Toast';

import { Order, OrderStatus } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { 
  Pencil, 
  Flame, 
  Check, 
  Truck, 
  CheckCircle, 
  XCircle, 
  MessageSquare, 
  Calendar, 
  MapPin, 
  Copy,
  ArrowRight,
  Clock
} from 'lucide-react';

interface StatusBadgeProps {
  status: OrderStatus;
}

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: any }> = {
  pending:    { label: 'Pending',     color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved:   { label: 'Approved',   color: 'bg-blue-100 text-blue-700', icon: Check },
  production: { label: 'Baking',     color: 'bg-orange-100 text-orange-700', icon: Flame },
  ready:      { label: 'Ready',      color: 'bg-green-100 text-green-700', icon: CheckCircle },
  otw:        { label: 'On the Way', color: 'bg-purple-100 text-purple-700', icon: Truck },
  completed:  { label: 'Done',       color: 'bg-gray-100 text-gray-600', icon: CheckCircle },
  cancelled:  { label: 'Cancelled',  color: 'bg-red-100 text-red-600', icon: XCircle },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${config.color}`}>
      <Icon className="w-3 h-3" />
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
  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type?: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    message: '',
    type: 'success'
  });

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
    const label = `🏷️ *ORDER LABEL*\n------------------\n👤 *Customer:* ${order.customer_name}\n🧁 *Product:* ${order.product_name} x${order.quantity}\n📅 *Date:* ${order.delivery_date}\n📝 *Note:* ${order.special_notes || '-'}\n------------------\n#BakersBestie #BaBe`;
    navigator.clipboard.writeText(label);
    setToast({
      isOpen: true,
      message: 'Label copied to clipboard! Paste it into your printer or notes. 🏷️',
      type: 'success'
    });
  };

  return (
    <div className={`bg-gradient-to-b from-card to-card/95 rounded-xl p-5 shadow-sm border border-primary/5 transition-all hover:shadow-md hover:border-primary/20 ${isToday ? 'ring-1 ring-primary/20' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-bold text-foreground text-lg leading-tight tracking-tight">{order.customer_name}</p>
            {isToday ? (
              <span className="bg-primary text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase animate-pulse">TODAY!</span>
            ) : isTomorrow ? (
              <span className="bg-orange-400 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase">Tomorrow</span>
            ) : null}
          </div>
          <p className="text-sm font-medium text-foreground/60">{order.product_name} × {order.quantity}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1">
            {onEdit && (
              <button 
                onClick={() => onEdit(order)}
                className="p-2 hover:bg-muted rounded-lg text-foreground/40 transition-colors"
                title="Edit Order"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <StatusBadge status={order.status} />
          </div>
        </div>
      </div>

      {order.special_notes && (
        <div className="my-3 bg-primary/5 p-3 rounded-xl border border-primary/10">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare className="w-3 h-3 text-primary" />
            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Note</p>
          </div>
          <p className="text-xs font-medium text-foreground/70">{order.special_notes}</p>
        </div>
      )}

      <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-wider text-foreground/30 my-4">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDate(order.delivery_date)}</span>
        </div>
        {order.distance_km && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            <span>{order.distance_km} km</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          {order.payment_status === 'paid' ? (
            <span className="text-[9px] font-black uppercase bg-green-500/10 text-green-600 px-2 py-0.5 rounded border border-green-500/20">Paid</span>
          ) : (
            <span className="text-[9px] font-black uppercase bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded border border-orange-500/20">Unpaid</span>
          )}
          <span className="font-bold text-foreground text-sm tracking-tight">{formatCurrency(order.total_amount)}</span>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleCopyLabel}
          className="w-10 h-10 rounded-lg border border-muted/50 hover:bg-muted flex items-center justify-center text-foreground/40 shadow-sm transition-all"
          title="Copy Label"
        >
          <Copy className="w-4 h-4" />
        </button>

        <button
          onClick={handlePaymentToggle}
          className={`flex-1 h-10 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all border ${
            order.payment_status === 'paid' 
              ? 'border-muted text-foreground/30 hover:bg-muted' 
              : 'border-green-500/20 text-green-600 bg-green-500/5 hover:bg-green-500/10'
          }`}
        >
          {order.payment_status === 'paid' ? 'Unpaid' : 'Mark Paid'}
        </button>

        {nextStatus && onStatusChange && (
          <button
            onClick={() => onStatusChange(order.id!, nextStatus)}
            className="flex-[2] h-10 rounded-lg bg-primary text-white font-bold text-[10px] uppercase tracking-widest shadow-sm hover:bg-primary-dark transition-all flex items-center justify-center gap-2"
          >
            {nextStatusLabel[order.status]} <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Modern Premium Toast */}
      {toast.isOpen && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(prev => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
}
