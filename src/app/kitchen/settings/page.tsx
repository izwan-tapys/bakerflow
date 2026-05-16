'use client';

import { useState } from 'react';

export default function KitchenSettings() {
  const [settings, setSettings] = useState({
    dailyCapacity: 20,
    startTime: "08:00",
    lowStockAlert: true,
    lowStockThreshold: 2.0,
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-foreground">Kitchen Settings 🥣</h1>
          <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Production & Inventory</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Production Section */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/30 tracking-[0.2em] ml-2">Production Capacity</p>
          <div className="bg-card rounded-xl border border-muted/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-muted/30 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Max Daily Orders</span>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSettings({...settings, dailyCapacity: Math.max(0, settings.dailyCapacity - 1)})}
                  className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center font-bold text-lg active:scale-90 transition-all"
                >-</button>
                <span className="text-sm font-black text-primary w-8 text-center">{settings.dailyCapacity}</span>
                <button 
                  onClick={() => setSettings({...settings, dailyCapacity: settings.dailyCapacity + 1})}
                  className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center font-bold text-lg active:scale-90 transition-all"
                >+</button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Kitchen Start Time</span>
              <input 
                type="time" 
                value={settings.startTime}
                onChange={(e) => setSettings({...settings, startTime: e.target.value})}
                className="text-sm font-black text-primary bg-transparent outline-none"
              />
            </div>
          </div>
        </section>

        {/* Inventory Section */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/30 tracking-[0.2em] ml-2">Inventory Alerts</p>
          <div className="bg-card rounded-xl border border-muted/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-muted/30 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Low Stock Notifications</span>
              <button 
                onClick={() => setSettings({...settings, lowStockAlert: !settings.lowStockAlert})}
                className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${settings.lowStockAlert ? 'bg-orange-500 justify-end' : 'bg-muted justify-start'}`}
              >
                <div className="w-4 h-4 bg-card rounded-full shadow-sm" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Alert Threshold (kg/unit)</span>
              <input 
                type="number" 
                value={settings.lowStockThreshold}
                onChange={(e) => setSettings({...settings, lowStockThreshold: parseFloat(e.target.value)})}
                className="text-right text-sm font-medium text-primary bg-transparent outline-none w-16"
              />
            </div>
          </div>
        </section>

        <div className="pt-4">
          <button className="w-full py-4 bg-orange-500 text-white rounded-xl font-black text-xs shadow-xl shadow-orange-200 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest">
            Save Kitchen Config
          </button>
        </div>
      </div>
    </div>
  );
}
