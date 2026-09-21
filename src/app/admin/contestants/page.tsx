'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Contestant, Episode } from '@/lib/types';
import { useAdmin } from '@/hooks/usePlayer';
import { ArrowLeft, Plus, Trash2, RotateCcw, ChevronDown, Camera, AlertCircle, X } from 'lucide-react';
import ImageCropModal from '@/components/ImageCropModal';

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
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropContestant, setCropContestant] = useState<Contestant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRemoveAllConfirm, setShowRemoveAllConfirm] = useState(false);
  const [removeAllInput, setRemoveAllInput] = useState('');
  const [removingAll, setRemovingAll] = useState(false);

  async function loadData() {
    const [contestantsRes, episodesRes] = await Promise.all([
      supabase.from('contestants').select('*').order('name'),
      supabase.from('episodes').select('*').order('week_number'),
    ]);
    if (contestantsRes.error || episodesRes.error) {
      setError(
        `Couldn't load contestants: ${contestantsRes.error?.message || episodesRes.error?.message}`
      );
    }
    if (contestantsRes.data) setContestants(contestantsRes.data);
    if (episodesRes.data) setEpisodes(episodesRes.data);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load-on-mount fetch
    loadData();
  }, []);

  async function addContestant() {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    const { error: insertError } = await supabase.from('contestants').insert({ name: newName.trim() });
    if (insertError) {
      setError(`Couldn't add contestant: ${insertError.message}`);
      setAdding(false);
      return;
    }
    setNewName('');
    setAdding(false);
    await loadData();
  }

  async function addBulk() {
    const names = bulkNames.split('\n').map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    setAdding(true);
    setError(null);
    const { error: insertError } = await supabase.from('contestants').insert(names.map((name) => ({ name })));
    if (insertError) {
      setError(`Couldn't add contestants: ${insertError.message}`);
      setAdding(false);
      return;
    }
    setBulkNames('');
    setShowBulk(false);
    setAdding(false);
    await loadData();
  }

  async function eliminate(contestant: Contestant, week: number | null) {
    setError(null);
    const { error: updateError } = await supabase
      .from('contestants')
      .update({ eliminated_week: week })
      .eq('id', contestant.id);
    if (updateError) {
      setError(`Couldn't update ${contestant.name}: ${updateError.message}`);
      return;
    }
    await loadData();
  }

  async function deleteContestant(contestant: Contestant) {
    if (!confirm(`Delete ${contestant.name}?`)) return;
    setError(null);
    const { error: deleteError } = await supabase.from('contestants').delete().eq('id', contestant.id);
    if (deleteError) {
      setError(`Couldn't delete ${contestant.name}: ${deleteError.message}`);
      return;
    }
    await loadData();
  }

  async function removeAllContestants() {
    setRemovingAll(true);
    setError(null);
    const { error: deleteError } = await supabase.from('contestants').delete().not('id', 'is', null);
    if (deleteError) {
      setError(`Couldn't remove all contestants: ${deleteError.message}`);
      setRemovingAll(false);
      return;
    }
    setRemovingAll(false);
    setShowRemoveAllConfirm(false);
    setRemoveAllInput('');
    await loadData();
  }

  function handleFileSelect(contestant: Contestant, file: File) {
    setCropContestant(contestant);
    setCropFile(file);
  }

  async function uploadPhoto(contestant: Contestant, blob: Blob) {
    setUploading(contestant.id);
    setError(null);
    const path = `${contestant.id}.jpg`;

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
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      setUploading(null);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('contestant-photos')
      .getPublicUrl(path);

    // Append timestamp to bust cache
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    const { error: updateError } = await supabase
      .from('contestants')
      .update({ image_url: publicUrl })
      .eq('id', contestant.id);
    if (updateError) {
      setError(`Couldn't save photo for ${contestant.name}: ${updateError.message}`);
    }
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

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-red-700 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} aria-label="Dismiss error" className="text-red-700 hover:text-red-900 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Add contestant */}
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold text-ink text-sm">Add Contestant</h3>
        <div className="flex gap-2">
          <label htmlFor="new-contestant-name" className="sr-only">Contestant name</label>
          <input
            id="new-contestant-name"
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
            <label htmlFor="bulk-contestant-names" className="sr-only">Contestant names, one per line</label>
            <textarea
              id="bulk-contestant-names"
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
                      aria-label={`Upload photo for ${c.name}`}
                      onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(c, e.target.files[0]); }}
                    />
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage URL; next/image needs remotePatterns in next.config.ts, which is out of scope here
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
                        <Camera size={14} className="text-white" aria-hidden />
                      )}
                    </div>
                  </label>
                  <span className="font-medium text-ink">{c.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor={`eliminate-${c.id}`} className="sr-only">Eliminate {c.name} in week</label>
                  <select
                    id={`eliminate-${c.id}`}
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) eliminate(c, parseInt(e.target.value)); }}
                    className="text-xs border border-border rounded-lg px-2 py-1.5 text-ink-muted bg-surface"
                  >
                    <option value="">Eliminate...</option>
                    {episodes.map((ep) => (
                      <option key={ep.id} value={ep.week_number}>Week {ep.week_number}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => deleteContestant(c)}
                    aria-label={`Delete ${c.name}`}
                    className="p-1.5 rounded-lg text-ink-faint hover:text-terracotta hover:bg-terracotta-subtle transition-colors"
                  >
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
                    // eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage URL; next/image needs remotePatterns in next.config.ts, which is out of scope here
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
                <div className="flex items-center gap-2">
                  <button onClick={() => eliminate(c, null)} aria-label={`Restore ${c.name}`} className="btn btn-secondary btn-sm">
                    <RotateCcw size={12} /> Restore
                  </button>
                  <button
                    onClick={() => deleteContestant(c)}
                    aria-label={`Delete ${c.name}`}
                    className="p-1.5 rounded-lg text-ink-faint hover:text-terracotta hover:bg-terracotta-subtle transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start a new season */}
      <div className="card p-4 space-y-3 border border-terracotta/20">
        <div>
          <h3 className="font-semibold text-ink text-sm">Start a New Season</h3>
          <p className="text-xs text-ink-muted mt-0.5">
            Removes all {contestants.length} contestant{contestants.length === 1 ? '' : 's'}. This can&apos;t be undone.
          </p>
        </div>
        {!showRemoveAllConfirm ? (
          <button
            onClick={() => setShowRemoveAllConfirm(true)}
            disabled={contestants.length === 0}
            className="btn btn-danger btn-sm"
          >
            <Trash2 size={14} /> Remove All Contestants
          </button>
        ) : (
          <div className="space-y-2 animate-fade-up">
            <label htmlFor="remove-all-confirm-input" className="text-xs text-ink-secondary block">
              Type <strong>REMOVE</strong> to confirm removing all contestants.
            </label>
            <div className="flex gap-2">
              <input
                id="remove-all-confirm-input"
                type="text"
                value={removeAllInput}
                onChange={(e) => setRemoveAllInput(e.target.value)}
                placeholder="Type REMOVE"
                className="input flex-1"
                autoFocus
              />
              <button
                onClick={removeAllContestants}
                disabled={removeAllInput !== 'REMOVE' || removingAll}
                className="btn btn-danger btn-sm shrink-0"
              >
                {removingAll ? 'Removing...' : 'Confirm'}
              </button>
              <button
                onClick={() => { setShowRemoveAllConfirm(false); setRemoveAllInput(''); }}
                className="btn btn-secondary btn-sm shrink-0"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {cropFile && cropContestant && (
        <ImageCropModal
          file={cropFile}
          onCrop={(blob) => {
            setCropFile(null);
            const contestant = cropContestant;
            setCropContestant(null);
            uploadPhoto(contestant, blob);
          }}
          onCancel={() => { setCropFile(null); setCropContestant(null); }}
        />
      )}
    </div>
  );
}
