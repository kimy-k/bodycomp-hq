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
export const buildProj = (last, allScans) => {
  /* Try to compute actual observed monthly fat-loss rate from scan history */
  let actualRate = null;
  if (allScans && allScans.length >= 3) {
    /* Find a scan 21-60 days ago as baseline */
    const now = new Date(last.date + "T12:00:00");
    let baseline = null;
    for (let i = allScans.length - 2; i >= 0; i--) {
      const d = (now - new Date(allScans[i].date + "T12:00:00")) / 86400000;
      if (d >= 14 && d <= 60) { baseline = allScans[i]; break; }
    }
    if (baseline) {
      const days = (now - new Date(baseline.date + "T12:00:00")) / 86400000;
      const fatLost = baseline.fatMass - last.fatMass;  /* positive = lost fat */
      actualRate = +(fatLost / days * 30).toFixed(2);   /* kg fat lost per month */
    }
  }

  const sc = [
    {name: "Conservative", rate: 0.6, color: "oklch(0.80 0.15 75)"},
    {name: "On Track",     rate: 1.0, color: "oklch(0.76 0.16 295)"},
    {name: "Aggressive",   rate: 1.4, color: "oklch(0.76 0.18 155)"},
  ];
  /* Insert actual observed rate as the primary scenario when available */
  if (actualRate !== null && isFinite(actualRate)) {
    sc.unshift({
      name: "Actual Pace",
      rate: Math.max(actualRate, -1),  /* cap reverse at -1 to keep chart readable */
      color: actualRate > 0 ? "oklch(0.78 0.20 170)" : "oklch(0.70 0.20 25)",
    });
  }

  const p = [];
  for (let m = 0; m <= 12; m++) {
    const dt = new Date(last.date);
    dt.setMonth(dt.getMonth() + m);
    const e = {month: m, label: dt.toLocaleDateString("en-US", {month: "short", year: "2-digit"})};
    sc.forEach(s => {
      const fm = Math.max(last.fatMass - s.rate * m, 8);
      const tw = last.leanMass + fm;
      e[s.name] = +((fm / tw) * 100).toFixed(1);
    });
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
