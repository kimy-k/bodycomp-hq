/* ═══ HELPERS ═══ Pure utility functions, no React, no DOM-DOM, no fetch.
   Most have no dependencies. compressImage uses canvas (browser-only). */

/** Format a Date as "YYYY-MM-DD" using LOCAL date components.
 *  Using toISOString() here would silently shift to UTC and break in any
 *  non-UTC timezone — Manila is +8 so the date flips ~8 hours before midnight
 *  local, which made Saturday's peptide checks appear on Sunday morning. */
export const localDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Today's date as "YYYY-MM-DD" in the user's local timezone. */
export const todayKey = () => localDateKey(new Date());

/** Add N days to a "YYYY-MM-DD" string, return new "YYYY-MM-DD" (local). */
export const addDays = (date, n) => {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return localDateKey(d);
};

/** Build 12-month body-fat projections under conservative / on-track / aggressive scenarios.
 *  Uses actual observed fat-loss rate when ≥3 scans spanning ≥14 days exist.
 *  Takes enriched scans array + the most recent scan; returns {scenarios, projections}. */
/* Energy density of body fat. ~7,700 kcal per kg (3,500 per lb). */
export const FAT_KCAL_PER_KG = 7700;
/* Essential-fat floor by sex — projections must never curve below this. Replaces
   a hardcoded 8kg fat floor that was body-size blind (19% BF for Kim, 14% for Bea). */
export const MIN_BF_PCT = {female: 12, male: 5};

/* Share of total loss that comes off as LEAN tissue, as a function of how hard
   the deficit is. Zero up to 10%, rising to 20% at a 30% deficit. This is what
   makes an aggressive cut look less attractive than a moderate one: body fat %
   is a RATIO, so shedding lean mass works against the number you care about. */
export const leanLossFraction = deficitPct =>
  Math.min(0.20, Math.max(0, (deficitPct - 10) / 100));

/* Project one scenario forward 12 months, recomputing TDEE each month.
   Fixed kg/month is wrong: as mass comes off, BMR falls, so the same deficit
   PERCENT yields fewer absolute kcal and loss decelerates. Because targets are
   themselves derived from TDEE, holding deficitPct constant is what the app
   actually does month to month. */
const runPlan = (last, deficitPct, mult, minBf, months = 12) => {
  let lean = last.leanMass, fat = last.fatMass;
  const out = [];
  const leanFrac = leanLossFraction(deficitPct);
  for (let m = 0; m <= months; m++) {
    if (m > 0) {
      const bmr = 370 + 21.6 * lean;
      const tdee = bmr * mult;
      const kcalDeficit = tdee * (deficitPct / 100);
      const total = kcalDeficit * 30.44 / FAT_KCAL_PER_KG;
      const floor = lean * minBf / (100 - minBf);
      fat = Math.max(floor, fat - total * (1 - leanFrac));
      lean = Math.max(lean * 0.85, lean - total * leanFrac);
    }
    out.push({bf: +((fat / (lean + fat)) * 100).toFixed(1), fat: +fat.toFixed(2), lean: +lean.toFixed(2)});
  }
  return out;
};

/* Project a flat measured rate forward (used for Actual Pace). */
const runFlat = (last, kgPerMonth, minBf, months = 12) => {
  const out = [];
  for (let m = 0; m <= months; m++) {
    const floor = last.leanMass * minBf / (100 - minBf);
    const fat = Math.max(floor, last.fatMass - kgPerMonth * m);
    out.push({bf: +((fat / (last.leanMass + fat)) * 100).toFixed(1), fat: +fat.toFixed(2), lean: last.leanMass});
  }
  return out;
};

/* Measured fat-loss rate, kg/month. Least-squares regression over every scan in
   the last 70 days rather than differencing two endpoints — single InBody
   readings swing with hydration and glycogen, and a 2-point rate inherits that
   noise wholesale. Returns null when there is not enough signal to be honest. */
