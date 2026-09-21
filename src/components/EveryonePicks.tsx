'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Contestant, Pick, PickCategory, Player, getPlayerColor } from '@/lib/types';
import ContestantAvatar from '@/components/ContestantAvatar';

interface EveryonePicksProps {
  categories: { key: PickCategory; label: string; points: number }[];
  players: Player[];
  contestants: Contestant[];
  picks: Pick[];
}

// Who picked whom — per player, or grouped by baker within each category.
// Only rendered once picks are closed.
export default function EveryonePicks({ categories, players, contestants, picks }: EveryonePicksProps) {
  const submitted = new Set(picks.map((p) => p.player_id));
  const missing = players.filter((p) => !submitted.has(p.id));
  const [view, setView] = useState<'player' | 'baker'>('player');

  return (
    <div className="space-y-4 animate-fade-up">
      <div>
        <h2 className="font-display text-xl text-ink">Everyone&apos;s picks</h2>
        <p className="text-sm text-ink-muted mt-0.5">
          <Lock size={11} className="inline-block -mt-0.5 mr-1 text-amber" />
          marks a locked pick &mdash; double points if right, a penalty if wrong.
        </p>
      </div>

      <div className="inline-flex p-1 rounded-xl bg-cream-dark/60" role="group" aria-label="Group picks by">
        {([['player', 'By player'], ['baker', 'By baker']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            aria-pressed={view === key}
            className={`min-h-10 px-4 rounded-lg text-sm font-medium transition-colors ${
              view === key ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'player' &&
        players
          .filter((pl) => submitted.has(pl.id))
          .map((player) => (
            <section key={player.id} className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getPlayerColor(player.color).bg }} />
                <h3 className="font-semibold text-ink text-sm">{player.name}</h3>
              </div>
              <ul className="divide-y divide-border/60">
                {categories.map((cat) => {
                  const pick = picks.find((p) => p.player_id === player.id && p.category === cat.key);
                  const contestant = pick ? contestants.find((c) => c.id === pick.contestant_id) : undefined;
                  return (
                    <li key={cat.key} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="text-xs text-ink-muted w-28 shrink-0 leading-tight">{cat.label}</span>
                      {contestant ? (
                        <>
                          <ContestantAvatar contestant={contestant} className="w-8 h-8 text-xs" />
                          <span className="font-medium text-ink flex-1 min-w-0 truncate">{contestant.name}</span>
                          {pick?.locked && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-dark shrink-0">
                              <Lock size={11} className="text-amber" aria-hidden="true" />
                              Locked
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-ink-muted">No pick</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

      {view === 'baker' && categories.map((cat) => {
        const catPicks = picks.filter((p) => p.category === cat.key);
        const groups = contestants
          .map((c) => ({
            contestant: c,
            backers: catPicks
              .filter((p) => p.contestant_id === c.id)
              .map((p) => ({ player: players.find((pl) => pl.id === p.player_id), locked: !!p.locked }))
              .filter((b): b is { player: Player; locked: boolean } => !!b.player)
              .sort((a, b) => a.player.name.localeCompare(b.player.name)),
          }))
          .filter((g) => g.backers.length > 0)
          .sort((a, b) => b.backers.length - a.backers.length || a.contestant.name.localeCompare(b.contestant.name));
        const skipped = players.filter((pl) => submitted.has(pl.id) && !catPicks.some((p) => p.player_id === pl.id));

        return (
          <section key={cat.key} className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-baseline justify-between">
              <h3 className="font-semibold text-ink text-sm">{cat.label}</h3>
              <span className="text-xs text-ink-muted">{cat.points} pts</span>
            </div>
            {groups.length === 0 ? (
              <p className="p-4 text-sm text-ink-muted">Nobody picked this one.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {groups.map(({ contestant, backers }) => (
                  <li key={contestant.id} className="px-4 py-3 flex items-center gap-3">
                    <ContestantAvatar contestant={contestant} className="w-10 h-10 text-sm" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-ink leading-tight">{contestant.name}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {backers.map(({ player, locked }) => (
                          <span
                            key={player.id}
                            className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full bg-cream text-xs font-medium text-ink-secondary"
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: getPlayerColor(player.color).bg }} />
                            {player.name}
                            {locked && <Lock size={10} className="text-amber shrink-0" aria-label="locked pick" />}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-ink-muted tabular-nums shrink-0">
                      {backers.length}/{submitted.size}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {skipped.length > 0 && (
              <p className="px-4 py-2 border-t border-border/60 text-xs text-ink-muted">
                No pick: {skipped.map((p) => p.name).join(', ')}
              </p>
            )}
          </section>
        );
      })}

      {missing.length > 0 && (
        <p className="text-xs text-ink-muted text-center">
          Didn&apos;t submit this week: {missing.map((p) => p.name).join(', ')}
        </p>
      )}
    </div>
  );
}
