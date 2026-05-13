'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function KitchenTabs() {
  const pathname = usePathname();
  const tabs = [
    { label: 'Tasks 🍳', href: '/dashboard/production' },
    { label: 'Planner 📅', href: '/dashboard/planner' },
    { label: 'Stock 📦', href: '/dashboard/inventory' },
  ];

  return (
    <div className="flex bg-muted/30 p-1.5 rounded-2xl mb-6">
      {tabs.map(tab => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 text-center py-2.5 rounded-xl text-sm font-bold transition-all ${
              active ? 'bg-white text-foreground shadow-sm' : 'text-foreground/50 hover:text-foreground'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
