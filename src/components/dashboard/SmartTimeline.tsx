'use client';

import { useEffect, useRef } from 'react';
import { Order } from '@/lib/types';

interface DailyTask {
  time: string;
  label: string;
  icon: string;
  type: 'bake' | 'pack' | 'deliver' | 'pending';
  order?: Order;
}

interface SmartTimelineProps {
  orders: Order[];
}

function buildTimeline(orders: Order[]): DailyTask[] {
  const tasks: DailyTask[] = [];

  // Group baking tasks in the morning
  const productionOrders = orders.filter(o => ['approved', 'production'].includes(o.status));
  if (productionOrders.length > 0) {
    tasks.push({
      time: '08:00',
      label: `Bake ${productionOrders.length} order(s): ${productionOrders.map(o => o.product_name).join(', ')}`,
      icon: '🧁',
      type: 'bake',
    });
  }

  // Packing at midday
  const readyOrders = orders.filter(o => o.status === 'ready');
  if (readyOrders.length > 0) {
    tasks.push({
      time: '11:00',
      label: `Pack ${readyOrders.length} order(s) for delivery`,
      icon: '📦',
      type: 'pack',
    });
  }

  // Delivery tasks in the afternoon
  const deliveryOrders = orders.filter(o => o.status === 'otw');
  deliveryOrders.forEach((order, i) => {
    tasks.push({
      time: `${13 + i}:00`,
      label: `Deliver to ${order.customer_name} (${order.distance_km || '?'} km)`,
      icon: '🚗',
      type: 'deliver',
      order,
    });
  });

  // Pending approvals
  const pendingOrders = orders.filter(o => o.status === 'pending');
  if (pendingOrders.length > 0) {
    tasks.push({
      time: '09:00',
      label: `${pendingOrders.length} order(s) waiting for approval`,
      icon: '⏳',
      type: 'pending',
    });
  }

  return tasks.sort((a, b) => a.time.localeCompare(b.time));
}

export function SmartTimeline({ orders }: SmartTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tasks = buildTimeline(orders);

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const currentHour = now.getHours();

    // Find the closest task to current time
    const taskElements = scrollRef.current.querySelectorAll('[data-hour]');
    let closestEl: Element | null = null;
    let closestDiff = Infinity;

    taskElements.forEach(el => {
      const hour = parseInt(el.getAttribute('data-hour') || '0');
      const diff = Math.abs(currentHour - hour);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestEl = el;
      }
    });

    if (closestEl) {
      (closestEl as HTMLElement).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [tasks.length]);

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-4 border border-muted/50">
        <p className="text-sm text-foreground/50 text-center py-2">No tasks for today. Enjoy your rest! ☕</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-muted/50 overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">Today&apos;s Timeline</p>
        <p className="text-xs text-foreground/40 font-mono">{currentTimeStr}</p>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        {tasks.map((task, index) => {
          const taskHour = parseInt(task.time.split(':')[0]);
          const isPast = taskHour < currentHour;
          const isCurrent = taskHour === currentHour;

          return (
            <div
              key={index}
              data-hour={taskHour}
              className={`flex-shrink-0 w-44 rounded-2xl p-3 border-2 transition-all ${
                isCurrent
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 scale-105'
                  : isPast
                  ? 'border-muted bg-muted/30 opacity-60'
                  : 'border-muted bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-mono font-bold ${isCurrent ? 'text-primary' : 'text-foreground/40'}`}>
                  {task.time}
                </span>
                <span className="text-lg">{task.icon}</span>
              </div>
              <p className={`text-xs font-medium leading-relaxed ${isCurrent ? 'text-foreground' : 'text-foreground/60'}`}>
                {task.label}
              </p>
              {isCurrent && (
                <div className="mt-2 w-full h-1 bg-primary/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${(currentMinute / 60) * 100}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
