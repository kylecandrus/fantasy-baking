'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Contestant, Episode } from '@/lib/types';
import { useAdmin } from '@/hooks/usePlayer';
import { ArrowLeft, Plus, Trash2, RotateCcw, ChevronDown, Camera } from 'lucide-react';

export default function AdminContestantsPage() {
  const { isAdmin, loaded } = useAdmin();
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [newName, setNewName] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  async function loadData() {
    const [contestantsRes, episodesRes] = await Promise.all([
      supabase.from('contestants').select('*').order('name'),
      supabase.from('episodes').select('*').order('week_number'),
    ]);
    if (contestantsRes.data) setContestants(contestantsRes.data);
    if (episodesRes.data) setEpisodes(episodesRes.data);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function addContestant() {
    if (!newName.trim()) return;
    setAdding(true);
    await supabase.from('contestants').insert({ name: newName.trim() });
    setNewName('');
    setAdding(false);
    await loadData();
  }

  async function addBulk() {
    const names = bulkNames.split('\n').map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    setAdding(true);
    await supabase.from('contestants').insert(names.map((name) => ({ name })));
    setBulkNames('');
    setShowBulk(false);
    setAdding(false);
    await loadData();
  }

  async function eliminate(contestant: Contestant, week: number | null) {
    await supabase.from('contestants').update({ eliminated_week: week }).eq('id', contestant.id);
    await loadData();
  }

  async function deleteContestant(contestant: Contestant) {
    if (!confirm(`Delete ${contestant.name}?`)) return;
    await supabase.from('contestants').delete().eq('id', contestant.id);
    await loadData();
  }

  async function uploadPhoto(contestant: Contestant, file: File) {
    setUploading(contestant.id);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${contestant.id}.${ext}`;

    // Remove old photo if it exists (different extension)
    const { data: existingFiles } = await supabase.storage.from('contestant-photos').list('', { search: contestant.id });
    if (existingFiles) {
      for (const f of existingFiles) {
        if (f.name.startsWith(contestant.id)) {
          await supabase.storage.from('contestant-photos').remove([f.name]);
        }
      }
    }

    const { error: uploadError } = await supabase.storage
      .from('contestant-photos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      alert(`Upload failed: ${uploadError.message}`);
      setUploading(null);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('contestant-photos')
      .getPublicUrl(path);

    // Append timestamp to bust cache
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase.from('contestants').update({ image_url: publicUrl }).eq('id', contestant.id);
    setUploading(null);
    await loadData();
  }

  if (!loaded || loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-6 w-24" />
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }
  if (!isAdmin) return <div className="card p-8 text-center"><Link href="/admin" className="text-amber-dark underline">Login to admin</Link></div>;

  const active = contestants.filter((c) => c.eliminated_week === null);
  const eliminated = contestants.filter((c) => c.eliminated_week !== null).sort((a, b) => (b.eliminated_week || 0) - (a.eliminated_week || 0));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors mb-1">
          <ArrowLeft size={14} /> Admin
        </Link>
        <h1 className="font-display text-2xl text-ink">Contestants</h1>
      </div>

      {/* Add contestant */}
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold text-ink text-sm">Add Contestant</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addContestant()}
            placeholder="Name"
            className="input flex-1"
          />
          <button onClick={addContestant} disabled={adding || !newName.trim()} className="btn btn-primary btn-sm shrink-0">
            <Plus size={15} />
            Add
          </button>
        </div>
        <button onClick={() => setShowBulk(!showBulk)} className="text-xs text-amber-dark hover:underline underline-offset-2 flex items-center gap-1">
          <ChevronDown size={12} className={`transition-transform ${showBulk ? 'rotate-180' : ''}`} />
          {showBulk ? 'Hide' : 'Add multiple at once'}
        </button>
        {showBulk && (
          <div className="space-y-2 animate-fade-up">
            <textarea
              value={bulkNames}
              onChange={(e) => setBulkNames(e.target.value)}
              placeholder="One name per line"
              rows={5}
              className="input"
            />
            <button onClick={addBulk} disabled={adding} className="btn btn-primary btn-sm">Add All</button>
          </div>
        )}
      </div>

      {/* Active */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-ink text-sm">Active ({active.length})</h3>
        </div>
        {active.length === 0 ? (
          <div className="p-6 text-center text-ink-muted text-sm">No contestants yet.</div>
        ) : (
          <div className="divide-y divide-border/60">
            {active.map((c) => (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <label className="relative cursor-pointer group shrink-0">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { if (e.target.files?.[0]) uploadPhoto(c, e.target.files[0]); }}
                    />
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-cream-dark flex items-center justify-center text-sm font-bold text-ink-muted">
                        {c.name[0]}
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {uploading === c.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Camera size={14} className="text-white" />
                      )}
                    </div>
                  </label>
                  <span className="font-medium text-ink">{c.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) eliminate(c, parseInt(e.target.value)); }}
                    className="text-xs border border-border rounded-lg px-2 py-1.5 text-ink-muted bg-surface"
                  >
                    <option value="">Eliminate...</option>
                    {episodes.map((ep) => (
                      <option key={ep.id} value={ep.week_number}>Week {ep.week_number}</option>
                    ))}
                  </select>
                  <button onClick={() => deleteContestant(c)} className="p-1.5 rounded-lg text-ink-faint hover:text-terracotta hover:bg-terracotta-subtle transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Eliminated */}
      {eliminated.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-ink text-sm">Eliminated ({eliminated.length})</h3>
          </div>
          <div className="divide-y divide-border/60">
            {eliminated.map((c) => (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between opacity-60">
                <div className="flex items-center gap-3">
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-cream-dark flex items-center justify-center text-sm font-bold text-ink-muted shrink-0">
                      {c.name[0]}
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-ink">{c.name}</span>
                    <span className="text-xs text-ink-muted ml-2">Week {c.eliminated_week}</span>
                  </div>
                </div>
                <button onClick={() => eliminate(c, null)} className="btn btn-secondary btn-sm">
                  <RotateCcw size={12} /> Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
