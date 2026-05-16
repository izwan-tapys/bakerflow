'use client';

import Link from 'next/link';

export default function SettingsHub() {
  const hubs = [
    { label: 'Office Settings', icon: '🏢', desc: 'Shop profile, pricing & invoicing', href: '/office/settings', color: 'bg-primary' },
    { label: 'Kitchen Settings', icon: '🥣', desc: 'Capacity, timing & inventory alerts', href: '/kitchen/settings', color: 'bg-orange-500' },
    { label: 'Delivery Settings', icon: '🚚', desc: 'Fees, zones & delivery windows', href: '/delivery/settings', color: 'bg-blue-600' },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-foreground">Settings ⚙️</h1>
          <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Global Configuration Hub</p>
        </div>
      </div>

      <div className="space-y-4">
        {hubs.map((hub) => (
          <Link 
            key={hub.label}
            href={hub.href}
            className="flex items-center gap-4 bg-white p-5 rounded-[32px] border border-muted/50 shadow-sm active:scale-95 transition-all group hover:border-primary/20"
          >
            <div className={`w-14 h-14 ${hub.color} rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-black/5`}>
              {hub.icon}
            </div>
            <div className="flex-1">
              <h2 className="font-black text-foreground group-hover:text-primary transition-colors">{hub.label}</h2>
              <p className="text-xs font-medium text-foreground/40">{hub.desc}</p>
            </div>
            <div className="text-muted group-hover:text-primary transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}

        <div className="pt-6">
          <p className="text-center text-[10px] font-black uppercase text-foreground/20 tracking-[0.3em]">
            BakerFlow v2.0.0
          </p>
        </div>
      </div>
    </div>
  );
}
