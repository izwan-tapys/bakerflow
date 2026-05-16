'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function OfficeTabs() {
  const pathname = usePathname();
  const tabs = [
    { label: 'Overview 🏢', href: '/dashboard' },
    { label: 'Orders 📋', href: '/dashboard/orders' },
    { label: 'Analytics 📊', href: '/dashboard/analytics' },
    { label: 'Directory 📇', href: '/dashboard/directory' },
  ];

  return (
    <div className="flex bg-muted/30 p-1 rounded-xl mb-6 overflow-x-auto no-scrollbar border border-muted/50">
      {tabs.map(tab => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 min-w-[100px] text-center py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              active ? 'bg-white text-primary shadow-sm border border-muted/20' : 'text-foreground/40 hover:text-foreground/60'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