export const measuredRate = (last, allScans, windowDays = 70) => {
  if (!allScans || allScans.length < 3) return null;
  const now = new Date(last.date + "T12:00:00");
  const pts = allScans
    .map(s => ({x: (now - new Date(s.date + "T12:00:00")) / 86400000, y: s.fatMass}))
    .filter(p => p.x >= 0 && p.x <= windowDays && isFinite(p.y));
  if (pts.length < 3) return null;
  const span = Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x));
  if (span < 21) return null;               /* too short a window to mean anything */
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  if (!den) return null;
  const slope = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / den;
  /* x counts days BACKWARD, so a positive slope means fat mass was higher in the
     past — i.e. fat is being lost now. kg/month. */
  return {rate: +(slope * 30.44).toFixed(2), n, spanDays: Math.round(span)};
};

/* Build projection scenarios anchored on the user's ACTUAL plan.
   opts: {deficitPct, activity, gender} */
export const buildProj = (last, allScans, opts = {}) => {
  const deficitPct = Number.isFinite(opts.deficitPct) ? opts.deficitPct : 15;
  const mult = ({sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725})[opts.activity] || 1.375;
  const minBf = MIN_BF_PCT[opts.gender === "male" ? "male" : "female"];

  const lighter = Math.max(5, deficitPct - 5);
  const harder = Math.min(30, deficitPct + 5);

  const sc = [
    {name: "Your Plan", primary: true, deficitPct, note: `${deficitPct}% deficit`, color: "oklch(0.76 0.16 295)"},
    {name: "Lighter", deficitPct: lighter, note: `${lighter}% deficit`, color: "oklch(0.80 0.15 75)"},
    {name: "Harder", deficitPct: harder, note: `${harder}% deficit`, color: "oklch(0.76 0.18 155)"},
  ];

  const meas = measuredRate(last, allScans);
  if (meas) {
    sc.unshift({
      name: "Actual Pace",
      measured: true,
      rateFixed: meas.rate,
      note: `measured · ${meas.n} scans / ${meas.spanDays}d`,
      color: meas.rate > 0 ? "oklch(0.78 0.20 170)" : "oklch(0.70 0.20 25)",
    });
  }

  const series = {};
  sc.forEach(s => {
    series[s.name] = s.measured ? runFlat(last, s.rateFixed, minBf)
                                : runPlan(last, s.deficitPct, mult, minBf);
    /* Headline kg/mo = first-month fat change — the rate that applies right now,
       before adaptation slows it. */
    s.rate = s.measured ? s.rateFixed
      : +(series[s.name][0].fat - series[s.name][1].fat).toFixed(2);
    /* Projected lean mass change over 12 months — the cost of the deficit. */
    s.leanDelta = +(series[s.name][12].lean - series[s.name][0].lean).toFixed(1);
  });

  const p = [];
  for (let m = 0; m <= 12; m++) {
    const dt = new Date(last.date);
    dt.setMonth(dt.getMonth() + m);
    const e = {month: m, label: dt.toLocaleDateString("en-US", {month: "short", year: "2-digit"})};
    sc.forEach(s => { e[s.name] = series[s.name][m].bf; });
    p.push(e);
  }
  return {scenarios: sc, projections: p};
};

/** Group an array of enriched scans by YYYY-MM, return monthly averages. */
export const calcMonthly = data => {
  const m = {};
  data.forEach(d => {
    const k = d.date.substring(0, 7);
    if (!m[k]) m[k] = [];
    m[k].push(d);
  });
  return Object.keys(m).sort().map(k => {
    const s = m[k];
    return {
      label: new Date(k + "-15").toLocaleDateString("en-US", {month: "short", year: "2-digit"}),
      avgFat: +(s.reduce((a, d) => a + d.fatMass, 0) / s.length).toFixed(1),
      avgPct: +(s.reduce((a, d) => a + d.fatPct, 0) / s.length).toFixed(1),
      avgMuscle: +(s.reduce((a, d) => a + d.muscle, 0) / s.length).toFixed(1),
      count: s.length,
    };
  });
};

/** Compress an image file to a JPEG blob (max 1080px wide, ~78% quality).
 *  Typical 3-5MB iPhone shot → ~200-400KB. Browser-only (uses canvas + FileReader). */
export const compressImage = (file, maxWidth = 1080, quality = 0.78) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          b => (b ? resolve(b) : reject(new Error("compression failed"))),
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("invalid image"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
