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
  pending?: boolean;
};
type Cert = {
  id: string; asset_id: string; test_type: string;
  performed_date: string | null; expires_date: string | null;
  vendor: string | null; cert_url: string | null;
};
type Queued = {
  tempId: string; asset_tag: string; asset_type: string; description: string;
  status: string; location_detail: string; photoDataUrl: string | null;
};
type CertState = "expired" | "expiring" | "current" | "none";

const CATEGORIES = ["Lifting gear", "BOP", "Iron", "Sub", "Downhole tool", "Pump", "Tongs", "Pressure equipment", "Hand tool", "Other"];
const STATUSES = [
  { v: "yard", label: "In the yard" },
  { v: "truck", label: "On a truck" },
  { v: "job", label: "On a job" },
];
const TEST_TYPES = ["pull", "pressure", "inspection", "other"];
const TEST_LABEL: Record<string, string> = { pull: "Pull test", pressure: "Pressure test", inspection: "Inspection", other: "Other" };
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
function certStateFor(list: Cert[]): CertState {
  if (!list.length) return "none";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let worst: CertState = "current";
  for (const c of list) {
    if (!c.expires_date) continue;
    const days = (new Date(c.expires_date).getTime() - today.getTime()) / 86400000;
    if (days < 0) return "expired";
    if (days <= 30) worst = "expiring";
  }
  return worst;
}
const CERT_LABEL: Record<CertState, string> = { expired: "Cert expired", expiring: "Expiring soon", current: "Certs current", none: "No certs" };

