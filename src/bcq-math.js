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

/* Extract mg quantity from a free-text dose string. Parses mg, mcg (→ ÷1000),
   and ug (synonym for mcg). The (?!\w) lookahead prevents false matches like
   "200mcg" being read as "00 mg" or "Xmg/mL" being read as just mg.
   "2.5mg (25u)"              → 2.5
   "40u (10.7mg)"             → 10.7
   "100mcg"                   → 0.1
   "12u (0.12mL · 400mcg)"    → 0.4
   "200mcg x2 daily"          → 0.2  (per-dose mass; BID handled separately)
   ""                         → null
   null/undefined             → null */
export const mgFromDoseStr = str => {
  if (!str) return null;
  const s = String(str);
  const mgMatch  = s.match(/(\d+\.?\d*)\s*mg(?![a-z])/i);
  if (mgMatch) return +mgMatch[1];
  const mcgMatch = s.match(/(\d+\.?\d*)\s*mcg\b/i);
  if (mcgMatch) return +(+mcgMatch[1] / 1000).toFixed(6);
  const ugMatch  = s.match(/(\d+\.?\d*)\s*(?:ug|µg)\b/i);
  if (ugMatch) return +(+ugMatch[1] / 1000).toFixed(6);
  return null;
};

/* Extract syringe units (u) from a dose string.
   "2.5mg (25u) QD" → 25, "15u (0.15mL)" → 15, "100mcg ea (3u)" → 3 */
export const unitsFromDoseStr = str => {
  if (!str) return null;
  const m = String(str).match(/(\d+\.?\d*)\s*u(?:\b|[)\s,])/i);
  return m ? +m[1] : null;
};

/* Compute actual mg per injection using batch concentration × syringe units.
   This is the CORRECT calculation — it uses the real concentration from the
   mixed vial, not the mg text in the dose string (which may be wrong if the
   BAC water amount changed).
   Falls back to mgFromDoseStr if units can't be parsed. */
export const mgPerDoseFromBatch = (peptide, batch) => {
  if (!peptide || !batch) return mgFromDoseStr(peptide?.dose);
  const units = unitsFromDoseStr(peptide.dose);
  if (units && batch.mg_total && batch.ml_bac) {
    const conc = batch.mg_total / batch.ml_bac; // mg per ml
    const actualMg = units * 0.01 * conc;        // 1 unit = 0.01 ml
    return +actualMg.toFixed(4);
  }
  // Fallback: parse mg from text (less accurate but better than nothing)
  return mgFromDoseStr(peptide.dose);
};

/* Extract doses-per-day from a dose string (or null = default 1).
   Detects BID/TID/QID, "x2 daily", "twice daily", and "x N" multipliers.
   Caller is responsible for applying this to monthly cost calculations.
   "2.5mg (25u) BID"     → 2
   "200mcg x2 daily"     → 2
   "1 mg TID"            → 3
   "40u (10.7mg)"        → 1  (no multi-dose marker) */
export const dosesPerDayFromDose = str => {
  if (!str) return 1;
  const s = String(str).toLowerCase();
  if (/\bqid\b|four\s*times\s*daily/.test(s)) return 4;
  if (/\btid\b|three\s*times\s*daily|3x\s*daily|x\s*3\s*daily/.test(s)) return 3;
  if (/\bbid\b|twice\s*daily|2x\s*daily|x\s*2\s*daily/.test(s)) return 2;
  const xMatch = s.match(/\bx\s*(\d+)\b/);
  if (xMatch) {
    const n = +xMatch[1];
    if (n >= 2 && n <= 6) return n; /* guard nonsense values */
  }
  return 1;
};

/* Live inventory for a peptide based on its current batch + cross-user dose log.
   Returns null if no batch, no valid mg/dose parse, or peptide is invalid.
   Otherwise: {totalDosesInVial, dosesUsed, dosesRemaining, daysSupply, mgPerDose, source}.

   dosesUsed counts entries in sharedDoseLog where:
   - date >= batch.date_recon
   - checks[peptide.id] is truthy
   sharedDoseLog is expected to be merged across users (household inventory model).
   sharedDosesPerWeek: total scheduled doses/week across ALL users sharing this vial (not just current user). */
