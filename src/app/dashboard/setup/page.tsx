'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BakerSettings, DeliveryZone } from '@/lib/types';
import { StepIndicator } from '@/components/onboarding/StepIndicator';
import { useRouter } from 'next/navigation';

const TOTAL_STEPS = 5;

const defaultZones: DeliveryZone[] = [
  { zone_name: 'Nearby', min_km: 0, max_km: 5, fee: 5 },
  { zone_name: 'Medium', min_km: 5, max_km: 15, fee: 10 },
  { zone_name: 'Far', min_km: 15, max_km: 30, fee: 15 },
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [settings, setSettings] = useState<Partial<BakerSettings>>({
    shop_name: '',
    home_address: '',
    home_lat: null,
    home_lng: null,
    daily_capacity: 5,
    whatsapp_number: '',
    bank_name: '',
    bank_account: '',
    bank_holder: '',
    toyyibpay_secret_key: '',
    toyyibpay_category_id: '',
    is_setup_complete: false,
  });

  const [zones, setZones] = useState<DeliveryZone[]>(defaultZones);

  const updateSettings = (field: keyof BakerSettings, value: string | number | boolean | null) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const updateZone = (index: number, field: keyof DeliveryZone, value: string | number) => {
    setZones(prev => prev.map((z, i) => i === index ? { ...z, [field]: value } : z));
  };

  const addZone = () => {
    const lastZone = zones[zones.length - 1];
    setZones(prev => [...prev, {
      zone_name: 'New Zone',
      min_km: lastZone.max_km,
      max_km: lastZone.max_km + 10,
      fee: lastZone.fee + 5,
    }]);
  };

  const removeZone = (index: number) => {
    if (zones.length > 1) {
      setZones(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleNext = () => {
    setError('');
    if (step === 0 && !settings.shop_name) {
      setError('Please enter your bakery name.');
      return;
    }
    if (step === 1 && !settings.home_address) {
      setError('Please enter your home address.');
      return;
    }
    if (step < TOTAL_STEPS - 1) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const handleFinish = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in. Please refresh and try again.');
        return;
      }

      // Upsert baker settings
      const { error: settingsError } = await supabase
        .from('baker_settings')
        .upsert({ ...settings, baker_id: user.id, is_setup_complete: true });

      if (settingsError) throw settingsError;

      // Insert delivery zones
      const { error: zonesError } = await supabase
        .from('delivery_zones')
        .insert(zones.map(z => ({ ...z, baker_id: user.id })));

      if (zonesError) throw zonesError;

      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 bg-primary rounded-2xl items-center justify-center text-white text-2xl font-bold mb-4 shadow-xl shadow-primary/20">
            BF
          </div>
          <h1 className="text-2xl font-bold text-foreground">Let&apos;s set up your bakery!</h1>
          <p className="text-foreground/60 mt-1 text-sm">Takes less than 2 minutes.</p>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={step} />

        {/* Card */}
        <div className="bg-card rounded-3xl shadow-xl shadow-foreground/5 p-8 border border-muted">

          {/* Step 0: Shop Identity */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">What&apos;s your bakery called?</h2>
                <p className="text-foreground/60 text-sm mt-1">This name will appear on your customer portal.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-foreground/80 block mb-2">Bakery Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Wan's Sweet Kitchen"
                    value={settings.shop_name}
                    onChange={e => updateSettings('shop_name', e.target.value)}
                    className="w-full h-14 px-4 rounded-2xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-foreground font-medium transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground/80 block mb-2">WhatsApp Number *</label>
                  <input
                    type="tel"
                    placeholder="e.g. 0123456789"
                    value={settings.whatsapp_number}
                    onChange={e => updateSettings('whatsapp_number', e.target.value)}
                    className="w-full h-14 px-4 rounded-2xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-foreground font-medium transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Location */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Where is your home base?</h2>
                <p className="text-foreground/60 text-sm mt-1">This is used to calculate delivery distances.</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground/80 block mb-2">Home Address *</label>
                <textarea
                  rows={3}
                  placeholder="e.g. No 12, Jalan Bakeri, Taman Selaman, 47500 Subang Jaya, Selangor"
                  value={settings.home_address}
                  onChange={e => updateSettings('home_address', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-foreground font-medium transition-colors resize-none"
                />
              </div>
              <div className="bg-accent/10 rounded-2xl p-4 text-sm text-foreground/70">
                💡 <span className="font-semibold">Tip:</span> Enter your full address including postcode for accurate delivery calculations.
              </div>
            </div>
          )}

          {/* Step 2: Capacity */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Daily order capacity</h2>
                <p className="text-foreground/60 text-sm mt-1">How many orders can you handle per day?</p>
              </div>
              <div className="text-center py-6">
                <div className="text-7xl font-extrabold text-primary mb-4">
                  {settings.daily_capacity}
                </div>
                <p className="text-foreground/60 text-sm font-medium">orders per day</p>
                <div className="flex items-center justify-center gap-6 mt-6">
                  <button
                    onClick={() => updateSettings('daily_capacity', Math.max(1, (settings.daily_capacity || 5) - 1))}
                    className="w-14 h-14 rounded-2xl bg-muted text-foreground text-2xl font-bold hover:bg-secondary transition-colors"
                  >−</button>
                  <div className="flex gap-1">
                    {[3, 5, 10, 15, 20].map(cap => (
                      <button
                        key={cap}
                        onClick={() => updateSettings('daily_capacity', cap)}
                        className={`px-3 py-1 rounded-xl text-sm font-bold transition-colors ${
                          settings.daily_capacity === cap
                            ? 'bg-primary text-white'
                            : 'bg-muted text-foreground/60 hover:bg-secondary'
                        }`}
                      >{cap}</button>
                    ))}
                  </div>
                  <button
                    onClick={() => updateSettings('daily_capacity', Math.min(50, (settings.daily_capacity || 5) + 1))}
                    className="w-14 h-14 rounded-2xl bg-muted text-foreground text-2xl font-bold hover:bg-secondary transition-colors"
                  >+</button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Delivery Zones */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">Delivery pricing</h2>
                <p className="text-foreground/60 text-sm mt-1">Set fees based on distance from your home.</p>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {zones.map((zone, index) => (
                  <div key={index} className="bg-muted/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={zone.zone_name}
                        onChange={e => updateZone(index, 'zone_name', e.target.value)}
                        className="text-sm font-bold bg-transparent text-foreground focus:outline-none"
                      />
                      {zones.length > 1 && (
                        <button onClick={() => removeZone(index)} className="text-foreground/30 hover:text-red-400 text-lg">×</button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-foreground/50">From (KM)</label>
                        <input type="number" value={zone.min_km} onChange={e => updateZone(index, 'min_km', +e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-muted bg-card focus:border-primary focus:outline-none text-sm font-medium" />
                      </div>
                      <div>
                        <label className="text-xs text-foreground/50">To (KM)</label>
                        <input type="number" value={zone.max_km} onChange={e => updateZone(index, 'max_km', +e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-muted bg-card focus:border-primary focus:outline-none text-sm font-medium" />
                      </div>
                      <div>
                        <label className="text-xs text-foreground/50">Fee (RM)</label>
                        <input type="number" value={zone.fee} onChange={e => updateZone(index, 'fee', +e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-muted bg-card focus:border-primary focus:outline-none text-sm font-medium" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addZone} className="w-full h-10 rounded-2xl border-2 border-dashed border-primary/30 text-primary/60 text-sm font-medium hover:border-primary hover:text-primary transition-colors">
                + Add Zone
              </button>
            </div>
          )}

          {/* Step 4: Payment */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Payment setup</h2>
                <p className="text-foreground/60 text-sm mt-1">For manual transfers and invoice generation.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-foreground/80 block mb-2">Bank Name</label>
                  <input type="text" placeholder="e.g. Maybank" value={settings.bank_name} onChange={e => updateSettings('bank_name', e.target.value)}
                    className="w-full h-12 px-4 rounded-2xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-foreground font-medium transition-colors" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground/80 block mb-2">Account Number</label>
                  <input type="text" placeholder="e.g. 1234567890" value={settings.bank_account} onChange={e => updateSettings('bank_account', e.target.value)}
                    className="w-full h-12 px-4 rounded-2xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-foreground font-medium transition-colors" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground/80 block mb-2">Account Holder Name</label>
                  <input type="text" placeholder="e.g. WAN AHMAD BIN IBRAHIM" value={settings.bank_holder} onChange={e => updateSettings('bank_holder', e.target.value)}
                    className="w-full h-12 px-4 rounded-2xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-foreground font-medium transition-colors" />
                </div>
                <div className="bg-muted/40 rounded-2xl p-4 text-sm text-foreground/60">
                  🔒 ToyyibPay credentials can be added later in <span className="font-semibold">Settings</span>.
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 rounded-xl text-red-600 text-sm font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button onClick={handleBack} className="h-14 px-6 rounded-2xl border-2 border-muted text-foreground/70 font-semibold hover:bg-muted transition-colors">
                Back
              </button>
            )}
            {step < TOTAL_STEPS - 1 ? (
              <button onClick={handleNext} className="flex-1 h-14 rounded-2xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
                Continue →
              </button>
            ) : (
              <button onClick={handleFinish} disabled={loading} className="flex-1 h-14 rounded-2xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? 'Setting up...' : '🎉 Launch My Bakery!'}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-foreground/40 text-xs mt-6">
          You can change all settings anytime from your dashboard.
        </p>
      </div>
    </div>
  );
}
