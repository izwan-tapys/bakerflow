'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { BakerSettings } from '@/lib/types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<BakerSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState('');

  const loadSettings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase.from('baker_settings').select('*').eq('baker_id', user.id).single();
    if (data) setSettings(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('baker_settings').upsert({ ...settings, baker_id: userId });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  };

  const updateField = (field: keyof BakerSettings, value: string | number | boolean | null) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const shopUrl = typeof window !== 'undefined' ? `${window.location.origin}/order` : '';

  return (
    <div className="space-y-6 pb-4">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Settings ⚙️</h1>
        <p className="text-foreground/50 text-sm">Manage your bakery profile</p>
      </div>

      {/* Shop Link Card */}
      <div className="bg-gradient-to-r from-primary to-accent rounded-2xl p-5 text-white space-y-2">
        <p className="font-bold text-sm opacity-90">📎 Your Customer Order Link</p>
        <p className="text-xs opacity-70 break-all bg-white/10 rounded-lg px-3 py-2 font-mono">{shopUrl}</p>
        <button
          onClick={() => navigator.clipboard.writeText(shopUrl)}
          className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
        >
          Copy Link 📋
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-6">
          {/* Shop Info */}
          <section className="bg-white rounded-2xl border border-muted p-5 space-y-4">
            <h2 className="font-bold text-foreground">🏪 Shop Information</h2>
            <SettingField label="Bakery Name" value={settings.shop_name || ''} onChange={v => updateField('shop_name', v)} />
            <SettingField label="WhatsApp Number" value={settings.whatsapp_number || ''} onChange={v => updateField('whatsapp_number', v)} type="tel" />
            <div>
              <label className="text-sm font-semibold text-foreground/70 block mb-2">Home Address</label>
              <textarea rows={2} value={settings.home_address || ''} onChange={e => updateField('home_address', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-sm resize-none" />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground/70 block mb-2">Daily Order Capacity</label>
              <input type="number" value={settings.daily_capacity || 5} onChange={e => updateField('daily_capacity', +e.target.value)}
                className="w-full h-11 px-4 rounded-xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-sm" />
            </div>
          </section>

          {/* Bank Info */}
          <section className="bg-white rounded-2xl border border-muted p-5 space-y-4">
            <h2 className="font-bold text-foreground">🏦 Bank Details</h2>
            <SettingField label="Bank Name" value={settings.bank_name || ''} onChange={v => updateField('bank_name', v)} placeholder="e.g. Maybank" />
            <SettingField label="Account Number" value={settings.bank_account || ''} onChange={v => updateField('bank_account', v)} />
            <SettingField label="Account Holder" value={settings.bank_holder || ''} onChange={v => updateField('bank_holder', v)} />
          </section>

          {/* ToyyibPay */}
          <section className="bg-white rounded-2xl border border-muted p-5 space-y-4">
            <h2 className="font-bold text-foreground">💳 ToyyibPay Integration</h2>
            <SettingField label="Secret Key" value={settings.toyyibpay_secret_key || ''} onChange={v => updateField('toyyibpay_secret_key', v)} placeholder="Your ToyyibPay secret key" type="password" />
            <SettingField label="Category ID" value={settings.toyyibpay_category_id || ''} onChange={v => updateField('toyyibpay_category_id', v)} placeholder="Your ToyyibPay category ID" />
          </section>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60"
          >
            {saving ? 'Saving...' : saved ? '✅ Saved!' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}

function SettingField({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground/70 block mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 px-4 rounded-xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-sm transition-colors"
      />
    </div>
  );
}