export const inventoryFor = (peptide, batches, sharedDoseLog, now = new Date(), sharedDosesPerWeek = null) => {
  if (!peptide) return null;
  const batch = currentBatchFor(peptide.id, batches, now);
  if (!batch || !batch.mg_total) return null;
  const mgPerDose = mgPerDoseFromBatch(peptide, batch);
  if (!mgPerDose || mgPerDose <= 0) return null;
  const totalDosesInVial = Math.floor(batch.mg_total / mgPerDose);
  const batchStart = batch.date_recon;
  const log = Array.isArray(sharedDoseLog) ? sharedDoseLog : [];
  const dosesUsed = log.filter(d => d.date >= batchStart && d.checks && d.checks[peptide.id]).length;
  const dosesRemaining = Math.max(0, totalDosesInVial - dosesUsed);
  /* Use shared household consumption rate if provided, else fall back to single-user schedule */
  const dosesPerWeek = sharedDosesPerWeek || (peptide.schedule || []).length || 1;
  const daysSupply = dosesPerWeek > 0 ? Math.round(dosesRemaining / dosesPerWeek * 7) : null;
  return {totalDosesInVial, dosesUsed, dosesRemaining, daysSupply, mgPerDose, source: "batch"};
};

/* ═══ COST DERIVATIONS ═══
   All values returned in the batch's own currency (no FX conversion done here).
   Caller is responsible for currency awareness when aggregating. */

/* Cost per mg = batch.cost / batch.mg_total. Returns null if either is missing. */
export const costPerMg = batch => {
  if (!batch || batch.cost == null || !batch.mg_total) return null;
  return +(batch.cost / batch.mg_total).toFixed(3);
};

/* Cost per dose = costPerMg × mgPerDose.
   peptide.dose is the free-text dose string (e.g. "2.5mg" or "40u (10.7mg)").
   Returns null if cost/mg can't be computed OR no mg parsed from dose. */
export const costPerDose = (batch, peptide) => {
  const cpm = costPerMg(batch);
  if (cpm == null || !peptide) return null;
  const mg = mgPerDoseFromBatch(peptide, batch);
  if (!mg || mg <= 0) return null;
  return +(cpm * mg).toFixed(2);
};

/* Monthly cost = cost/dose × doses-per-month.
   doses-per-month = scheduled-days-per-week × 4.33 × doses-per-day (BID/TID).
   - schedule.length=7 daily × 1/day        → ~30/mo
   - schedule.length=7 daily × 2/day (BID)  → ~60/mo
   - schedule.length=4 × 1/day              → ~17/mo
   - schedule.length=1 (weekly)             → ~4.33/mo
   Returns null if cost/dose can't be computed.
   PRN peptides (status='prn') return null since usage is unpredictable. */
export const costPerMonth = (batch, peptide) => {
  const cpd = costPerDose(batch, peptide);
  if (cpd == null || !peptide) return null;
  if (peptide.status === "prn") return null;
  const dosesPerWeek = Array.isArray(peptide.schedule) ? peptide.schedule.length : 0;
  if (!dosesPerWeek) return null;
  const dosesPerDay = dosesPerDayFromDose(peptide.dose);
  const dosesPerMonth = dosesPerWeek * 4.33 * dosesPerDay;
  return +(cpd * dosesPerMonth).toFixed(2);
};

/* Format a cost with the right currency symbol/code. Defaults to USD. */
export const fmtCost = (amount, currency = "USD") => {
  if (amount == null) return null;
  const sym = {USD: "$", PHP: "₱", EUR: "€", GBP: "£"}[currency] || "";
  if (sym) return `${sym}${amount.toLocaleString("en-US", {minimumFractionDigits: 0, maximumFractionDigits: 2})}`;
  return `${amount.toLocaleString("en-US", {minimumFractionDigits: 0, maximumFractionDigits: 2})} ${currency}`;
};

/* ─── Blend overlap (overlap-aware break flag) ───────────────────────────
   A "break" from a blend isn't a real washout if another *currently active*
   peptide still delivers the same component compounds. Given a peptide and the
   rest of the user's effective stack, return the component-ids `pep` shares
   with any active (or starting) peptide. Empty array ⇒ a genuine washout.
   Pure; status strings: 'active' | 'starting' | 'break' | 'prn'. */
