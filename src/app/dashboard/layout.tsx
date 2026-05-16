'use client';

import React from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { BottomNav, SideNav } from '@/components/navigation/Nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background flex">
        {/* Sidebar for desktop */}
        <SideNav />

        <main className="flex-1 pb-20 md:pb-6 p-4 md:p-8 max-w-2xl mx-auto md:max-w-none w-full">
          {children}
        </main>

        {/* Bottom nav for mobile */}
        <BottomNav />
      </div>
    </AuthGuard>
  );
}
