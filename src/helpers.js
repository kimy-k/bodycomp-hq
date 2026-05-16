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
 *  Takes the most recent enriched scan; returns {scenarios, projections}. */
export const buildProj = last => {
  const sc = [
    {name: "Conservative", rate: 0.6, color: "oklch(0.80 0.15 75)"},
    {name: "On Track",     rate: 1.0, color: "oklch(0.76 0.16 295)"},
    {name: "Aggressive",   rate: 1.4, color: "oklch(0.76 0.18 155)"},
  ];
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