export const sharedActiveComponents = (pep, others) => {
  const comp = (pep && Array.isArray(pep.components)) ? pep.components : [];
  if (!comp.length) return [];
  const active = new Set();
  for (const o of (others || [])) {
    if (!o || o.id === pep.id) continue;
    if (o.status !== "active" && o.status !== "starting") continue;
    for (const c of (Array.isArray(o.components) ? o.components : [])) active.add(c);
  }
  return comp.filter(c => active.has(c));
};

/* ── Energy model ──────────────────────────────────────────────────────────
   Single source of truth for BMR / TDEE / macro targets.

   Katch-McArdle (lean mass) when an InBody scan exists; Mifflin-St Jeor as
   fallback. Targets DERIVE from the latest scan rather than being stored
   constants, so a Saturday scan moves Sunday's targets automatically.

   Previously three call sites computed TDEE independently — Dashboard used
   Katch-McArdle, insights.js used Mifflin off a stale config weight — and
   disagreed by ~130 kcal. Everything routes through here now. */
export const ACTIVITY_MULT = {sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725};

/* A deficit above this is flagged as aggressive rather than sustainable.
   Was 25 — too permissive for a lifter trying to hold lean mass in a cut. */
export const SUSTAINABLE_DEFICIT_PCT = 20;

/* ── Adaptive TDEE ──────────────────────────────────────────────────────────
   The formula above guesses expenditure from a population multiplier. This
   MEASURES it: over a trailing window, what you logged eating minus the energy
   equivalent of how your weight actually moved. It absorbs logging bias (if you
   under-log 10%, the "TDEE" it finds is 10% low too — and so is the target it
   produces, which is exactly right for how you log), real activity, and
   metabolic adaptation, because it reads the outcome rather than the inputs.

   The energy term uses FAT MASS slope when scans carry it, weight slope only as
   a fallback. Scale-only apps have to use weight × 7,700, and it burns them:
   a post-GLP-1 rehydration month reads as a 1.5 kg "gain" that was almost all
   water and glycogen. Fat mass is what actually costs 7,700 kcal/kg; lean-mass
   swings on BIA are mostly fluid and are deliberately excluded. (The small
   energy cost of real muscle gain is ignored — ~30 kcal/day at most.)

   Slopes are Theil-Sen (median of pairwise slopes), not least-squares: with
   weekly scans a single depleted reading at the window edge swings an OLS fit
   by hundreds of kcal. The median doesn't care.

   Confidence rises with scan count and logging coverage; the result is a blend
   of adaptive and formula weighted by that confidence, clamped so a bad
   fortnight of logging can't produce a nonsense number. Needs ≥3 scans and
   ≥50% of days logged in the window to start trusting itself at all. */
export const KCAL_PER_KG = 7700;  /* energy density of adipose tissue — the standard figure */

/* Median of pairwise slopes. points: [{x, y}], x in days. */
export const theilSen = points => {
  if (!points || points.length < 2) return null;
  const slopes = [];
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j].x - points[i].x;
      if (dx !== 0) slopes.push((points[j].y - points[i].y) / dx);
    }
  if (!slopes.length) return null;
  slopes.sort((a, b) => a - b);
  const m = slopes.length >> 1;
  return slopes.length % 2 ? slopes[m] : (slopes[m - 1] + slopes[m]) / 2;
};

const dayIndex = (iso, origin) => Math.round((new Date(iso + "T12:00:00Z") - origin) / 86400000);

