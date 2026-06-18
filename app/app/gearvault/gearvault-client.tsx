"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Asset = {
  id: string;
  asset_tag: string | null;
  asset_type: string | null;
  description: string | null;
  photo_url: string | null;
  status: string;
  location_detail: string | null;
  created_at: string;
  pending?: boolean; // not yet synced to the server (added offline)
};

type Queued = {
  tempId: string;
  asset_tag: string; asset_type: string; description: string;
  status: string; location_detail: string; photoDataUrl: string | null;
};

const CATEGORIES = ["Lifting gear", "BOP", "Iron", "Sub", "Downhole tool", "Pump", "Tongs", "Pressure equipment", "Hand tool", "Other"];
const STATUSES = [
  { v: "yard", label: "In the yard" },
  { v: "truck", label: "On a truck" },
  { v: "job", label: "On a job" },
];
const CACHE_KEY = "gearvault:cache";
const QUEUE_KEY = "gearvault:queue";

function readQueue(): Queued[] { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; } }
function writeQueue(q: Queued[]) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* */ } }
function dataUrlToBlob(d: string): Blob {
  const [head, b64] = d.split(",");
  const mime = head.match(/:(.*?);/)?.[1] || "image/jpeg";
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function GearVaultClient({ workspaceId, userId }: { workspaceId: string | null; userId: string }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ tag: "", type: "", description: "", status: "yard", location: "" });
  const [photo, setPhoto] = useState<string | null>(null); // dataURL preview
  const fileRef = useRef<HTMLInputElement>(null);

  const sb = getBrowserSupabase();

  const flushQueue = useCallback(async () => {
    if (!sb || !workspaceId) return;
    const q = readQueue();
    if (!q.length) return;
    const remaining: Queued[] = [];
    for (const item of q) {
      try {
        let photo_url: string | null = null;
        if (item.photoDataUrl) {
          const blob = dataUrlToBlob(item.photoDataUrl);
          const path = `${workspaceId}/${item.tempId}.jpg`;
          const up = await sb.storage.from("gearvault").upload(path, blob, { upsert: true });
          if (!up.error) photo_url = sb.storage.from("gearvault").getPublicUrl(path).data.publicUrl;
        }
        const { error } = await sb.from("gearvault_assets").insert({
          workspace_id: workspaceId, created_by: userId,
          asset_tag: item.asset_tag || null, asset_type: item.asset_type || null,
          description: item.description || null, status: item.status,
          location_detail: item.location_detail || null, photo_url,
        });
        if (error) remaining.push(item);
      } catch { remaining.push(item); }
    }
    writeQueue(remaining);
  }, [sb, workspaceId, userId]);

  const load = useCallback(async () => {
    setLoading(true);
    await flushQueue();
    if (sb) {
      const { data, error } = await sb.from("gearvault_assets").select("*").order("created_at", { ascending: false });
      if (!error && data) {
        setAssets(data as Asset[]);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* */ }
        setLoading(false);
        return;
      }
    }
    // offline / not configured → cache
    try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]"); setAssets(c); } catch { /* */ }
    setLoading(false);
  }, [sb, flushQueue]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const onOnline = () => { void load(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [load]);

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMsg("Use a photo (JPG, PNG, or HEIC)."); return; }
    if (file.size > 25 * 1024 * 1024) { setMsg("That photo is over 25 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  function resetForm() {
    setForm({ tag: "", type: "", description: "", status: "yard", location: "" });
    setPhoto(null); setShowAdd(false);
  }

  async function addAsset() {
    if (!workspaceId) { setMsg("No workspace — finish setting up your account first."); return; }
    if (!form.tag.trim() && !form.description.trim()) { setMsg("Give it at least an ID/serial or a description."); return; }
    setBusy(true); setMsg("");
    const tempId = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const optimistic: Asset = {
      id: tempId, asset_tag: form.tag.trim() || null, asset_type: form.type.trim() || null,
      description: form.description.trim() || null, photo_url: photo, status: form.status,
      location_detail: form.location.trim() || null, created_at: new Date().toISOString(), pending: true,
    };
    setAssets((a) => [optimistic, ...a]);

    try {
      if (!sb || !navigator.onLine) throw new Error("offline");
      let photo_url: string | null = null;
      if (photo) {
        const blob = dataUrlToBlob(photo);
        const path = `${workspaceId}/${tempId}.jpg`;
        const up = await sb.storage.from("gearvault").upload(path, blob, { upsert: true });
        if (!up.error) photo_url = sb.storage.from("gearvault").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await sb.from("gearvault_assets").insert({
        workspace_id: workspaceId, created_by: userId,
        asset_tag: optimistic.asset_tag, asset_type: optimistic.asset_type, description: optimistic.description,
        status: optimistic.status, location_detail: optimistic.location_detail, photo_url,
      });
      if (error) throw error;
      resetForm(); setBusy(false);
      void load();
    } catch {
      // offline / failed → queue it; the optimistic row stays (pending)
      const q = readQueue();
      q.push({ tempId, asset_tag: optimistic.asset_tag || "", asset_type: optimistic.asset_type || "", description: optimistic.description || "", status: optimistic.status, location_detail: optimistic.location_detail || "", photoDataUrl: photo });
      writeQueue(q);
      setMsg("Saved on your phone — it'll sync when you're back in signal.");
      resetForm(); setBusy(false);
    }
  }

  const q = search.trim().toLowerCase();
  const shown = q
    ? assets.filter((a) => [a.asset_tag, a.asset_type, a.description, a.location_detail].some((f) => (f || "").toLowerCase().includes(q)))
    : assets;
  const statusLabel = (s: string) => STATUSES.find((x) => x.v === s)?.label ?? s;

  return (
    <div className="gv">
      <div className="gv-bar">
        <input className="gv-search" placeholder="Search gear — ID, type, truck, job…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search assets" />
        <button className="btn btn-primary" onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Close" : "+ Add asset"}</button>
      </div>
      {msg ? <p className="ts-msg">{msg}</p> : null}

      {showAdd ? (
        <div className="gv-add">
          <div className="gv-add-grid">
            <label>ID / Serial<input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="e.g. SLB-4471" /></label>
            <label>Type
              <input list="gv-cats" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Lifting gear, BOP, sub…" />
              <datalist id="gv-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="gv-wide">Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is it?" /></label>
            <label>Where is it?
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            </label>
            {form.status !== "yard" ? (
              <label>{form.status === "truck" ? "Which truck?" : "Which job?"}<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={form.status === "truck" ? "TRK-04" : "Pad 14 #3H"} /></label>
            ) : null}
          </div>
          <div className="gv-add-photo">
            {photo ? <img src={photo} alt="asset" className="gv-thumb-lg" /> : <div className="gv-thumb-lg gv-thumb-empty">No photo</div>}
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>{photo ? "Retake photo" : "Add photo"}</button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPickPhoto} />
          </div>
          <div className="gv-add-actions">
            <button className="btn btn-primary" onClick={addAsset} disabled={busy}>{busy ? "Saving…" : "Save asset"}</button>
            <button className="btn btn-ghost" onClick={resetForm} disabled={busy}>Cancel</button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="ts-msg">Loading your gear…</p>
      ) : shown.length === 0 ? (
        <div className="ts-empty">
          <b>{assets.length === 0 ? "No gear logged yet" : "Nothing matches that search"}</b>
          <p>{assets.length === 0 ? "Add your first asset — an ID/serial, type, where it is, and a photo. Then you'll always know what you've got and where." : "Try a different ID, type, truck, or job."}</p>
          {assets.length === 0 ? <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add your first asset</button> : null}
        </div>
      ) : (
        <>
          <div className="gv-count">{shown.length} asset{shown.length === 1 ? "" : "s"}{q ? ` matching “${search.trim()}”` : ""}</div>
          <div className="gv-grid">
            {shown.map((a) => (
              <div key={a.id} className="gv-card">
                {a.photo_url ? <img src={a.photo_url} alt={a.asset_tag || "asset"} className="gv-thumb" /> : <div className="gv-thumb gv-thumb-empty">No photo</div>}
                <div className="gv-card-body">
                  <div className="gv-card-top">
                    <span className="gv-tag mono">{a.asset_tag || "—"}</span>
                    <span className={`gv-status gv-${a.status}`}>{statusLabel(a.status)}</span>
                  </div>
                  {a.asset_type ? <div className="gv-type">{a.asset_type}</div> : null}
                  {a.description ? <div className="gv-desc">{a.description}</div> : null}
                  {a.location_detail ? <div className="gv-loc">{a.location_detail}</div> : null}
                  {a.pending ? <div className="gv-pending">⟳ syncing…</div> : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
