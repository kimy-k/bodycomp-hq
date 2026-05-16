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
});