export const adaptiveTDEE = ({
  scans = [],            /* [{date, weight}] any order */
  macroDays = [],        /* [{date, cal}] per-day totals INCLUDING whey */
  formulaTdee = null,    /* Katch-McArdle × mult, for blend + clamp */
  now = new Date(),
  windowDays = 35,
  kcalPerKg = KCAL_PER_KG,
  minScans = 3,
  minCoverage = 0.5,
} = {}) => {
  const base = {source: "formula", confidence: 0, tdee: formulaTdee, formula: formulaTdee,
                adaptive: null, avgIntake: null, loggedDays: 0, windowDays, coverage: 0,
                nScans: 0, slopeKgWk: null, slopeWtKgWk: null, slopeBasis: null,
                clamped: false, reason: null};
  if (!formulaTdee) return {...base, reason: "no formula TDEE"};

  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
  const start = new Date(end.getTime() - windowDays * 86400000);
  const inWin = d => { const t = new Date(d + "T12:00:00Z"); return t >= start && t <= end; };

  const inScans = scans.filter(s => s?.date && Number.isFinite(+s.weight) && inWin(s.date))
                       .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (inScans.length < minScans) return {...base, nScans: inScans.length, reason: `need ${minScans} scans in ${windowDays}d, have ${inScans.length}`};

  const logged = macroDays.filter(m => m?.date && Number.isFinite(+m.cal) && +m.cal > 0 && inWin(m.date));
  const loggedDays = logged.length;
  const coverage = loggedDays / windowDays;
  if (coverage < minCoverage) return {...base, nScans: inScans.length, loggedDays, coverage: +coverage.toFixed(2),
                                      reason: `need ${Math.round(minCoverage*100)}% of days logged, have ${Math.round(coverage*100)}%`};

  const wtPts  = inScans.map(s => ({x: dayIndex(s.date, start), y: +s.weight}));
  const fatPts = inScans.filter(s => Number.isFinite(+s.fatMass))
                        .map(s => ({x: dayIndex(s.date, start), y: +s.fatMass}));
  const slopeWt  = theilSen(wtPts);                                       /* kg/day */
  const useFat   = fatPts.length >= minScans;
  const slope    = useFat ? theilSen(fatPts) : slopeWt;
  const avgIntake = logged.reduce((s, m) => s + +m.cal, 0) / loggedDays;
  const raw = avgIntake - slope * kcalPerKg;

  const lo = formulaTdee * 0.70, hi = formulaTdee * 1.35;
  const adaptive = Math.min(hi, Math.max(lo, raw));
  const clamped = adaptive !== raw;

  const n = useFat ? fatPts.length : wtPts.length;
  const scanConf = Math.min(1, Math.max(0, (n - 2) / 4));                /* 3→.25 … 6+→1 */
  const logConf  = Math.min(1, Math.max(0, (coverage - 0.5) / 0.4));     /* 50%→0 … 90%+→1 */
  const confidence = +(scanConf * logConf).toFixed(2);

  const tdee = Math.round(confidence * adaptive + (1 - confidence) * formulaTdee);
  const source = confidence >= 0.85 ? "adaptive" : confidence <= 0.15 ? "formula" : "blended";

  return {source, confidence, tdee, formula: formulaTdee, adaptive: Math.round(adaptive),
          avgIntake: Math.round(avgIntake), loggedDays, windowDays, coverage: +coverage.toFixed(2),
          nScans: n, slopeKgWk: +(slope * 7).toFixed(2), slopeWtKgWk: +(slopeWt * 7).toFixed(2),
          slopeBasis: useFat ? "fat mass" : "weight", clamped, reason: null};
};

export const energyModel = ({
  leanMass = null, weight = null, height = null, age = null,
  gender = "female", activity = "light",
  deficitPct = 15, proteinPerKgLean = 4.4, fatPctKcal = 0.29,
  tdeeOverride = null,   /* from adaptiveTDEE — replaces bmr×mult when present */
  adaptive = null,       /* the full adaptiveTDEE result, passed through for display */
} = {}) => {
  const mult = ACTIVITY_MULT[activity] || 1.375;
  const bmrKM = leanMass ? 370 + 21.6 * leanMass : null;
  const bmrMSJ = (weight && height && age)
    ? (gender === "male" ? 10*weight + 6.25*height - 5*age + 5
                         : 10*weight + 6.25*height - 5*age - 161)
    : null;
  const bmr = bmrKM || bmrMSJ;
  if (!bmr) return null;

  const formulaTdee = Math.round(bmr * mult);
  const tdee = Number.isFinite(tdeeOverride) && tdeeOverride > 0 ? Math.round(tdeeOverride) : formulaTdee;
  const cal = Math.round(tdee * (1 - deficitPct/100) / 10) * 10;
  /* Protein scales off LEAN mass, not bodyweight — in a cut, bodyweight falls
     and a bodyweight-derived target would cut protein exactly when it matters most. */
  const protein = leanMass ? Math.round(leanMass * proteinPerKgLean)
                           : Math.round((weight || 0) * 2.9);
  const fat = Math.round(cal * fatPctKcal / 9);
  const carbs = Math.max(0, Math.round((cal - protein*4 - fat*9) / 4));

  return {
    bmr: Math.round(bmr),
    bmrLabel: bmrKM ? "Katch-McArdle" : "Mifflin-St Jeor",
    mult, tdee, formulaTdee, deficitPct,
    tdeeSource: adaptive?.source || "formula",
    adaptive,
    deficit: tdee - cal,
    sustainable: deficitPct <= SUSTAINABLE_DEFICIT_PCT,
    cal, protein, fat, carbs,
  };
};

