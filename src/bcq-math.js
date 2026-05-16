/* ═══ BCQ MATH — pure functions for inventory, stability, scheduling ═══
   Every function here is:
   - Pure (no side effects, no DOM, no fetch, no state references)
   - Deterministic (time-dependent functions accept an injectable `now` param)
   - Exported with named exports so individual functions can be tested in isolation

   Imported by Dashboard.jsx for runtime and bcq-math.test.js for tests.
   ──────────────────────────────────────────────────────────────────────── */

/* Enrich a body-comp scan with derived fat mass + lean mass + labels.
   Input:  {date, weight, fatPct, muscle?}
   Output: {...input, fatMass, leanMass, label, labelYr} */
export const enrich = d => {
  const fm = +(d.weight * d.fatPct / 100).toFixed(1);
  return {
    ...d,
    fatMass: fm,
    leanMass: +(d.weight - fm).toFixed(1),
    label: new Date(d.date).toLocaleDateString("en-US", {month: "short", day: "numeric"}),
    labelYr: new Date(d.date).toLocaleDateString("en-US", {month: "short", year: "2-digit"}),
  };
};

/* Days elapsed since a batch was reconstituted. Used for stability warnings.
   Accepts optional `now` for testability. */
export const daysSinceRecon = (batch, now = new Date()) => {
  if (!batch?.date_recon) return 0;
  return Math.round((now - new Date(batch.date_recon + "T12:00:00")) / 86400000);
};

/* Whether a batch is being used beyond its peptide's PG-documented stability
   window. Distinct from user-set expiry_date — this is the evidence-based limit.
   The caller passes the recon entry so this module stays free of config deps. */
export const isPastPGStability = (batch, recon, now = new Date()) => {
  if (!recon?.stabilityDays) return false;
  return daysSinceRecon(batch, now) > recon.stabilityDays;
};

/* Parse a peptide time string into {h, m} or null.
   "AM"  → {h:8, m:0}      "PM"  → {h:20, m:0}
   "8:00am" / "9pm" / "13:30" → parsed normally.
   AM defaults to 8:00, PM defaults to 20:00.
   12am → 0:00, 12pm stays 12:00. */
export const parseTimeStr = s => {
  if (!s) return null;
  const t = String(s).trim().toLowerCase();
  if (t === "am") return {h: 8, m: 0};
  if (t === "pm") return {h: 20, m: 0};
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = +m[1];
  const min = +(m[2] || 0);
  const ampm = m[3];
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return {h, m: min};
};

/* Due state of a peptide for the current moment.
   Returns null if no time info or already checked. Otherwise:
   {label, color, overdue: bool, urgent?: bool, minutes: n}
   Time buckets:
     -∞ to -60 min  → "due Xpm" (gray, not yet)
     -60 to 15 min  → "due now" (accent, urgent)
     15 to 120 min  → "Nmin overdue" (warn)
     >120 min       → "Nh overdue" (danger) */
export const dueState = (p, checked, now = new Date()) => {
  if (checked) return null;
  const t = parseTimeStr(p?.time);
  if (!t) return null;
  const sched = new Date(now);
  sched.setHours(t.h, t.m, 0, 0);
  const diff = (now - sched) / 60000;
  const fmt = d => {
    const h = d.getHours();
    const m = d.getMinutes();
    const ap = h >= 12 ? "pm" : "am";
    const h12 = ((h + 11) % 12) + 1;
    return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, "0")}${ap}`;
  };
  if (diff < -60) return {label: `due ${fmt(sched)}`, color: "var(--t-3)", overdue: false, minutes: -diff};
  if (diff < 15) return {label: "due now", color: "var(--accent)", urgent: true, overdue: false, minutes: 0};
  if (diff < 120) return {label: `${Math.round(diff)}min overdue`, color: "var(--c-warn)", overdue: true, minutes: diff};
  return {label: `${Math.round(diff / 60)}h overdue`, color: "var(--c-danger)", overdue: true, minutes: diff};
};

/* mg/mL concentration of a reconstituted vial.
   Returns null if either field is missing or zero. */
export const concentration = b => {
  if (!b?.mg_total || !b?.ml_bac) return null;
  return +(b.mg_total / b.ml_bac).toFixed(2);
};

/* Status of a batch for visual styling.
   Returns {label, color, rank, days?}.
   rank: 0=fresh active, 1=expiring soon (≤7d), 2=expired, 3=exhausted (manual).
   Lower rank = healthier. */
export const batchStatus = (b, now = new Date()) => {
  if (b.exhausted) return {label: "Exhausted", color: "var(--t-4)", rank: 3};
  if (b.expiry_date) {
    const days = Math.round((new Date(b.expiry_date + "T23:59:59") - now) / (1000 * 60 * 60 * 24));
    if (days < 0) return {label: "Expired", color: "var(--c-danger)", rank: 2, days};
    if (days <= 7) return {label: `${days}d to expiry`, color: "var(--c-warn)", rank: 1, days};
    return {label: `${days}d to expiry`, color: "var(--c-success)", rank: 0, days};
  }
  return {label: "Active", color: "var(--c-success)", rank: 0};
};

/* The most recent non-exhausted, non-expired batch for a given peptide.
   Returns null if none. Sorted by date_recon descending. */
export const currentBatchFor = (pepId, batches, now = new Date()) => {
  if (!Array.isArray(batches)) return null;
  const active = batches.filter(b =>
    b.peptide_id === pepId &&
    !b.exhausted &&
    (!b.expiry_date || new Date(b.expiry_date + "T23:59:59") >= now)
  );
  return active.sort((a, b) => b.date_recon.localeCompare(a.date_recon))[0] || null;
};

/* Extract mg quantity from a free-text dose string.
   "2.5mg (25u)"  → 2.5
   "40u (10.7mg)" → 10.7
   "100mcg"       → null  (no mg)
   ""             → null
   null/undefined → null */
export const mgFromDoseStr = str => {
  if (!str) return null;
  const m = String(str).match(/(\d+\.?\d*)\s*mg/i);
  return m ? +m[1] : null;
};

/* Live inventory for a peptide based on its current batch + cross-user dose log.
   Returns null if no batch, no valid mg/dose parse, or peptide is invalid.
   Otherwise: {totalDosesInVial, dosesUsed, dosesRemaining, daysSupply, mgPerDose, source}.

   dosesUsed counts entries in sharedDoseLog where:
   - date >= batch.date_recon
   - checks[peptide.id] is truthy
   sharedDoseLog is expected to be merged across users (household inventory model). */
export const inventoryFor = (peptide, batches, sharedDoseLog, now = new Date()) => {
  if (!peptide) return null;
  const batch = currentBatchFor(peptide.id, batches, now);
  if (!batch || !batch.mg_total) return null;
  const mgPerDose = mgFromDoseStr(peptide.dose);
  if (!mgPerDose || mgPerDose <= 0) return null;
  const totalDosesInVial = Math.floor(batch.mg_total / mgPerDose);
  const batchStart = batch.date_recon;
  const log = Array.isArray(sharedDoseLog) ? sharedDoseLog : [];
  const dosesUsed = log.filter(d => d.date >= batchStart && d.checks && d.checks[peptide.id]).length;
  const dosesRemaining = Math.max(0, totalDosesInVial - dosesUsed);
  const dosesPerWeek = (peptide.schedule || []).length || 1;
  const daysSupply = dosesPerWeek > 0 ? Math.round(dosesRemaining / dosesPerWeek * 7) : null;
  return {totalDosesInVial, dosesUsed, dosesRemaining, daysSupply, mgPerDose, source: "batch"};
};
