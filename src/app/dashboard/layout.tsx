'use client';

import React, { useState, useEffect } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { BottomNav, SideNav } from '@/components/navigation/Nav';
import { useRouter, usePathname } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Define the swipeable pages in order
  const tabs = [
    '/dashboard/production',
    '/dashboard/planner',
    '/dashboard/inventory'
  ];

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    const currentIndex = tabs.indexOf(pathname);
    if (currentIndex === -1) return;

    if (isLeftSwipe && currentIndex < tabs.length - 1) {
      router.push(tabs[currentIndex + 1]);
    }
    if (isRightSwipe && currentIndex > 0) {
      router.push(tabs[currentIndex - 1]);
    }
  };

  return (
    <AuthGuard>
      <div 
        className="min-h-screen bg-background flex"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Sidebar for desktop */}
        <SideNav />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6 p-4 md:p-8 max-w-2xl mx-auto md:max-w-none w-full">
          {children}
        </main>

        {/* Bottom nav for mobile */}
        <BottomNav />
      </div>
    </AuthGuard>
  );
}