export default function GearVaultClient({ workspaceId, userId }: { workspaceId: string | null; userId: string }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "yard" | "truck" | "job" | "attention">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ tag: "", type: "", description: "", status: "yard", location: "" });
  const [photo, setPhoto] = useState<string | null>(null);
  const [detail, setDetail] = useState<Asset | null>(null);
  const [certForm, setCertForm] = useState({ test_type: "pull", performed: "", expires: "", vendor: "" });
  const [certPhoto, setCertPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const certFileRef = useRef<HTMLInputElement>(null);

  const sb = getBrowserSupabase();
  const certsByAsset = (id: string) => certs.filter((c) => c.asset_id === id);

  const flushQueue = useCallback(async () => {
    if (!sb || !workspaceId) return;
    const q = readQueue(); if (!q.length) return;
    const remaining: Queued[] = [];
    for (const item of q) {
      try {
        let photo_url: string | null = null;
        if (item.photoDataUrl) {
          const path = `${workspaceId}/${item.tempId}.jpg`;
          const up = await sb.storage.from("gearvault").upload(path, dataUrlToBlob(item.photoDataUrl), { upsert: true });
          if (!up.error) photo_url = sb.storage.from("gearvault").getPublicUrl(path).data.publicUrl;
        }
        const { error } = await sb.from("gearvault_assets").insert({
          workspace_id: workspaceId, created_by: userId,
          asset_tag: item.asset_tag || null, asset_type: item.asset_type || null,
          description: item.description || null, status: item.status, location_detail: item.location_detail || null, photo_url,
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
      const [a, c] = await Promise.all([
        sb.from("gearvault_assets").select("*").order("created_at", { ascending: false }),
        sb.from("gearvault_certs").select("*"),
      ]);
      if (!a.error && a.data) {
        setAssets(a.data as Asset[]);
        setCerts((c.data as Cert[]) || []);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(a.data)); } catch { /* */ }
        setLoading(false); return;
      }
    }
    try { setAssets(JSON.parse(localStorage.getItem(CACHE_KEY) || "[]")); } catch { /* */ }
    setLoading(false);
  }, [sb, flushQueue]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const on = () => void load();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [load]);

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>, set: (d: string | null) => void) {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMsg("Use a photo (JPG, PNG, or HEIC)."); return; }
    if (file.size > 25 * 1024 * 1024) { setMsg("That photo is over 25 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => set(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  function resetForm() { setForm({ tag: "", type: "", description: "", status: "yard", location: "" }); setPhoto(null); setShowAdd(false); }

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
        const path = `${workspaceId}/${tempId}.jpg`;
        const up = await sb.storage.from("gearvault").upload(path, dataUrlToBlob(photo), { upsert: true });
        if (!up.error) photo_url = sb.storage.from("gearvault").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await sb.from("gearvault_assets").insert({
        workspace_id: workspaceId, created_by: userId,
        asset_tag: optimistic.asset_tag, asset_type: optimistic.asset_type, description: optimistic.description,
        status: optimistic.status, location_detail: optimistic.location_detail, photo_url,
      });
      if (error) throw error;
      resetForm(); setBusy(false); void load();
    } catch {
      const q = readQueue();
      q.push({ tempId, asset_tag: optimistic.asset_tag || "", asset_type: optimistic.asset_type || "", description: optimistic.description || "", status: optimistic.status, location_detail: optimistic.location_detail || "", photoDataUrl: photo });
      writeQueue(q);
      setMsg("Saved on your phone — it'll sync when you're back in signal.");
      resetForm(); setBusy(false);
    }
  }

  async function addCert() {
    if (!sb || !workspaceId || !detail) return;
    if (!certForm.expires && !certForm.performed) { setMsg("Add at least a performed or expiration date."); return; }
    setBusy(true); setMsg("");
    try {
      let cert_url: string | null = null;
      if (certPhoto) {
        const path = `${workspaceId}/certs/${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`;
        const up = await sb.storage.from("gearvault").upload(path, dataUrlToBlob(certPhoto), { upsert: true });
        if (!up.error) cert_url = sb.storage.from("gearvault").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await sb.from("gearvault_certs").insert({
        workspace_id: workspaceId, asset_id: detail.id, created_by: userId,
        test_type: certForm.test_type, performed_date: certForm.performed || null,
        expires_date: certForm.expires || null, vendor: certForm.vendor.trim() || null, cert_url,
      });
      if (error) throw error;
      setCertForm({ test_type: "pull", performed: "", expires: "", vendor: "" }); setCertPhoto(null);
      const c = await sb.from("gearvault_certs").select("*");
      setCerts((c.data as Cert[]) || []);
    } catch { setMsg("Couldn't save that cert — try again."); }
    setBusy(false);
  }

  // counts + filtering
  const attentionIds = new Set(assets.filter((a) => ["expired", "expiring"].includes(certStateFor(certsByAsset(a.id)))).map((a) => a.id));
  const counts = {
    total: assets.length,
    yard: assets.filter((a) => a.status === "yard").length,
    truck: assets.filter((a) => a.status === "truck").length,
    job: assets.filter((a) => a.status === "job").length,
    attention: attentionIds.size,
  };
  const q = search.trim().toLowerCase();
  const shown = assets.filter((a) => {
    if (filter === "attention" ? !attentionIds.has(a.id) : filter !== "all" && a.status !== filter) return false;
    if (!q) return true;
    return [a.asset_tag, a.asset_type, a.description, a.location_detail].some((f) => (f || "").toLowerCase().includes(q));
  });
  const statusLabel = (s: string) => STATUSES.find((x) => x.v === s)?.label ?? s;

  return (
    <div className="gv">
      {assets.length > 0 ? (
        <div className="gv-stats">
          <button className={`gv-stat ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}><b>{counts.total}</b><span>Total</span></button>
          <button className={`gv-stat ${filter === "yard" ? "on" : ""}`} onClick={() => setFilter("yard")}><b>{counts.yard}</b><span>In yard</span></button>
          <button className={`gv-stat ${filter === "truck" ? "on" : ""}`} onClick={() => setFilter("truck")}><b>{counts.truck}</b><span>On trucks</span></button>
          <button className={`gv-stat ${filter === "job" ? "on" : ""}`} onClick={() => setFilter("job")}><b>{counts.job}</b><span>On jobs</span></button>
          <button className={`gv-stat attn ${filter === "attention" ? "on" : ""}`} onClick={() => setFilter("attention")}><b>{counts.attention}</b><span>Needs attention</span></button>
        </div>
      ) : null}

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
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickPhoto(e, setPhoto)} />
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
        <div className="ts-empty gv-empty">
          <div className="gv-empty-icon">▦</div>
          <b>{assets.length === 0 ? "No gear logged yet" : "Nothing matches"}</b>
          <p>{assets.length === 0 ? "Add your first asset — an ID/serial, type, where it is, and a photo. Then you always know what you've got and where." : "Try a different search or filter."}</p>
          <button className="btn btn-primary" onClick={() => { setFilter("all"); setSearch(""); setShowAdd(true); }}>+ Add an asset</button>
        </div>
      ) : (
        <div className="gv-grid">
          {shown.map((a) => {
            const cs = certStateFor(certsByAsset(a.id));
            return (
              <button key={a.id} className="gv-card" onClick={() => setDetail(a)}>
                {a.photo_url ? <img src={a.photo_url} alt={a.asset_tag || "asset"} className="gv-thumb" /> : <div className="gv-thumb gv-thumb-empty">No photo</div>}
                <div className="gv-card-body">
                  <div className="gv-card-top">
                    <span className="gv-tag mono">{a.asset_tag || "—"}</span>
                    <span className={`gv-status gv-${a.status}`}>{statusLabel(a.status)}</span>
                  </div>
                  {a.asset_type ? <div className="gv-type">{a.asset_type}</div> : null}
                  {a.description ? <div className="gv-desc">{a.description}</div> : null}
                  {a.location_detail ? <div className="gv-loc">{a.location_detail}</div> : null}
                  <div className={`gv-cert gv-cert-${cs}`}><span className="gv-dot" />{CERT_LABEL[cs]}</div>
                  {a.pending ? <div className="gv-pending">⟳ syncing…</div> : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {detail ? (
        <div className="gv-modal" onClick={() => setDetail(null)}>
          <div className="gv-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="gv-modal-x" onClick={() => setDetail(null)} aria-label="Close">✕</button>
            <div className="gv-modal-head">
              {detail.photo_url ? <img src={detail.photo_url} alt="" className="gv-thumb-lg" /> : null}
              <div>
                <div className="gv-tag mono" style={{ fontSize: 18 }}>{detail.asset_tag || "Asset"}</div>
                <div className="gv-type">{[detail.asset_type, statusLabel(detail.status), detail.location_detail].filter(Boolean).join(" · ")}</div>
                {detail.description ? <div className="gv-desc" style={{ marginTop: 4 }}>{detail.description}</div> : null}
              </div>
            </div>

            <div className="gv-modal-section">
              <div className="gv-section-h">Certs &amp; tests</div>
              {certsByAsset(detail.id).length === 0 ? (
                <p className="gv-muted">No certs logged. Add a pull test, pressure test, or inspection below.</p>
              ) : (
                <div className="gv-cert-list">
                  {certsByAsset(detail.id).sort((x, y) => (y.expires_date || "").localeCompare(x.expires_date || "")).map((c) => {
                    const cs = certStateFor([c]);
                    return (
                      <div key={c.id} className="gv-cert-row">
                        <span className="gv-cert-type">{TEST_LABEL[c.test_type] || c.test_type}</span>
                        <span className="gv-cert-dates">{c.performed_date ? `done ${c.performed_date}` : ""}{c.expires_date ? ` · exp ${c.expires_date}` : ""}{c.vendor ? ` · ${c.vendor}` : ""}</span>
                        <span className={`gv-cert gv-cert-${cs}`}><span className="gv-dot" />{CERT_LABEL[cs]}</span>
                        {c.cert_url ? <a href={c.cert_url} target="_blank" rel="noreferrer" className="gv-cert-link">cert ↗</a> : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="gv-modal-section">
              <div className="gv-section-h">Log a cert / test</div>
              <div className="gv-cert-form">
                <select value={certForm.test_type} onChange={(e) => setCertForm({ ...certForm, test_type: e.target.value })}>
                  {TEST_TYPES.map((t) => <option key={t} value={t}>{TEST_LABEL[t]}</option>)}
                </select>
                <label className="gv-date">Performed<input type="date" value={certForm.performed} onChange={(e) => setCertForm({ ...certForm, performed: e.target.value })} /></label>
                <label className="gv-date">Expires<input type="date" value={certForm.expires} onChange={(e) => setCertForm({ ...certForm, expires: e.target.value })} /></label>
                <input placeholder="Vendor (optional)" value={certForm.vendor} onChange={(e) => setCertForm({ ...certForm, vendor: e.target.value })} />
                <button className="btn btn-ghost" onClick={() => certFileRef.current?.click()}>{certPhoto ? "Cert ✓" : "Attach cert"}</button>
                <input ref={certFileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickPhoto(e, setCertPhoto)} />
                <button className="btn btn-primary" onClick={addCert} disabled={busy}>{busy ? "Saving…" : "Add cert"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
