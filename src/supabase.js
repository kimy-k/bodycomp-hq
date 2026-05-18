/* ═══ SUPABASE LAYER ═══
   REST endpoint + anon key + makeDb factory. The factory returns an object
   with per-user-scoped methods (get/list/upsert/del) and household-shared
   methods (listShared/listSharedSince/delByIdShared) that iterate users from
   PROFILES and merge results client-side.

   Failures in shared methods log to console but never toast — empty-state
   UI is the right degraded experience. */

import {PROFILES} from "./data.js";

export const SB = "https://xstinpgwhpjwoohpkjgn.supabase.co/rest/v1";
export const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdGlucGd3aHBqd29vaHBramduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MTI4MzksImV4cCI6MjA5NDQ4ODgzOX0.XVrnWxg4MXOB9iBxkq9rP9T8XBsBjS8Ff85jC4MhLPc";
export const hdr = {apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json"};

export const makeDb = (uid, onErr = () => {}) => ({
  async get(table, dateVal) {
    try {
      const r = await fetch(`${SB}/${table}?user_id=eq.${uid}&date=eq.${dateVal}&select=*`, {headers: hdr});
      if (!r.ok) throw new Error(`${table}: ${r.status}`);
      const d = await r.json();
      return d[0] || null;
    } catch (e) {
      onErr(`Couldn't load ${table}`);
      return null;
    }
  },
  async upsert(table, row) {
    try {
      const r = await fetch(`${SB}/${table}`, {
        method: "POST",
        headers: {...hdr, Prefer: "resolution=merge-duplicates"},
        body: JSON.stringify({...row, user_id: uid}),
      });
      if (!r.ok) throw new Error(`${table}: ${r.status}`);
      return true;
    } catch (e) {
      console.error("db upsert:", e);
      onErr(`Couldn't save ${table}`);
      return false;
    }
  },
  async list(table, limit = 14) {
    try {
      const r = await fetch(`${SB}/${table}?user_id=eq.${uid}&select=*&order=date.desc&limit=${limit}`, {headers: hdr});
      if (!r.ok) throw new Error(`${table}: ${r.status}`);
      return await r.json();
    } catch (e) {
      onErr(`Couldn't load ${table}`);
      return [];
    }
  },
  async del(table, dateVal) {
    try {
      const r = await fetch(`${SB}/${table}?user_id=eq.${uid}&date=eq.${dateVal}`, {method: "DELETE", headers: hdr});
      if (!r.ok) throw new Error(`${table}: ${r.status}`);
      return true;
    } catch (e) {
      onErr(`Couldn't delete ${table}`);
      return false;
    }
  },
  async delById(table, id) {
    try {
      const r = await fetch(`${SB}/${table}?user_id=eq.${uid}&id=eq.${id}`, {method: "DELETE", headers: hdr});
      if (!r.ok) throw new Error(`${table}: ${r.status}`);
      return true;
    } catch (e) {
      onErr(`Couldn't delete`);
      return false;
    }
  },
  async storageUpload(bucket, path, blob, contentType = "image/jpeg") {
    try {
      const r = await fetch(`${SB.replace("/rest/v1", "")}/storage/v1/object/${bucket}/${path}`, {
        method: "POST",
        headers: {apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": contentType, "x-upsert": "true"},
        body: blob,
      });
      if (!r.ok) throw new Error(`upload: ${r.status}`);
      return `${SB.replace("/rest/v1", "")}/storage/v1/object/public/${bucket}/${path}`;
    } catch (e) {
      onErr(`Upload failed`);
      return null;
    }
  },
  async storageDelete(bucket, path) {
    try {
      const r = await fetch(`${SB.replace("/rest/v1", "")}/storage/v1/object/${bucket}/${path}`, {
        method: "DELETE",
        headers: {apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`},
      });
      return r.ok;
    } catch {
      return false;
    }
  },
  /* ─── Household-shared methods — fetch per-user with filtered queries and merge. */
  async listShared(table, limit = 100, orderCol = "date_recon") {
    const users = Object.keys(PROFILES);
    const debug = [];
    const results = await Promise.all(users.map(async u => {
      try {
        const r = await fetch(`${SB}/${table}?user_id=eq.${u}&select=*&order=${orderCol}.desc&limit=${limit}`, {headers: hdr});
        if (!r.ok) {
          const body = await r.text().catch(() => "");
          debug.push(`${u}: HTTP ${r.status} ${body.slice(0, 200)}`);
          return null;
        }
        return await r.json();
      } catch (e) {
        debug.push(`${u}: ${e.message}`);
        return null;
      }
    }));
    if (results.every(r => r === null)) {
      console.warn(`[BCQ] listShared ${table} — all queries failed:`, debug);
      return [];
    }
    const merged = results.filter(r => Array.isArray(r)).flat();
    const seen = new Set();
    return merged
      .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
      .sort((a, b) => String(b[orderCol] || "").localeCompare(String(a[orderCol] || "")))
      .slice(0, limit);
  },
  async delByIdShared(table, id, ownerId) {
    if (!ownerId) {
      console.warn(`[BCQ] delByIdShared ${table} — missing ownerId`);
      return false;
    }
    try {
      const r = await fetch(`${SB}/${table}?user_id=eq.${ownerId}&id=eq.${id}`, {method: "DELETE", headers: hdr});
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        console.warn(`[BCQ] delByIdShared ${table}: HTTP ${r.status}`, body);
        throw new Error(`${table}: ${r.status}`);
      }
      return true;
    } catch (e) {
      onErr(`Couldn't delete`);
      return false;
    }
  },
  async listSharedSince(table, sinceDate, orderCol = "date") {
    const users = Object.keys(PROFILES);
    const debug = [];
    const results = await Promise.all(users.map(async u => {
      try {
        const r = await fetch(`${SB}/${table}?user_id=eq.${u}&${orderCol}=gte.${sinceDate}&select=*&order=${orderCol}.desc&limit=500`, {headers: hdr});
        if (!r.ok) {
          debug.push(`${u}: HTTP ${r.status}`);
          return null;
        }
        return await r.json();
      } catch (e) {
        debug.push(`${u}: ${e.message}`);
        return null;
      }
    }));
    if (results.every(r => r === null)) console.warn(`[BCQ] listSharedSince ${table}:`, debug);
    return results.filter(r => Array.isArray(r)).flat();
  },
  async getConfig(key) {
    try {
      const r = await fetch(`${SB}/config?user_id=eq.${uid}&key=eq.${key}&select=*`, {headers: hdr});
      if (!r.ok) throw new Error(`config: ${r.status}`);
      const d = await r.json();
      return d[0]?.value || null;
    } catch (e) {
      return null;
    }
  },
  async setConfig(key, value) {
    try {
      const r = await fetch(`${SB}/config`, {
        method: "POST",
        headers: {...hdr, Prefer: "resolution=merge-duplicates"},
        body: JSON.stringify({user_id: uid, key, value, updated_at: new Date().toISOString()}),
      });
      if (!r.ok) throw new Error(`config: ${r.status}`);
      return true;
    } catch (e) {
      onErr(`Couldn't save settings`);
      return false;
    }
  },
  /* ─── Peptide stack methods (P10) — per-user editable stack stored in DB. */
  async getStack() {
    try {
      const r = await fetch(`${SB}/peptide_stack?user_id=eq.${uid}&select=*&order=peptide_id.asc`, {headers: hdr});
      if (!r.ok) throw new Error(`peptide_stack: ${r.status}`);
      return await r.json();
    } catch (e) {
      onErr(`Couldn't load stack`);
      return [];
    }
  },
  async bulkInsertStack(rows) {
    /* rows: array of {peptide_id, enabled, dose, schedule, time, status, start_date, total_weeks, cycle_end, note}.
       Each gets user_id stamped. Used once per user for first-boot backfill. */
    if (!Array.isArray(rows) || rows.length === 0) return true;
    const enriched = rows.map(r => ({...r, user_id: uid}));
    try {
      const r = await fetch(`${SB}/peptide_stack`, {
        method: "POST",
        headers: {...hdr, Prefer: "resolution=merge-duplicates"},
        body: JSON.stringify(enriched),
      });
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        console.warn(`[BCQ] bulkInsertStack: HTTP ${r.status}`, body);
        throw new Error(`peptide_stack: ${r.status}`);
      }
      return true;
    } catch (e) {
      onErr(`Couldn't seed stack`);
      return false;
    }
  },
  async upsertStackEntry(peptideId, patch) {
    /* Upsert one row keyed by (user_id, peptide_id). patch can include any of
       {enabled, dose, schedule, time, status, start_date, total_weeks, cycle_end, note}.
       Returns the updated row or null on failure. */
    if (!peptideId) return null;
    try {
      const r = await fetch(`${SB}/peptide_stack?on_conflict=user_id,peptide_id`, {
        method: "POST",
        headers: {...hdr, Prefer: "resolution=merge-duplicates,return=representation"},
        body: JSON.stringify({user_id: uid, peptide_id: peptideId, ...patch}),
      });
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        console.warn(`[BCQ] upsertStackEntry: HTTP ${r.status}`, body);
        throw new Error(`peptide_stack: ${r.status}`);
      }
      const data = await r.json();
      return Array.isArray(data) ? data[0] : data;
    } catch (e) {
      onErr(`Couldn't save stack entry`);
      return null;
    }
  },
  /* ─── Wellness methods (P17) — subjective daily log keyed by (user_id, date). */
  async getWellness(date) {
    try {
      const r = await fetch(`${SB}/daily_wellness?user_id=eq.${uid}&date=eq.${date}&select=*`, {headers: hdr});
      if (!r.ok) throw new Error(`daily_wellness: ${r.status}`);
      const data = await r.json();
      return Array.isArray(data) && data.length ? data[0] : null;
    } catch (e) {
      onErr(`Couldn't load wellness`);
      return null;
    }
  },
  async listWellness(days = 14) {
    /* Most-recent first, used for sparklines + insights correlation later. */
    try {
      const r = await fetch(`${SB}/daily_wellness?user_id=eq.${uid}&select=*&order=date.desc&limit=${days}`, {headers: hdr});
      if (!r.ok) throw new Error(`daily_wellness: ${r.status}`);
      return await r.json();
    } catch (e) {
      onErr(`Couldn't load wellness history`);
      return [];
    }
  },
  async upsertWellness(date, patch) {
    /* Patch may include any of {mood, energy, sleep_quality, notes}. Other fields preserved. */
    if (!date) return null;
    try {
      const r = await fetch(`${SB}/daily_wellness?on_conflict=user_id,date`, {
        method: "POST",
        headers: {...hdr, Prefer: "resolution=merge-duplicates,return=representation"},
        body: JSON.stringify({user_id: uid, date, ...patch}),
      });
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        console.warn(`[BCQ] upsertWellness: HTTP ${r.status}`, body);
        throw new Error(`daily_wellness: ${r.status}`);
      }
      const data = await r.json();
      return Array.isArray(data) ? data[0] : data;
    } catch (e) {
      onErr(`Couldn't save wellness`);
      return null;
    }
  },
  /* ─── Whoop OAuth methods (P14) — token row tracks connection state. */
  async getWhoopConnection() {
    /* Returns the whoop_tokens row for this user or null. Does NOT expose tokens to
       client code — only fields needed for UI state (connected? last_sync_at, error). */
    try {
      const r = await fetch(`${SB}/whoop_tokens?user_id=eq.${uid}&select=whoop_email,whoop_user_id,connected_at,last_sync_at,last_sync_count,last_sync_error,scope,expires_at`, {headers: hdr});
      if (!r.ok) throw new Error(`whoop_tokens: ${r.status}`);
      const rows = await r.json();
      return rows[0] || null;
    } catch (e) {
      onErr(`Couldn't check Whoop status`);
      return null;
    }
  },
  async disconnectWhoop() {
    /* Delete the token row. User can also revoke via the Whoop app. */
    try {
      const r = await fetch(`${SB}/whoop_tokens?user_id=eq.${uid}`, {method: "DELETE", headers: hdr});
      return r.ok;
    } catch (e) {
      onErr(`Couldn't disconnect Whoop`);
      return false;
    }
  },
  async syncWhoop() {
    /* Calls our server endpoint which handles token refresh + fetch + upsert. */
    try {
      const r = await fetch(`/api/whoop/sync`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({user_id: uid}),
      });
      const data = await r.json().catch(() => ({}));
      return {ok: r.ok && data.ok, synced: data.synced || 0, error: data.error || null};
    } catch (e) {
      return {ok: false, synced: 0, error: String(e.message || e)};
    }
  },
  /* ─── AI summary methods — Gemini-powered weekly report. */
  async generateAISummary() {
    try {
      const r = await fetch(`/api/ai/weekly-summary`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({user_id: uid}),
      });
      const data = await r.json().catch(() => ({}));
      return {ok: r.ok && data.ok, summary_md: data.summary_md || "", generated_at: data.generated_at, error: data.error || null};
    } catch (e) {
      return {ok: false, summary_md: "", error: String(e.message || e)};
    }
  },
  async getLatestAISummary() {
    /* Most recent cached weekly summary for this user. Returns null if none. */
    try {
      const r = await fetch(`${SB}/ai_summaries?user_id=eq.${uid}&kind=eq.weekly&error=is.null&select=*&order=generated_at.desc&limit=1`, {headers: hdr});
      if (!r.ok) throw new Error(`ai_summaries: ${r.status}`);
      const rows = await r.json();
      return rows[0] || null;
    } catch (e) {
      return null;
    }
  },

  /* ─── Daily briefing — Phase 2 smart layer.
     Fetches today's brief from the API. The endpoint handles same-day caching
     server-side; calling this multiple times in a day costs almost nothing. */
  async getDailyBriefing(force = false) {
    try {
      const r = await fetch(`/api/ai/daily-briefing`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({user_id: uid, force}),
      });
      const data = await r.json().catch(() => ({}));
      return {
        ok: r.ok && data.ok,
        summary_md: data.summary_md || "",
        generated_at: data.generated_at,
        cached: !!data.cached,
        error: data.error || null,
      };
    } catch (e) {
      return {ok: false, summary_md: "", error: String(e.message || e)};
    }
  },

  /* ─── AI food parser — natural language → {protein, fat, carbs}.
     Used in the Add Meal modal "Smart fill" input. ~5s end-to-end. */
  async parseFoodWithAI(description) {
    try {
      const r = await fetch(`/api/ai/food-parse`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({description}),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        return {ok: false, error: data.error || `Parser returned ${r.status}`};
      }
      return {
        ok: true,
        name: data.name,
        protein_g: data.protein_g,
        fat_g: data.fat_g,
        carbs_g: data.carbs_g,
        confidence: data.confidence,
        notes: data.notes,
      };
    } catch (e) {
      return {ok: false, error: String(e.message || e)};
    }
  },
});
