'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Player, CATEGORIES, PLAYER_COLORS, getPlayerColor } from '@/lib/types';
import { usePlayer } from '@/hooks/usePlayer';
import { CakeSlice, User, Palette, Trophy, Lock, AlertTriangle, Rocket, ChevronRight, ChevronLeft } from 'lucide-react';

const ONBOARDING_KEY = 'fantasy-gbbo-onboarding';
const TOTAL_STEPS = 7;

export default function Onboarding() {
  const router = useRouter();
  const { playerId, setPlayerId } = usePlayer();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [playersError, setPlayersError] = useState(false);
  const [pinPrompt, setPinPrompt] = useState<Player | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // selectedPlayer is fully derived from playerId + players, so there's no
  // separate state to keep in sync — it just recomputes on every render.
  const selectedPlayer = players.find((p) => p.id === playerId) || null;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(ONBOARDING_KEY) !== 'done') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hydration, must run on mount
      setVisible(true);
    }
  }, []);

  const fetchPlayers = useCallback(() => {
    setPlayersLoading(true);
    setPlayersError(false);
    supabase.from('players').select('*').order('name').then(({ data, error }) => {
      if (error) {
        setPlayersError(true);
      } else {
        setPlayers(data || []);
      }
      setPlayersLoading(false);
    });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load-on-mount fetch
    fetchPlayers();
  }, [fetchPlayers]);

  const finish = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'done');
    setVisible(false);
  }, []);

  const skip = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'done');
    setVisible(false);
  }, []);

  function handlePlayerClick(player: Player) {
    if (player.pin) {
      setPinPrompt(player);
      setPinInput('');
      setPinError(false);
    } else {
      setPlayerId(player.id);
    }
  }

  function handlePinSubmit() {
    if (!pinPrompt) return;
    if (pinInput === pinPrompt.pin) {
      setPlayerId(pinPrompt.id);
      setPinPrompt(null);
    } else {
      setPinError(true);
    }
  }

  async function changeColor(colorKey: string) {
    if (!selectedPlayer) return;
    await supabase.from('players').update({ color: colorKey }).eq('id', selectedPlayer.id);
    const updated = { ...selectedPlayer, color: colorKey as Player['color'] };
    setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function goToPicksAndFinish() {
    finish();
    router.push('/picks');
  }

  if (!visible) return null;

  // Don't leave the user stuck behind a disabled Next button when there's
  // nobody to pick (fetch failed, or the commissioner hasn't added anyone
  // yet) — only require a selection once we know players are actually there.
  const canAdvance =
    step === 1 ? !!selectedPlayer || playersError || (!playersLoading && players.length === 0) : true;

  const steps = [
    // Step 0: Welcome
    <div key="welcome" className="text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-amber-subtle flex items-center justify-center mx-auto">
        <CakeSlice size={32} className="text-amber-dark" />
      </div>
      <h2 className="font-display text-2xl text-ink">Welcome to<br />Fantasy Bake Off</h2>
      <p className="text-sm text-ink-muted leading-relaxed">
        Predict who&apos;ll shine and who&apos;ll crumble each week.
        Pick contestants for each category, lock a pick for double points,
        and compete against your family for baking bragging rights.
      </p>
    </div>,

    // Step 1: Pick your name
    <div key="name" className="space-y-4">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-cream-dark flex items-center justify-center mx-auto mb-3">
          <User size={24} className="text-ink-muted" />
        </div>
        <h2 className="font-display text-xl text-ink">Who are you?</h2>
        <p className="text-sm text-ink-muted mt-1">Tap your name to get started</p>
      </div>
      {playersLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-[52px] w-full rounded-xl" />)}
        </div>
      ) : playersError ? (
        <div className="text-center py-4">
          <p className="text-sm text-red-700 mb-3">Couldn&apos;t reach the server</p>
          <button onClick={fetchPlayers} className="btn btn-secondary btn-sm">Retry</button>
        </div>
      ) : players.length === 0 ? (
        <p className="text-sm text-ink-muted text-center py-4">
          No players yet — ask the commissioner to add you in Admin.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {players.map((player) => {
            const color = getPlayerColor(player.color);
            const isSelected = selectedPlayer?.id === player.id;
            return (
              <button
                key={player.id}
                onClick={() => handlePlayerClick(player)}
                className={`p-3 rounded-xl flex items-center gap-2.5 text-left transition-all border ${
                  isSelected
                    ? 'bg-amber-subtle border-amber ring-1 ring-amber/20'
                    : 'bg-surface border-border hover:border-ink-faint'
                }`}
              >
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: color.bg, color: color.text }}>
                  {player.name[0]}
                </span>
                <span className="font-semibold text-ink text-sm">{player.name}</span>
              </button>
            );
          })}
        </div>
      )}
      {pinPrompt && (
        <div className="p-3 rounded-xl border border-border bg-cream animate-fade-up">
          <label htmlFor="onboarding-pin-input" className="text-sm font-medium text-ink mb-2 block">
            Enter PIN for {pinPrompt.name}
          </label>
          <div className="flex gap-2">
            <input
              id="onboarding-pin-input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm text-center tracking-widest ${pinError ? 'border-red-300 bg-red-50' : 'border-border bg-surface'}`}
              placeholder="••••"
              autoFocus
            />
            <button onClick={handlePinSubmit} className="btn btn-primary btn-sm">Go</button>
          </div>
          {pinError && <p className="text-xs text-red-600 mt-1">Wrong PIN.</p>}
        </div>
      )}
    </div>,

    // Step 2: Choose your color
    <div key="color" className="text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-cream-dark flex items-center justify-center mx-auto">
        <Palette size={24} className="text-ink-muted" />
      </div>
      <h2 className="font-display text-xl text-ink">Pick your color</h2>
      <p className="text-sm text-ink-muted">This is how you&apos;ll appear on the leaderboard</p>
      {selectedPlayer && (
        <>
          <div className="flex justify-center">
            <span className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: getPlayerColor(selectedPlayer.color).bg, color: getPlayerColor(selectedPlayer.color).text }}>
              {selectedPlayer.name[0]}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2 max-w-[200px] mx-auto">
            {PLAYER_COLORS.map((c) => {
              const takenBy = players.find((p) => p.id !== selectedPlayer.id && p.color === c.key);
              return (
                <button
                  key={c.key}
                  onClick={() => !takenBy && changeColor(c.key)}
                  disabled={!!takenBy}
                  className={`w-9 h-9 rounded-full transition-all ${
                    selectedPlayer.color === c.key
                      ? 'ring-2 ring-offset-2 ring-ink-muted scale-110'
                      : takenBy
                      ? 'opacity-25 cursor-not-allowed'
                      : 'hover:scale-110'
                  }`}
                  style={{ background: c.bg }}
                  title={takenBy ? `Taken by ${takenBy.name}` : c.label}
                />
              );
            })}
          </div>
        </>
      )}
    </div>,

    // Step 3: How scoring works
    <div key="scoring" className="space-y-4">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-cream-dark flex items-center justify-center mx-auto mb-3">
          <Trophy size={24} className="text-amber" />
        </div>
        <h2 className="font-display text-xl text-ink">How scoring works</h2>
        <p className="text-sm text-ink-muted mt-1">Pick correctly to earn points each week</p>
      </div>
      <div className="space-y-1.5">
        {CATEGORIES.map((cat) => (
          <div key={cat.key} className="flex items-center justify-between py-2 px-3 rounded-lg bg-cream">
            <span className="text-sm font-medium text-ink">{cat.label}</span>
            <span className="text-sm font-semibold text-ink-muted tabular-nums">{cat.points} pts</span>
          </div>
        ))}
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-cream">
          <span className="text-sm font-medium text-ink">Winner Guess</span>
          <span className="text-sm font-semibold text-ink-muted tabular-nums">7-10 pts</span>
        </div>
      </div>
      <p className="text-xs text-ink-muted text-center">Winner guess points are awarded at the finale</p>
    </div>,

    // Step 4: The lock
    <div key="lock" className="text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-amber-subtle flex items-center justify-center mx-auto">
        <Lock size={24} className="text-amber-dark" />
      </div>
      <h2 className="font-display text-xl text-ink">Lock a pick</h2>
      <p className="text-sm text-ink-muted leading-relaxed">
        Each week you can lock <strong>one</strong> category for double points.
        But if you&apos;re wrong, you lose half the base value.
      </p>
      <div className="space-y-2 text-left">
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-sage-subtle">
          <span className="text-sm text-sage font-medium">Correct + Locked</span>
          <span className="text-sm font-bold text-sage">2x points</span>
        </div>
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-red-50">
          <span className="text-sm text-red-700 font-medium">Wrong + Locked</span>
          <span className="text-sm font-bold text-red-700">-half points</span>
        </div>
      </div>
      <p className="text-xs text-ink-muted">Locking is optional — you don&apos;t have to lock anything</p>
    </div>,

    // Step 5: Penalties
    <div key="penalties" className="text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
        <AlertTriangle size={24} className="text-red-400" />
      </div>
      <h2 className="font-display text-xl text-ink">Watch out for penalties</h2>
      <p className="text-sm text-ink-muted leading-relaxed">
        Two situations cost you a point:
      </p>
      <div className="space-y-2 text-left">
        <div className="py-2.5 px-3 rounded-lg bg-cream">
          <p className="text-sm text-ink font-medium">You pick someone for Star Baker</p>
          <p className="text-xs text-terracotta mt-0.5">...and they get sent home → -1 pt</p>
        </div>
        <div className="py-2.5 px-3 rounded-lg bg-cream">
          <p className="text-sm text-ink font-medium">You pick someone to go home</p>
          <p className="text-xs text-terracotta mt-0.5">...and they win Star Baker → -1 pt</p>
        </div>
      </div>
    </div>,

    // Step 6: You're ready!
    <div key="ready" className="text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-sage-subtle flex items-center justify-center mx-auto">
        <Rocket size={32} className="text-sage" />
      </div>
      <h2 className="font-display text-2xl text-ink">You&apos;re ready!</h2>
      <p className="text-sm text-ink-muted leading-relaxed">
        Head to the Picks page to make your first predictions.
        Check the Standings page to see how you stack up.
        Good luck!
      </p>
      <button
        onClick={goToPicksAndFinish}
        className="btn btn-primary btn-lg w-full"
      >
        <Rocket size={18} />
        Make Your Picks
      </button>
    </div>,
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-md animate-fade-up">
        <div className="card p-6 shadow-xl max-h-[85vh] overflow-y-auto">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 bg-amber' : i < step ? 'w-1.5 bg-amber/40' : 'w-1.5 bg-border'
                }`}
              />
            ))}
          </div>

          {/* Step content */}
          <div className="min-h-[320px] flex flex-col justify-center">
            {steps[step]}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
            <div>
              {step > 0 ? (
                <button
                  onClick={() => setStep(step - 1)}
                  className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors"
                >
                  <ChevronLeft size={14} />
                  Back
                </button>
              ) : (
                <button
                  onClick={skip}
                  className="text-sm text-ink-faint hover:text-ink-muted transition-colors"
                >
                  Skip
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {step > 0 && step < TOTAL_STEPS - 1 && (
                <button
                  onClick={skip}
                  className="text-sm text-ink-faint hover:text-ink-muted transition-colors"
                >
                  Skip
                </button>
              )}
              {step < TOTAL_STEPS - 1 && (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!canAdvance}
                  className="btn btn-primary btn-sm"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
