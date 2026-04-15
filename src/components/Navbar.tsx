'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Home, Target, Tv, Trophy, Settings, HelpCircle } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/picks', label: 'Picks', icon: Target },
  { href: '/episodes', label: 'Episodes', icon: Tv },
  { href: '/leaderboard', label: 'Standings', icon: Trophy },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  function replayGuide() {
    localStorage.removeItem('fantasy-gbbo-onboarding');
    if (pathname === '/') {
      window.location.reload();
    } else {
      router.push('/');
    }
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden md:block sticky top-0 z-50 bg-cream/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber flex items-center justify-center">
              <span className="text-white text-xs font-bold">FB</span>
            </div>
            <span className="font-display text-lg text-ink">Fantasy Bake Off</span>
          </Link>
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-amber-subtle text-amber-dark'
                      : 'text-ink-muted hover:text-ink hover:bg-cream-dark'
                  }`}
                >
                  <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={replayGuide}
              title="How to play"
              aria-label="How to play guide"
              className="ml-1 p-2 rounded-lg transition-colors text-ink-faint hover:text-ink-muted hover:bg-cream-dark"
            >
              <HelpCircle size={16} />
            </button>
            <Link
              href="/admin"
              title="Admin"
              aria-label="Admin settings"
              className={`p-2 rounded-lg transition-colors ${
                pathname.startsWith('/admin')
                  ? 'bg-amber-subtle text-amber-dark'
                  : 'text-ink-faint hover:text-ink-muted hover:bg-cream-dark'
              }`}
            >
              <Settings size={16} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-xl border-t border-border">
        <div className="flex items-stretch h-16 px-1 max-w-md mx-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative ${
                  active ? 'text-amber-dark' : 'text-ink-muted'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-amber" />
                )}
                <Icon size={20} strokeWidth={active ? 2.5 : 1.75} />
                <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
