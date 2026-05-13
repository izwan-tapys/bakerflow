'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const PUBLIC_PATHS = ['/login', '/order'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));
    if (isPublic) {
      setChecking(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push('/login');
        return;
      }

      // Check setup status for all private routes EXCEPT setup itself
      if (!pathname.startsWith('/dashboard/setup')) {
        const { data: settings } = await supabase
          .from('baker_settings')
          .select('is_setup_complete')
          .eq('baker_id', session.user.id)
          .single();

        if (!settings || !settings.is_setup_complete) {
          router.push('/dashboard/setup');
          return;
        }
      }
      
      setChecking(false);
    });
  }, [pathname, router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-primary rounded-2xl mx-auto animate-pulse" />
          <p className="text-foreground/40 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
