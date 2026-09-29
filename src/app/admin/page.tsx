'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Episode } from '@/lib/types';
import { useAdmin } from '@/hooks/usePlayer';
import { Lock, Tv, ChefHat, Users, LogOut, ChevronRight, ClipboardCheck, Target } from 'lucide-react';

export default function AdminPage() {
  const { isAdmin, login, logout, loaded } = useAdmin();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    // The week the commissioner is most likely here for: the one in play, else the last one scored.
    supabase.from('episodes').select('*').order('week_number').then(({ data }) => {
      const episodes = (data as Episode[] | null) ?? [];
      const inPlay = episodes.find((e) => e.status === 'open' || e.status === 'locked');
      const lastScored = episodes.filter((e) => e.status === 'scored').pop();
      setCurrentEpisode(inPlay ?? lastScored ?? null);
    });
  }, [isAdmin]);

  if (!loaded) return null;

  if (!isAdmin) {
    return (
      <div className="max-w-sm mx-auto pt-16 animate-fade-up">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-cream-dark flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-ink-muted" />
          </div>
          <h1 className="font-display text-2xl text-ink">Admin Access</h1>
          <p className="text-ink-muted text-sm mt-1">Enter the commissioner PIN</p>
        </div>
        <div className="card p-6">
          <label htmlFor="admin-pin-input" className="sr-only">Commissioner PIN</label>
          <input
            id="admin-pin-input"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !login(pin)) { setError(true); setPin(''); }
            }}
            placeholder="Enter PIN"
            className="input text-center text-2xl tracking-[0.3em] font-medium"
            autoFocus
          />
          {error && <p className="text-terracotta text-sm text-center mt-2">Wrong PIN. Try again.</p>}
          <button
            onClick={() => { if (!login(pin)) { setError(true); setPin(''); } }}
            className="btn btn-primary w-full mt-4"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  const links = [
    { href: '/admin/episodes', label: 'Episodes', desc: 'Create, open, lock, results & player picks', icon: Tv },
    { href: '/admin/contestants', label: 'Contestants', desc: 'Add bakers, mark eliminations', icon: ChefHat },
    { href: '/admin/players', label: 'Players', desc: 'Add players, change colors', icon: Users },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Admin</h1>
        <button onClick={logout} className="btn btn-secondary btn-sm">
          <LogOut size={14} />
          Lock
        </button>
      </div>

      {currentEpisode && (
        <section className="card p-4 space-y-3">
          <div>
            <p className="eyebrow">Week {currentEpisode.week_number}</p>
            <h2 className="font-display text-xl text-ink leading-tight">{currentEpisode.theme}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link href={`/admin/results/${currentEpisode.week_number}`} className="btn btn-primary min-h-12">
              <ClipboardCheck size={16} />
              {currentEpisode.status === 'scored' ? 'Edit results' : 'Enter results'}
            </Link>
            <Link href={`/admin/picks/${currentEpisode.week_number}`} className="btn btn-secondary min-h-12">
              <Target size={16} />
              Enter or fix player picks
            </Link>
          </div>
        </section>
      )}

      <div className="space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="card card-interactive p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-cream-dark flex items-center justify-center shrink-0">
                <Icon size={20} className="text-ink-secondary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-ink">{link.label}</h3>
                <p className="text-sm text-ink-muted">{link.desc}</p>
              </div>
              <ChevronRight size={18} className="text-ink-faint shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
