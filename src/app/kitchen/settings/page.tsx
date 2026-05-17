'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  UtensilsCrossed, 
  Flame, 
  Bell, 
  Check, 
  AlertCircle, 
  Minus, 
  Plus 
} from 'lucide-react';

export default function KitchenSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [settings, setSettings] = useState({
    daily_capacity: 5,
    lowStockThreshold: 100,
    production_start_time: '09:00',
    production_end_time: '15:00',
    mixer_bowl_capacity_liters: 4.8,
    oven_bcu_capacity: 4,
    chiller_bcu_capacity: 8
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('baker_settings')
          .select('*')
          .eq('baker_id', user.id)
          .maybeSingle();

        if (data) {
          const startTime = data.production_start_time ? data.production_start_time.substring(0, 5) : '09:00';
          const endTime = data.production_end_time ? data.production_end_time.substring(0, 5) : '15:00';

          setSettings({
            daily_capacity: data.daily_capacity ?? 5,
            lowStockThreshold: 100,
            production_start_time: startTime,
            production_end_time: endTime,
            mixer_bowl_capacity_liters: Number(data.mixer_bowl_capacity_liters ?? 4.8),
            oven_bcu_capacity: data.oven_bcu_capacity ?? 4,
            chiller_bcu_capacity: data.chiller_bcu_capacity ?? 8
          });
        }
      }
      setLoading(false);
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User session not found.');

      const { data: existingSettings } = await supabase
        .from('baker_settings')
        .select('id')
        .eq('baker_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      const existingId = existingSettings && existingSettings.length > 0 ? existingSettings[0].id : undefined;

      const { error: upsertError } = await supabase
        .from('baker_settings')
        .upsert({
          id: existingId,
          baker_id: user.id,
          daily_capacity: settings.daily_capacity,
          production_start_time: `${settings.production_start_time}:00`,
          production_end_time: `${settings.production_end_time}:00`,
          mixer_bowl_capacity_liters: settings.mixer_bowl_capacity_liters,
          oven_bcu_capacity: settings.oven_bcu_capacity,
          chiller_bcu_capacity: settings.chiller_bcu_capacity,
          updated_at: new Date().toISOString()
        });

      if (upsertError) throw upsertError;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save kitchen settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-20 animate-pulse p-4">
        <div className="h-10 bg-muted rounded-xl w-1/3" />
        <div className="h-36 bg-muted rounded-xl" />
        <div className="h-36 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="pt-8 pb-4 flex items-center gap-3">
          <UtensilsCrossed className="w-6 h-6 text-orange-500 animate-pulse" />
          <div>
            <h1 className="text-2xl font-black text-foreground">Kitchen Settings</h1>
            <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Production & Inventory</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Alerts */}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-300">
            <Check className="w-4 h-4 flex-none" /> Kitchen configurations saved successfully!
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-300">
            <AlertCircle className="w-4 h-4 flex-none" /> {error}
          </div>
        )}

        {/* 1. Production Hours (Working shift) */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/45 tracking-[0.2em] ml-2 flex items-center gap-1.5">
            🕒 Waktu Produksi (Shift Kerja)
          </p>
          <div className="bg-card rounded-xl border border-muted/50 overflow-hidden shadow-sm p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-foreground/45 uppercase tracking-widest block mb-1.5">Mula Kerja</label>
                <input type="time" value={settings.production_start_time} onChange={e => setSettings({...settings, production_start_time: e.target.value})} className="w-full h-11 px-3 rounded-lg border-2 border-muted font-bold text-center text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-black text-foreground/45 uppercase tracking-widest block mb-1.5">Tamat Kerja</label>
                <input type="time" value={settings.production_end_time} onChange={e => setSettings({...settings, production_end_time: e.target.value})} className="w-full h-11 px-3 rounded-lg border-2 border-muted font-bold text-center text-sm" />
              </div>
            </div>
            <p className="text-[10px] text-foreground/40 font-medium leading-normal italic">
              *Tugasan dapur Kak Sue akan disusun secara kelompok pintar di dalam lingkungan waktu kerja ini sahaja di Google Calendar.
            </p>
          </div>
        </section>

        {/* 2. Hardware constraints (Oven & Chiller Capacity) */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/45 tracking-[0.2em] ml-2 flex items-center gap-1.5">
            🛠️ Kapasiti Perkakasan Dapur (SKE)
          </p>
          <div className="space-y-3">
            {/* Stand Mixer */}
            <div className="bg-card rounded-xl border border-muted/50 p-5 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-sm font-bold text-foreground block">Saiz Mangkuk Mixer</span>
                <span className="text-[10px] text-foreground/45 mt-0.5 block font-medium">Isipadu mangkuk Stand Mixer utama (Liters)</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" step="0.1" value={settings.mixer_bowl_capacity_liters} onChange={e => setSettings({...settings, mixer_bowl_capacity_liters: Number(e.target.value)})} className="w-20 h-10 px-3 rounded-lg border-2 border-muted font-bold text-center text-sm" />
                <span className="text-[10px] font-black text-foreground/40 uppercase">Liters</span>
              </div>
            </div>

            {/* Oven Capacity (Round 8-inch Circular Reference) */}
            <div className="bg-card rounded-xl border border-muted/50 p-5 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-sm font-bold text-foreground block">Kapasiti Oven (BCU)</span>
                <span className="text-[10px] text-foreground/45 mt-0.5 block font-medium">Berapa loyang bulat 8-inci boleh masuk sekali bakar?</span>
              </div>
              <div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-xl border border-muted/30">
                <button 
                  onClick={() => setSettings({...settings, oven_bcu_capacity: Math.max(1, settings.oven_bcu_capacity - 1)})}
                  className="w-9 h-9 rounded-lg bg-card hover:bg-muted/80 text-foreground flex items-center justify-center font-bold text-base active:scale-90 transition-all shadow-sm border border-muted/20"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-black text-primary w-8 text-center">{settings.oven_bcu_capacity}</span>
                <button 
                  onClick={() => setSettings({...settings, oven_bcu_capacity: settings.oven_bcu_capacity + 1})}
                  className="w-9 h-9 rounded-lg bg-card hover:bg-muted/80 text-foreground flex items-center justify-center font-bold text-base active:scale-90 transition-all shadow-sm border border-muted/20"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chiller Capacity (Square 8x8x4 reference box) */}
            <div className="bg-card rounded-xl border border-muted/50 p-5 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-sm font-bold text-foreground block">Kapasiti Chiller (BCU)</span>
                <span className="text-[10px] text-foreground/45 mt-0.5 block font-medium">Berapa kotak 8x8x4-inci boleh muat sekali simpan?</span>
              </div>
              <div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-xl border border-muted/30">
                <button 
                  onClick={() => setSettings({...settings, chiller_bcu_capacity: Math.max(1, settings.chiller_bcu_capacity - 1)})}
                  className="w-9 h-9 rounded-lg bg-card hover:bg-muted/80 text-foreground flex items-center justify-center font-bold text-base active:scale-90 transition-all shadow-sm border border-muted/20"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-black text-primary w-8 text-center">{settings.chiller_bcu_capacity}</span>
                <button 
                  onClick={() => setSettings({...settings, chiller_bcu_capacity: settings.chiller_bcu_capacity + 1})}
                  className="w-9 h-9 rounded-lg bg-card hover:bg-muted/80 text-foreground flex items-center justify-center font-bold text-base active:scale-90 transition-all shadow-sm border border-muted/20"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Max Daily Orders Limit (Default limit fallback) */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/40 tracking-[0.2em] ml-2 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-500" /> Had Tempahan Harian
          </p>
          <div className="bg-card rounded-xl border border-muted/50 overflow-hidden shadow-sm">
            <div className="p-5 flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-foreground block">Had Jualan Harian (Order)</span>
                <span className="text-[10px] text-foreground/45 mt-0.5 block font-medium">Batas tempahan sehari untuk mengelakkan keletihan dapur</span>
              </div>
              <div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-xl border border-muted/30">
                <button 
                  onClick={() => setSettings({...settings, daily_capacity: Math.max(1, settings.daily_capacity - 1)})}
                  className="w-9 h-9 rounded-lg bg-card hover:bg-muted/80 text-foreground flex items-center justify-center font-bold text-base active:scale-90 transition-all shadow-sm border border-muted/20"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-black text-primary w-8 text-center">{settings.daily_capacity}</span>
                <button 
                  onClick={() => setSettings({...settings, daily_capacity: settings.daily_capacity + 1})}
                  className="w-9 h-9 rounded-lg bg-card hover:bg-muted/80 text-foreground flex items-center justify-center font-bold text-base active:scale-90 transition-all shadow-sm border border-muted/20"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Inventory Alerts info banner */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/40 tracking-[0.2em] ml-2 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-amber-500" /> Amaran Stok Rendah
          </p>
          <div className="bg-card rounded-xl border border-muted/50 overflow-hidden p-5 shadow-sm space-y-1">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">Kapasiti & Had Amaran Bahan Mentah</h3>
            <p className="text-xs text-foreground/40 leading-relaxed font-medium">
              BakerFlow mencetuskan amaran stok bahan mentah yang hampir habis secara dinamik berdasarkan kuantiti minima yang telah ditetapkan dalam menu [Inventory](file:///c:/Users/skyxi/Desktop/bakerflow/src/app/dashboard/inventory/page.tsx). 
            </p>
          </div>
        </section>

        {/* 4. Onboarding Setup Wizard Reset */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/40 tracking-[0.2em] ml-2 flex items-center gap-1.5">
            🚀 Wizard Suai Kenal Dapur
          </p>
          <div className="bg-card rounded-xl border border-muted/50 overflow-hidden p-5 shadow-sm space-y-4">
            <div>
              <span className="text-sm font-bold text-foreground block">Luncurkan Wizard Onboarding</span>
              <span className="text-[10px] text-foreground/45 mt-0.5 block font-medium">Tetapkan semula kapasiti dapur Kak Sue dan jalankan semula wizard suai kenal "Know Your Kitchen" 3-langkah dari mula.</span>
            </div>
            <button 
              onClick={async () => {
                if (confirm('Adakah anda pasti untuk meluncurkan semula Wizard Onboarding?\n\nKapasiti Oven, Chiller, dan Mixer anda akan dikosongkan di database untuk persediaan semula.')) {
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) throw new Error('Sesi pengguna tidak dijumpai.');
                    
                    const { error } = await supabase
                      .from('baker_settings')
                      .update({
                        is_setup_complete: false,
                        oven_bcu_capacity: null,
                        chiller_bcu_capacity: null,
                        mixer_bowl_capacity_liters: null
                      })
                      .eq('baker_id', user.id);

                    if (error) throw error;
                    
                    // Redirect to onboarding page!
                    window.location.href = '/onboarding/kitchen';
                  } catch (err: any) {
                    alert(err.message || 'Gagal menetapkan semula onboarding.');
                  }
                }
              }}
              className="w-full h-11 bg-primary/10 hover:bg-primary/20 text-primary border-2 border-primary/20 rounded-xl font-extrabold text-xs transition-colors uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
            >
              🚀 Mula Wizard Onboarding
            </button>
          </div>
        </section>

        <div className="pt-4">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full h-14 bg-orange-500 text-white rounded-xl font-black text-xs shadow-xl shadow-orange-200 hover:scale-[1.01] active:scale-95 transition-all uppercase tracking-widest disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Kitchen Config'}
          </button>
        </div>
      </div>
    </div>
  );
}