/* Build the energy model from a user config + the most recent scan.
   Pass `history` ({scans, macroDays, now}) to enable adaptive TDEE; without
   it — or with cfg.adaptiveTdee === false — the formula is used unchanged. */
export const energyFromConfig = (cfg, latestScan, history = null) => {
  const inputs = {
    leanMass: latestScan?.leanMass ?? null,
    weight: latestScan?.weight ?? cfg?.weight ?? null,
    height: cfg?.height, age: cfg?.age, gender: cfg?.gender,
    activity: cfg?.activity,
    deficitPct: cfg?.deficitPct ?? 15,
    proteinPerKgLean: cfg?.proteinPerKgLean ?? 4.4,
    fatPctKcal: cfg?.fatPctKcal ?? 0.29,
  };
  const formula = energyModel(inputs);
  if (!formula) return null;
  if (!history || cfg?.adaptiveTdee === false) return formula;

  const ad = adaptiveTDEE({
    scans: history.scans || [], macroDays: history.macroDays || [],
    formulaTdee: formula.formulaTdee, now: history.now || new Date(),
    windowDays: cfg?.adaptiveWindowDays ?? 35,
    kcalPerKg: cfg?.kcalPerKg ?? KCAL_PER_KG,
  });
  return energyModel({...inputs, tdeeOverride: ad.tdee, adaptive: ad});
};

/* ── Reconstitution recall ────────────────────────────────────────────────
   "How did I mix this last time, and how long does it keep?"

   Shelf life is DERIVED from the user's own history rather than a constant:
   MOTS-c has consistently run a 14-day window, reta 28. A hardcoded number
   would be wrong for one of them. Median of (expiry - recon) across that
   peptide's batches, so a single mis-typed expiry doesn't skew it. */
export const lastMixFor = (pepId, batches) => {
  if (!pepId || !batches?.length) return null;
  const mine = batches
    .filter(b => b.peptide_id === pepId && b.date_recon)
    .sort((a, b) => (a.date_recon < b.date_recon ? 1 : -1));
  if (!mine.length) return null;
  const last = mine[0];

  const spans = mine
    .filter(b => b.expiry_date && b.date_recon)
    .map(b => Math.round(
      (new Date(b.expiry_date + "T12:00:00") - new Date(b.date_recon + "T12:00:00")) / 86400000))
    .filter(d => d > 0 && d < 400)
    .sort((a, b) => a - b);
  const shelfDays = spans.length
    ? spans[Math.floor(spans.length / 2)]
    : null;

  const mgPerMl = (last.mg_total && last.ml_bac) ? +(last.mg_total / last.ml_bac).toFixed(2) : null;
  return {
    batch: last,
    mgTotal: +last.mg_total,
    mlBac: +last.ml_bac,
    mgPerMl,
    storage: last.storage || null,
    vendor: last.vendor || null,
    shelfDays,
    shelfFrom: spans.length,          /* how many batches the window is inferred from */
    daysSince: Math.round((Date.now() - new Date(last.date_recon + "T12:00:00")) / 86400000),
  };
};

/* Units on a U-100 syringe for a given mg dose at a given concentration. */
export const unitsForDose = (mgDose, mgPerMl) =>
  (!mgDose || !mgPerMl) ? null : Math.round((mgDose / mgPerMl) * 100);

/* expiry = recon + shelf life, as a YYYY-MM-DD string. */
export const expiryFrom = (reconDate, shelfDays) => {
  if (!reconDate || !shelfDays) return "";
  const d = new Date(reconDate + "T12:00:00");
  d.setDate(d.getDate() + shelfDays);
  return d.toISOString().slice(0, 10);
};
