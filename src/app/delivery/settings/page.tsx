'use client';

import { useState } from 'react';

export default function DeliverySettings() {
  const [settings, setSettings] = useState({
    deliveryFee: 5.0,
    startTime: "10:00",
    endTime: "18:00",
    allowSelfCollect: true,
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-foreground">Delivery Settings 🚚</h1>
          <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Logistics & Fees</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Fees Section */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/30 tracking-[0.2em] ml-2">Delivery Fees</p>
          <div className="bg-card rounded-xl border border-muted/50 overflow-hidden shadow-sm">
            <div className="p-4 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Flat Rate (RM)</span>
              <input 
                type="number" 
                value={settings.deliveryFee}
                onChange={(e) => setSettings({...settings, deliveryFee: parseFloat(e.target.value)})}
                className="text-right text-sm font-black text-blue-600 bg-transparent outline-none w-16"
              />
            </div>
          </div>
        </section>

        {/* Windows Section */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/30 tracking-[0.2em] ml-2">Delivery Window</p>
          <div className="bg-card rounded-xl border border-muted/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-muted/30 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Start Time</span>
              <input 
                type="time" 
                value={settings.startTime}
                onChange={(e) => setSettings({...settings, startTime: e.target.value})}
                className="text-sm font-black text-blue-600 bg-transparent outline-none"
              />
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">End Time</span>
              <input 
                type="time" 
                value={settings.endTime}
                onChange={(e) => setSettings({...settings, endTime: e.target.value})}
                className="text-sm font-black text-blue-600 bg-transparent outline-none"
              />
            </div>
          </div>
        </section>

        {/* Collection Section */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/30 tracking-[0.2em] ml-2">Customer Pickup</p>
          <div className="bg-card rounded-xl border border-muted/50 overflow-hidden shadow-sm">
            <div className="p-4 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Allow Self-Collect</span>
              <button 
                onClick={() => setSettings({...settings, allowSelfCollect: !settings.allowSelfCollect})}
                className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${settings.allowSelfCollect ? 'bg-blue-600 justify-end' : 'bg-muted justify-start'}`}
              >
                <div className="w-4 h-4 bg-card rounded-full shadow-sm" />
              </button>
            </div>
          </div>
        </section>

        <div className="pt-4">
          <button className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-xs shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest">
            Save Delivery Config
          </button>
        </div>
      </div>
    </div>
  );
}
