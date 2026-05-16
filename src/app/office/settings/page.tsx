'use client';

import { useState } from 'react';

export default function OfficeSettings() {
  const [settings, setSettings] = useState({
    shopName: "Baker's Bestie",
    currency: "RM",
    invoicePrefix: "INV-",
    autoSaveDirectory: true,
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-foreground">Office Settings ⚙️</h1>
          <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Business & Sales Config</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Business Profile Section */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/30 tracking-[0.2em] ml-2">Business Profile</p>
          <div className="bg-white rounded-3xl border border-muted/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-muted/30 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Shop Name</span>
              <input 
                type="text" 
                value={settings.shopName}
                onChange={(e) => setSettings({...settings, shopName: e.target.value})}
                className="text-right text-sm font-medium text-primary bg-transparent outline-none"
              />
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Currency</span>
              <span className="text-sm font-medium text-foreground/40">{settings.currency}</span>
            </div>
          </div>
        </section>

        {/* Sales Defaults Section */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/30 tracking-[0.2em] ml-2">Sales Defaults</p>
          <div className="bg-white rounded-3xl border border-muted/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-muted/30 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Invoice Prefix</span>
              <input 
                type="text" 
                value={settings.invoicePrefix}
                onChange={(e) => setSettings({...settings, invoicePrefix: e.target.value})}
                className="text-right text-sm font-medium text-primary bg-transparent outline-none w-20"
              />
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-sm font-bold text-foreground block">Auto-save Directory</span>
                <span className="text-[10px] text-foreground/40 font-medium italic block">Save new customers automatically</span>
              </div>
              <button 
                onClick={() => setSettings({...settings, autoSaveDirectory: !settings.autoSaveDirectory})}
                className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${settings.autoSaveDirectory ? 'bg-primary justify-end' : 'bg-muted justify-start'}`}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
              </button>
            </div>
          </div>
        </section>

        <div className="pt-4">
          <button className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest">
            Save Office Config
          </button>
        </div>
      </div>
    </div>
  );
}
