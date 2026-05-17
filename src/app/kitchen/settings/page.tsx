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
    lowStockThreshold: 100 // Visual state or low stock threshold
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
          .single();

        if (data) {
          setSettings({
            daily_capacity: data.daily_capacity ?? 5,
            lowStockThreshold: 100
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

      const { error: upsertError } = await supabase
        .from('baker_settings')
        .upsert({
          baker_id: user.id,
          daily_capacity: settings.daily_capacity,
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

        {/* Production Capacity Section */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/30 tracking-[0.2em] ml-2 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-500" /> Production Capacity
          </p>
          <div className="bg-card rounded-xl border border-muted/50 overflow-hidden shadow-sm">
            <div className="p-5 flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-foreground block">Max Daily Orders</span>
                <span className="text-[10px] text-foreground/45 mt-0.5 block font-medium">Daily baking limit to avoid overload</span>
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

        {/* Inventory alerts indicator */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/30 tracking-[0.2em] ml-2 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-amber-500" /> Inventory Alerts
          </p>
          <div className="bg-card rounded-xl border border-muted/50 overflow-hidden p-5 shadow-sm space-y-1">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">Smart Stock Threshold</h3>
            <p className="text-xs text-foreground/40 leading-relaxed font-medium">
              BakerFlow triggers low stock alerts dynamically based on the customized ingredient threshold set in the [Inventory](file:///c:/Users/skyxi/Desktop/bakerflow/src/app/dashboard/inventory/page.tsx) tab. Go to inventory settings inside each resource to fine-tune alert thresholds.
            </p>
          </div>
        </section>

        <div className="pt-4">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full h-14 bg-orange-500 text-white rounded-xl font-black text-xs shadow-xl shadow-orange-200 hover:scale-[1.01] active:scale-95 transition-all uppercase tracking-widest disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Kitchen Config'}
          </button>
        </div>
      </div>
    </div>
  );
}
