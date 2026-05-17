'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Truck, 
  Clock, 
  Check, 
  AlertCircle,
  MapPin
} from 'lucide-react';

export default function DeliverySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [settings, setSettings] = useState({
    delivery_start_time: '15:00',
    delivery_end_time: '18:00',
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
            delivery_start_time: data.delivery_start_time || '15:00',
            delivery_end_time: data.delivery_end_time || '18:00',
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
          delivery_start_time: settings.delivery_start_time,
          delivery_end_time: settings.delivery_end_time,
          updated_at: new Date().toISOString()
        });

      if (upsertError) throw upsertError;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save delivery settings.');
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
          <Truck className="w-6 h-6 text-blue-600 animate-pulse" />
          <div>
            <h1 className="text-2xl font-black text-foreground">Delivery Settings</h1>
            <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Logistics & Windows</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Alerts */}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-300">
            <Check className="w-4 h-4 flex-none" /> Delivery settings saved successfully!
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-300">
            <AlertCircle className="w-4 h-4 flex-none" /> {error}
          </div>
        )}

        {/* Windows Section */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/30 tracking-[0.2em] ml-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600" /> Delivery Window
          </p>
          <div className="bg-card rounded-xl border border-muted/50 overflow-hidden shadow-sm divide-y divide-muted/30">
            <div className="p-4 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Delivery Start Time</span>
              <input 
                type="time" 
                value={settings.delivery_start_time}
                onChange={(e) => setSettings({...settings, delivery_start_time: e.target.value})}
                className="text-sm font-black text-blue-600 bg-transparent outline-none focus:ring-1 focus:ring-primary/20 rounded px-2"
              />
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Delivery End Time</span>
              <input 
                type="time" 
                value={settings.delivery_end_time}
                onChange={(e) => setSettings({...settings, delivery_end_time: e.target.value})}
                className="text-sm font-black text-blue-600 bg-transparent outline-none focus:ring-1 focus:ring-primary/20 rounded px-2"
              />
            </div>
          </div>
        </section>

        {/* Dynamic Zones info */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/30 tracking-[0.2em] ml-2 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-red-500" /> Pricing Zones Info
          </p>
          <div className="bg-card rounded-xl border border-muted/50 p-5 shadow-sm space-y-1">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">Zone-based Shipping Fees</h3>
            <p className="text-xs text-foreground/45 leading-relaxed font-medium">
              Delivery fees inside BakerFlow are computed dynamically using customer location metrics relative to your bakery coordinates. Set up and edit these pricing zones inside the onboarding configuration block.
            </p>
          </div>
        </section>

        <div className="pt-4">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full h-14 bg-blue-600 text-white rounded-xl font-black text-xs shadow-xl shadow-blue-200 hover:scale-[1.01] active:scale-95 transition-all uppercase tracking-widest disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Delivery Config'}
          </button>
        </div>
      </div>
    </div>
  );
}
