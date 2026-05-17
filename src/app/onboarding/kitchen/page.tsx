'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ChefHat, 
  Flame, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Sparkles,
  UtensilsCrossed,
  Info
} from 'lucide-react';

export default function KitchenOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bakerId, setBakerId] = useState<string | null>(null);

  // Onboarding wizard choices state
  const [mixerSize, setMixerSize] = useState<number>(4.8);
  const [ovenBcu, setOvenBcu] = useState<number>(4);
  const [chillerBcu, setChillerBcu] = useState<number>(8);

  useEffect(() => {
    const checkUser = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setBakerId(user.id);
        // Pre-fill if there are existing settings
        const { data } = await supabase
          .from('baker_settings')
          .select('*')
          .eq('baker_id', user.id)
          .maybeSingle();
        
        if (data) {
          setMixerSize(Number(data.mixer_bowl_capacity_liters ?? 4.8));
          setOvenBcu(data.oven_bcu_capacity ?? 4);
          setChillerBcu(data.chiller_bcu_capacity ?? 8);
        }
      } else {
        // Redirect to login if not authenticated
        router.push('/login');
      }
      setLoading(false);
    };

    checkUser();
  }, [router]);

  const handleFinishOnboarding = async () => {
    if (!bakerId) return;
    setSaving(true);

    try {
      // 1. Get or create baker settings record
      const { data: existingSettings } = await supabase
        .from('baker_settings')
        .select('id')
        .eq('baker_id', bakerId)
        .order('updated_at', { ascending: false })
        .limit(1);

      const existingId = existingSettings && existingSettings.length > 0 ? existingSettings[0].id : undefined;

      // 2. Upsert kitchen hardware capacities into DB
      const { error } = await supabase
        .from('baker_settings')
        .upsert({
          id: existingId,
          baker_id: bakerId,
          mixer_bowl_capacity_liters: mixerSize,
          oven_bcu_capacity: ovenBcu,
          chiller_bcu_capacity: chillerBcu,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      // 3. Move to celebration screen before redirecting
      setStep(4);
      setTimeout(() => {
        router.push('/dashboard/planner');
      }, 3000);
    } catch (err: any) {
      alert('Gagal menyimpan tetapan onboarding: ' + (err.message || 'Ralat tidak diketahui'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/40 animate-pulse">Sediakan Dapur Pintar Anda...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Visual background blobs for premium aesthetic */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-orange-500/10 blur-[120px] pointer-events-none" />

      {/* Main glass card container */}
      <div className="w-full max-w-lg bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col relative z-10 transition-all duration-500 overflow-hidden min-h-[500px] justify-between">
        
        {/* Step Indicator Headers */}
        {step < 4 && (
          <div className="flex-none">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <ChefHat className="w-6 h-6 text-primary animate-bounce" />
                <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Know Your Kitchen</span>
              </div>
              <span className="text-xs font-black text-foreground/40">LANGKAH {step} DARI 3</span>
            </div>

            {/* Visual Step Progress Bar */}
            <div className="h-1.5 w-full bg-slate-800 rounded-full mb-8 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-orange-500 rounded-full transition-all duration-500" 
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Step Contents */}
        <div className="flex-1 flex flex-col justify-center py-4">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-300">
              <div className="space-y-2 text-center">
                <div className="text-5xl mb-2">🥣</div>
                <h1 className="text-xl font-extrabold tracking-tight">Berapakah Kapasiti Mixer Anda?</h1>
                <p className="text-xs text-foreground/50 font-medium">
                  Isipadu mangkuk Stand Mixer utama Kak Sue (untuk mengira beban adunan maksimum).
                </p>
              </div>

              {/* Liters Stepper Input */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-800/40 rounded-2xl border border-white/5 space-y-4">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => setMixerSize(prev => Math.max(2.0, Number((prev - 0.5).toFixed(1))))}
                    className="w-12 h-12 bg-slate-800 rounded-xl hover:bg-slate-700 text-white font-black text-xl active:scale-90 transition-all flex items-center justify-center border border-white/10"
                  >
                    -
                  </button>
                  <div className="text-center w-28">
                    <span className="text-4xl font-black text-primary block leading-none">{mixerSize}</span>
                    <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest mt-1 block">Liters</span>
                  </div>
                  <button 
                    onClick={() => setMixerSize(prev => Number((prev + 0.5).toFixed(1)))}
                    className="w-12 h-12 bg-slate-800 rounded-xl hover:bg-slate-700 text-white font-black text-xl active:scale-90 transition-all flex items-center justify-center border border-white/10"
                  >
                    +
                  </button>
                </div>

                {/* Info Tip Badge */}
                <div className="flex gap-2 p-3 bg-primary/5 rounded-xl border border-primary/10 text-[10px] text-foreground/60 leading-normal font-semibold">
                  <Info className="w-4 h-4 text-primary flex-none" />
                  <span>Kebanyakan homebaker menggunakan mixer bersaiz 4.8L (KitchenAid Artisan) or 6.9L (Heavy Duty).</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-300">
              <div className="space-y-2 text-center">
                <div className="text-5xl mb-2">🔥</div>
                <h1 className="text-xl font-extrabold tracking-tight">Kapasiti Membakar Oven Anda?</h1>
                <p className="text-xs text-foreground/50 font-medium">
                  Berapa biji loyang bulat 8-inci yang muat dibakar serentak di dalam oven?
                </p>
              </div>

              {/* BCU Oven Stepper Input */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-800/40 rounded-2xl border border-white/5 space-y-4">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => setOvenBcu(prev => Math.max(1, prev - 1))}
                    className="w-12 h-12 bg-slate-800 rounded-xl hover:bg-slate-700 text-white font-black text-xl active:scale-90 transition-all flex items-center justify-center border border-white/10"
                  >
                    -
                  </button>
                  <div className="text-center w-28">
                    <span className="text-4xl font-black text-primary block leading-none">{ovenBcu}</span>
                    <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest mt-1 block">Loyang 8-Inci</span>
                  </div>
                  <button 
                    onClick={() => setOvenBcu(prev => prev + 1)}
                    className="w-12 h-12 bg-slate-800 rounded-xl hover:bg-slate-700 text-white font-black text-xl active:scale-90 transition-all flex items-center justify-center border border-white/10"
                  >
                    +
                  </button>
                </div>

                {/* Oven Capacity Visual Guide */}
                <div className="grid grid-cols-4 gap-2 w-full max-w-[200px] mt-2 justify-center">
                  {Array.from({ length: Math.min(8, ovenBcu) }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary animate-pulse">
                      8&quot;
                    </div>
                  ))}
                  {ovenBcu > 8 && (
                    <div className="aspect-square rounded-full bg-slate-800 text-[10px] font-bold text-foreground/60 flex items-center justify-center border border-white/10">
                      +{ovenBcu - 8}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-300">
              <div className="space-y-2 text-center">
                <div className="text-5xl mb-2">❄️</div>
                <h1 className="text-xl font-extrabold tracking-tight">Kapasiti Peti Sejuk (Chiller)?</h1>
                <p className="text-xs text-foreground/50 font-medium">
                  Berapa kotak kek saiz 8x8x4-inci muat disimpan di dalam chiller/peti sejuk sekaligus?
                </p>
              </div>

              {/* BCU Chiller Stepper Input */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-800/40 rounded-2xl border border-white/5 space-y-4">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => setChillerBcu(prev => Math.max(1, prev - 1))}
                    className="w-12 h-12 bg-slate-800 rounded-xl hover:bg-slate-700 text-white font-black text-xl active:scale-90 transition-all flex items-center justify-center border border-white/10"
                  >
                    -
                  </button>
                  <div className="text-center w-28">
                    <span className="text-4xl font-black text-primary block leading-none">{chillerBcu}</span>
                    <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest mt-1 block">Kotak 8x8</span>
                  </div>
                  <button 
                    onClick={() => setChillerBcu(prev => prev + 1)}
                    className="w-12 h-12 bg-slate-800 rounded-xl hover:bg-slate-700 text-white font-black text-xl active:scale-90 transition-all flex items-center justify-center border border-white/10"
                  >
                    +
                  </button>
                </div>

                <div className="flex gap-2 p-3 bg-orange-500/5 rounded-xl border border-orange-500/10 text-[10px] text-foreground/60 leading-normal font-semibold">
                  <Info className="w-4 h-4 text-orange-500 flex-none" />
                  <span>Ini bertujuan mengelakkan chiller Kak Sue melebihi bebanan (*chiller overload*) pada musim perayaan!</span>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 text-center animate-in scale-in duration-500 py-10">
              <div className="w-24 h-24 bg-gradient-to-tr from-primary to-orange-500 rounded-full flex items-center justify-center text-5xl mx-auto shadow-lg shadow-primary/20 animate-bounce">
                🎉
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-500 tracking-tight">DAPUR ANDA TELAH BERSEDIA!</h1>
                <p className="text-xs text-foreground/50 font-bold max-w-sm mx-auto uppercase tracking-wider leading-relaxed">
                  SKE (Smart Kitchen Capacity Engine) telah diaktifkan. Anda sedang dihalakan semula ke halaman Planner...
                </p>
              </div>

              {/* Progress bar visual spinner */}
              <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden mx-auto">
                <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '100%' }} />
              </div>
            </div>
          )}
        </div>

        {/* Action Button Navigation Controls */}
        {step < 4 && (
          <div className="flex-none pt-6 border-t border-white/5 flex gap-3">
            {step > 1 ? (
              <button 
                onClick={() => setStep(prev => (prev - 1) as any)}
                className="w-14 h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center hover:scale-[1.02] active:scale-95 transition-all border border-white/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <button 
                onClick={() => router.push('/dashboard/planner')}
                className="w-14 h-14 rounded-2xl bg-slate-800/40 hover:bg-slate-800 text-foreground/40 hover:text-foreground flex items-center justify-center active:scale-95 transition-all border border-transparent"
                title="Batal Onboarding"
              >
                &times;
              </button>
            )}

            {step < 3 ? (
              <button 
                onClick={() => setStep(prev => (prev + 1) as any)}
                className="flex-1 h-14 bg-gradient-to-r from-primary to-orange-500 hover:from-primary/95 hover:to-orange-500/95 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/10 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                Seterusnya <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                onClick={handleFinishOnboarding}
                disabled={saving}
                className="flex-1 h-14 bg-gradient-to-r from-primary to-orange-500 hover:from-primary/95 hover:to-orange-500/95 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/15 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  'Menyimpan...'
                ) : (
                  <>
                    Jom Mula Membakar! <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
