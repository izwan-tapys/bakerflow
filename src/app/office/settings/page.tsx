'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, 
  Coins, 
  MessageSquare, 
  CreditCard, 
  Lock, 
  Check, 
  AlertCircle,
  Key
} from 'lucide-react';

export default function OfficeSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [settings, setSettings] = useState({
    shop_name: '',
    whatsapp_number: '',
    bank_name: '',
    bank_account: '',
    bank_holder: '',
    toyyibpay_secret_key: '',
    toyyibpay_category_id: '',
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('baker_settings')
          .select('*')
          .eq('baker_id', user.id)
          .single();

        if (data) {
          setSettings({
            shop_name: data.shop_name || '',
            whatsapp_number: data.whatsapp_number || '',
            bank_name: data.bank_name || '',
            bank_account: data.bank_account || '',
            bank_holder: data.bank_holder || '',
            toyyibpay_secret_key: data.toyyibpay_secret_key || '',
            toyyibpay_category_id: data.toyyibpay_category_id || '',
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

      // Enforce unique shop name slug (First Come First Served)
      if (settings.shop_name) {
        const { data: duplicateShop } = await supabase
          .from('baker_settings')
          .select('baker_id')
          .ilike('shop_name', settings.shop_name.trim())
          .neq('baker_id', user.id)
          .limit(1);

        if (duplicateShop && duplicateShop.length > 0) {
          throw new Error('Nama kedai ini telah diambil oleh baker lain. Sila pilih nama yang berbeza.');
        }
      }

      const { error: upsertError } = await supabase
        .from('baker_settings')
        .upsert({
          id: existingId,
          baker_id: user.id,
          shop_name: settings.shop_name || 'My Bakery',
          whatsapp_number: settings.whatsapp_number,
          bank_name: settings.bank_name,
          bank_account: settings.bank_account,
          bank_holder: settings.bank_holder,
          toyyibpay_secret_key: settings.toyyibpay_secret_key,
          toyyibpay_category_id: settings.toyyibpay_category_id,
          updated_at: new Date().toISOString()
        });

      if (upsertError) throw upsertError;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-20 animate-pulse p-4">
        <div className="h-10 bg-muted rounded-xl w-1/3" />
        <div className="h-44 bg-muted rounded-xl" />
        <div className="h-44 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="pt-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-black text-foreground">Office Settings</h1>
              <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Business & Sales Config</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Alerts */}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-300">
            <Check className="w-4 h-4 flex-none" /> Settings saved successfully!
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-300">
            <AlertCircle className="w-4 h-4 flex-none" /> {error}
          </div>
        )}

        {/* Business Profile Section */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/30 tracking-[0.2em] ml-2 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Business Profile
          </p>
          <div className="bg-card rounded-xl border border-muted/50 overflow-hidden shadow-sm divide-y divide-muted/30">
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-sm font-bold text-foreground">Shop Name</span>
              <input 
                type="text" 
                value={settings.shop_name}
                onChange={(e) => setSettings({...settings, shop_name: e.target.value})}
                placeholder="My Awesome Bakery"
                className="text-left sm:text-right text-sm font-extrabold text-primary bg-transparent outline-none focus:ring-1 focus:ring-primary/20 rounded px-2 py-0.5"
              />
            </div>
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-green-600" /> WhatsApp Contact
              </span>
              <input 
                type="text" 
                value={settings.whatsapp_number}
                onChange={(e) => setSettings({...settings, whatsapp_number: e.target.value})}
                placeholder="60123456789"
                className="text-left sm:text-right text-sm font-extrabold text-primary bg-transparent outline-none focus:ring-1 focus:ring-primary/20 rounded px-2 py-0.5"
              />
            </div>
          </div>
        </section>

        {/* Bank Transfer Details */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase text-foreground/30 tracking-[0.2em] ml-2 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5" /> Manual Payment Details
          </p>
          <div className="bg-card rounded-xl border border-muted/50 overflow-hidden shadow-sm divide-y divide-muted/30">
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-primary" /> Bank Name
              </span>
              <input 
                type="text" 
                value={settings.bank_name}
                onChange={(e) => setSettings({...settings, bank_name: e.target.value})}
                placeholder="Maybank / CIMB"
                className="text-left sm:text-right text-sm font-extrabold text-primary bg-transparent outline-none focus:ring-1 focus:ring-primary/20 rounded px-2 py-0.5"
              />
            </div>
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-sm font-bold text-foreground">Bank Account Number</span>
              <input 
                type="text" 
                value={settings.bank_account}
                onChange={(e) => setSettings({...settings, bank_account: e.target.value})}
                placeholder="164012345678"
                className="text-left sm:text-right text-sm font-extrabold text-primary bg-transparent outline-none focus:ring-1 focus:ring-primary/20 rounded px-2 py-0.5"
              />
            </div>
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-sm font-bold text-foreground">Account Holder Name</span>
              <input 
                type="text" 
                value={settings.bank_holder}
                onChange={(e) => setSettings({...settings, bank_holder: e.target.value})}
                placeholder="Ahmad bin Abu"
                className="text-left sm:text-right text-sm font-extrabold text-primary bg-transparent outline-none focus:ring-1 focus:ring-primary/20 rounded px-2 py-0.5"
              />
            </div>
          </div>
        </section>

        {/* ToyyibPay FPX Configurations */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 ml-2">
            <p className="text-[10px] font-black uppercase text-foreground/30 tracking-[0.2em] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> ToyyibPay FPX Credentials
            </p>
            <span className="text-[8px] font-black bg-blue-100 dark:bg-blue-950/40 text-blue-700 px-1.5 py-0.5 rounded uppercase">Optional</span>
          </div>
          <div className="bg-card rounded-xl border border-muted/50 overflow-hidden shadow-sm divide-y divide-muted/30">
            <div className="p-4 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-500" /> Secret Key
                </span>
              </div>
              <input 
                type="password" 
                value={settings.toyyibpay_secret_key}
                onChange={(e) => setSettings({...settings, toyyibpay_secret_key: e.target.value})}
                placeholder="e.g. sec-f10a8c2d9..."
                className="w-full text-sm font-semibold text-primary bg-muted/20 border border-muted/50 rounded-xl px-4 h-11 focus:border-primary focus:outline-none"
              />
            </div>
            <div className="p-4 flex flex-col gap-1.5">
              <span className="text-sm font-bold text-foreground">Category ID</span>
              <input 
                type="text" 
                value={settings.toyyibpay_category_id}
                onChange={(e) => setSettings({...settings, toyyibpay_category_id: e.target.value})}
                placeholder="e.g. cat_910c283"
                className="w-full text-sm font-semibold text-primary bg-muted/20 border border-muted/50 rounded-xl px-4 h-11 focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </section>

        <div className="pt-4">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full h-14 bg-primary text-white rounded-xl font-black text-xs shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? 'Saving Configurations...' : 'Save Office Config'}
          </button>
        </div>
      </div>
    </div>
  );
}
