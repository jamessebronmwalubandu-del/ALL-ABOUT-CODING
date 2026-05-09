'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Activity,
  BarChart3,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface MainSidebarProps {
  className?: string;
}

export function MainSidebar({ className }: MainSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const links = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: Activity,
    },
    {
      label: 'Results',
      href: '/results',
      icon: BarChart3,
    },
    {
      label: 'History',
      href: '/history',
      icon: History,
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: Settings,
    },
  ];

  return (
    <aside
      className={cn(
        'border-r border-border/50 bg-card/50 transition-all duration-300 flex flex-col',
        isCollapsed ? 'w-16' : 'w-56',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">PSD Analyzer</h2>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8"
        >
          {isCollapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-2 overflow-auto">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href);
          const Icon = link.icon;

          return (
            <Link key={link.href} href={link.href}>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                size={isCollapsed ? 'icon' : 'sm'}
                className={cn(
                  'w-full transition-colors',
                  isActive && 'bg-primary/10 text-primary hover:bg-primary/20'
                )}
                title={isCollapsed ? link.label : undefined}
              >
                <Icon className={cn('size-4', !isCollapsed && 'mr-2')} />
                {!isCollapsed && <span className="text-xs">{link.label}</span>}
              </Button>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
