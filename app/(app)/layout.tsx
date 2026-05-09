'use client';

import { useEffect } from 'react';
import { MainSidebar } from '@/components/main-sidebar';
import { useAppStore } from '@/lib/useAppStore';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const initialize = useAppStore((state) => state.initialize);

  // Initialize store from localStorage on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div className="min-h-screen bg-background flex">
      <MainSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
