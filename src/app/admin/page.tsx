'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAdmin } from '@/hooks/usePlayer';
import { Lock, Tv, ChefHat, LogOut, ChevronRight } from 'lucide-react';

export default function AdminPage() {
  const { isAdmin, login, logout, loaded } = useAdmin();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

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
          <input
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
    { href: '/admin/episodes', label: 'Episodes', desc: 'Create, open, lock & enter results', icon: Tv },
    { href: '/admin/contestants', label: 'Contestants', desc: 'Add bakers, mark eliminations', icon: ChefHat },
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
