'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Building2, 
  UtensilsCrossed, 
  Truck, 
  Settings, 
  Calendar,
  Sparkles,
  Volume2,
  X,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { Toast } from '@/components/ui/Toast';

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [bakerId, setBakerId] = useState<string | null>(null);
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showSoundGuide, setShowSoundGuide] = useState(false);

  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type?: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    message: '',
    type: 'success'
  });

  const hubs = [
    { label: 'Office Settings', icon: <Building2 className="w-6 h-6 text-white" />, desc: 'Shop profile, pricing & invoicing', href: '/office/settings', color: 'bg-primary' },
    { label: 'Kitchen Settings', icon: <UtensilsCrossed className="w-6 h-6 text-white" />, desc: 'Capacity, timing & inventory alerts', href: '/kitchen/settings', color: 'bg-orange-500' },
    { label: 'Delivery Settings', icon: <Truck className="w-6 h-6 text-white" />, desc: 'Fees, zones & delivery windows', href: '/delivery/settings', color: 'bg-blue-600' },
  ];

  // 1. Get user and check Google link state
  const checkGoogleConnection = async () => {
    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setBakerId(user.id);
        const { data, error } = await supabase
          .from('baker_google_credentials')
          .select('id')
          .eq('baker_id', user.id)
          .maybeSingle();

        if (data && !error) {
          setIsGoogleLinked(true);
        } else {
          setIsGoogleLinked(false);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkGoogleConnection();
  }, []);

  // 2. Read URL params for Toast notifications
  useEffect(() => {
    const syncStatus = searchParams.get('google_sync');
    if (syncStatus === 'success') {
      setToast({
        isOpen: true,
        message: 'Akaun Google Calendar berjaya disambungkan! Jadual anda kini di-sync secara real-time. ⚡🔔',
        type: 'success'
      });
      // Clear URL params cleanly
      router.replace('/dashboard/settings');
    } else if (syncStatus === 'error') {
      const errMsg = searchParams.get('msg') || 'Ralat sambungan.';
      setToast({
        isOpen: true,
        message: `Gagal menyambung Google Calendar: ${errMsg}`,
        type: 'error'
      });
      router.replace('/dashboard/settings');
    }
  }, [searchParams, router]);

  // 3. Initiate Google OAuth connection
  const handleConnectGoogle = () => {
    if (!bakerId) {
      setToast({
        isOpen: true,
        message: 'Sila log masuk terlebih dahulu.',
        type: 'error'
      });
      return;
    }
    // Redirect browser to our authorization API
    window.location.href = `/api/auth/google?baker_id=${bakerId}`;
  };

  // 4. Disconnect Google connection
  const handleDisconnectGoogle = async () => {
    if (!bakerId) return;
    try {
      const { error } = await supabase
        .from('baker_google_credentials')
        .delete()
        .eq('baker_id', bakerId);

      if (error) throw error;

      setIsGoogleLinked(false);
      setToast({
        isOpen: true,
        message: 'Sambungan Google Calendar telah diputus secara selamat.',
        type: 'success'
      });
    } catch (e: any) {
      setToast({
        isOpen: true,
        message: `Ralat memutuskan sambungan: ${e.message}`,
        type: 'error'
      });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="pt-8 pb-4 flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary animate-spin-slow" />
          <div>
            <h1 className="text-2xl font-black text-foreground">Settings</h1>
            <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Global Configuration Hub</p>
          </div>
        </div>
      </div>

      {/* Main Settings Links */}
      <div className="space-y-4">
        {hubs.map((hub) => (
          <Link 
            key={hub.label}
            href={hub.href}
            className="flex items-center gap-4 bg-card p-5 rounded-xl border border-muted/50 shadow-sm active:scale-95 transition-all group hover:border-primary/20"
          >
            <div className={`w-14 h-14 ${hub.color} rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-black/5`}>
              {hub.icon}
            </div>
            <div className="flex-1">
              <h2 className="font-black text-foreground group-hover:text-primary transition-colors">{hub.label}</h2>
              <p className="text-xs font-medium text-foreground/40">{hub.desc}</p>
            </div>
            <div className="text-muted group-hover:text-primary transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* Google Calendar Link Card (NEW PREMIUM FEATURE) */}
      <div className="bg-card p-6 rounded-2xl border border-muted/80 shadow-md space-y-4 relative overflow-hidden">
        {/* Glow border decoration */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary to-orange-500" />
        
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-none">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-foreground">Google Calendar Alarm</h3>
                <span className="px-2 py-0.5 text-[8px] font-black uppercase rounded-md bg-primary/10 text-primary tracking-wider flex items-center gap-0.5">
                  PRO <Sparkles className="w-2.5 h-2.5 text-primary" />
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                Sinkronisasikan tugasan membakar ke Google Calendar telefon secara automatik!
              </p>
            </div>
          </div>
        </div>

        {checking ? (
          <div className="h-11 bg-muted/30 rounded-xl animate-pulse" />
        ) : isGoogleLinked ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-green-500/5 border border-green-500/20 p-3.5 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse flex-none" />
                <span className="text-[11px] font-black text-green-700 dark:text-green-300">Tersambung (Full Sync Aktif)</span>
              </div>
              <button 
                onClick={handleDisconnectGoogle}
                className="text-[10px] font-black text-red-500 hover:text-red-600 hover:underline uppercase tracking-wider cursor-pointer"
              >
                Putuskan Sambungan
              </button>
            </div>

            <button
              onClick={() => setShowSoundGuide(true)}
              className="w-full h-10 border border-muted bg-background hover:bg-muted/10 text-foreground text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-primary animate-bounce" /> Cara Set Bunyi Alarm Kuat
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleConnectGoogle}
              className="w-full h-11 bg-primary hover:bg-primary/95 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-md shadow-primary/10 cursor-pointer active:scale-[0.98]"
            >
              {/* Google stylized icon using inline SVG */}
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.555 0-6.435-2.88-6.435-6.435s2.88-6.435 6.435-6.435c1.637 0 3.136.612 4.3 1.62l3.05-3.05C19.23 2.38 15.93 1 12.24 1 5.92 1 1 5.92 1 12.24s4.92 11.24 11.24 11.24c5.96 0 10.9-4.28 11.66-9.875H12.24z"/>
              </svg>
              Sambung Akaun Google
            </button>
            <p className="text-[9px] text-center text-muted-foreground/60 font-bold">
              *Hanya memerlukan satu klik penyambungan sahaja seumur hidup.
            </p>
          </div>
        )}
      </div>

      {/* Guide & Build Info */}
      <div className="pt-4">
        <p className="text-center text-[10px] font-black uppercase text-foreground/20 tracking-[0.3em]">
          BakerFlow v2.0.0
        </p>
      </div>

      {/* Interactive Sound Customization Drawer Sheet Modal */}
      {showSoundGuide && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end justify-center z-50 animate-fadeIn">
          <div className="absolute inset-0 cursor-pointer" onClick={() => setShowSoundGuide(false)} />
          
          <div className="bg-card/95 backdrop-blur-md w-full max-w-md rounded-t-3xl border-t border-white/10 shadow-2xl p-6 pb-12 space-y-5 z-10 animate-slideUp">
            <div className="flex justify-between items-center pb-2 border-b border-muted">
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-primary" />
                <h3 className="font-extrabold text-foreground text-sm tracking-tight">Cara Set Bunyi Alarm Kuat</h3>
              </div>
              <button 
                onClick={() => setShowSoundGuide(false)}
                className="p-1 rounded-lg hover:bg-muted text-foreground/40 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-semibold text-foreground/80 leading-relaxed overflow-y-auto max-h-[350px] pr-2">
              <p className="text-muted-foreground text-[11px]">
                Secara rasmi, Google Calendar akan memainkan nada amaran yang telah disetkan pada telefon pintar anda. Ikuti langkah mudah di bawah untuk menetapkan nada paling kuat/panjang:
              </p>

              {/* Android Guide */}
              <div className="bg-muted/10 border border-muted p-4 rounded-xl space-y-2">
                <h4 className="font-black text-primary text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  🤖 Pengguna Android (Google Calendar)
                </h4>
                <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                  <li>Buka aplikasi <span className="font-extrabold text-foreground">Settings (Tetapan)</span> telefon anda.</li>
                  <li>Pergi ke <span className="font-extrabold text-foreground">Apps (Aplikasi)</span> &gt; <span className="font-extrabold text-foreground">Google Calendar</span>.</li>
                  <li>Pilih <span className="font-extrabold text-foreground">Notifications</span> &gt; <span className="font-extrabold text-foreground">Calendar Alerts</span>.</li>
                  <li>Klik <span className="font-extrabold text-foreground">Sound (Bunyi)</span> dan pilih nada dering atau musik alarm yang panjang dan sangat nyaring!</li>
                </ol>
              </div>

              {/* iPhone Guide */}
              <div className="bg-muted/10 border border-muted p-4 rounded-xl space-y-2">
                <h4 className="font-black text-orange-500 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  🍎 Pengguna iPhone (iOS)
                </h4>
                <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                  <li>Buka aplikasi <span className="font-extrabold text-foreground">Settings (Tetapan)</span> iPhone anda.</li>
                  <li>Pergi ke <span className="font-extrabold text-foreground">Notifications (Notifikasi)</span> &gt; <span className="font-extrabold text-foreground">Calendar</span>.</li>
                  <li>Pilih <span className="font-extrabold text-foreground">Upcoming Events (Acara Akan Datang)</span>.</li>
                  <li>Klik <span className="font-extrabold text-foreground">Sounds</span> dan pilih nada yang paling nyaring (cth: <span className="font-extrabold text-foreground">Alarm/Chime</span>).</li>
                </ol>
              </div>

              <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-xl border border-primary/10">
                <HelpCircle className="w-5 h-5 text-primary flex-none" />
                <p className="text-[10px] text-muted-foreground leading-normal font-bold">
                  *Sekarang, setiap kali BakerFlow tolak tugasan harian ke kalendar anda, telefon anda akan berdering bip dengan nada kuat pilihan anda sendiri!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowSoundGuide(false)}
              className="w-full h-11 bg-primary hover:bg-primary/95 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all"
            >
              Faham, Tutup Panduan
            </button>
          </div>
        </div>
      )}

      {/* Modern Premium Toast */}
      {toast.isOpen && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(prev => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
}

export default function SettingsHub() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-xs font-bold text-muted-foreground">Memuatkan tetapan...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
