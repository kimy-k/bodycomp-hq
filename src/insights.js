/* ═══ INSIGHTS ENGINE ═══
   Pure function: takes all data streams + targets, returns ranked insight array.
   Each insight has a guard clause — degrades gracefully on sparse data. */

export const computeInsights = ({pepHist, macroHist, whoopHist, measurements, scans, userPeps, TARGETS, whey, goalBf, userConfig}) => {
  const out = [];
  const now = new Date();
  const daysAgo = (dateStr) => (now - new Date(dateStr + "T12:00:00")) / 86400000;
  const inLast = (dateStr, n) => daysAgo(dateStr) <= n;

  /* 1. Protein this week */
  if (macroHist && macroHist.length >= 3 && TARGETS) {
    const last7 = macroHist.filter(d => inLast(d.date, 7));
    if (last7.length >= 3) {
      const proteins = last7.map(d => {
        let p = 0;
        (d.meals || []).forEach(m => p += (+m.protein || 0));
        if (d.whey !== false && whey?.enabled) p += whey.protein;
        return p;
      });
      const avg = Math.round(proteins.reduce((a,b) => a+b, 0) / proteins.length);
      const hit = proteins.filter(p => p >= TARGETS.protein).length;
      const gap = TARGETS.protein - avg;
      const hitting = avg >= TARGETS.protein * 0.95;
      out.push({
        id: "protein",
        icon: "muscle",
        title: "Protein",
        body: hitting
          ? `Averaging ${avg}g/day (target ${TARGETS.protein}g). Hit target ${hit} of ${last7.length} days.`
          : `Averaging ${avg}g/day — ${gap}g/day below target. Hit on ${hit} of ${last7.length} days.`,
        color: hitting ? "var(--c-success)" : "var(--c-protein)",
        severity: hitting ? 0 : 2,
      });
    }
  }

  /* 2. Peptide adherence + streak */
  if (pepHist && pepHist.length >= 3 && userPeps?.length) {
    const sorted = [...pepHist].sort((a,b) => b.date.localeCompare(a.date));
    let streak = 0;
    for (const d of sorted) {
      if (Object.keys(d.checks || {}).length > 0) streak++;
      else break;
    }
    let due = 0, taken = 0;
    sorted.filter(d => inLast(d.date, 7)).forEach(d => {
      const dow = new Date(d.date + "T12:00:00").getDay();
      const dueFor = userPeps.filter(p => (p.status === "active" || p.status === "prn") && (p.schedule || []).includes(dow));
      due += dueFor.length;
      taken += dueFor.filter(p => (d.checks || {})[p.id]).length;
    });
    if (due > 0) {
      const pct = Math.round(taken / due * 100);
      out.push({
        id: "pep-adherence",
        icon: "peps",
        title: "Peptide adherence",
        body: streak > 0
          ? `${streak}-day streak. ${pct}% adherence this week (${taken} of ${due} doses).`
          : `${pct}% adherence this week (${taken} of ${due} doses).`,
        color: pct >= 90 ? "var(--c-success)" : pct >= 70 ? "var(--accent)" : "var(--c-warn)",
        severity: pct < 70 ? 2 : 0,
      });
    }
  }

  /* 3. Body fat trajectory + projection */
  if (scans && scans.length >= 3) {
    const last = scans[scans.length - 1];
    let baseline = null;
    for (let i = scans.length - 2; i >= 0; i--) {
      const d = daysAgo(scans[i].date);
      if (d >= 21 && d <= 49) { baseline = scans[i]; break; }
    }
    if (baseline && goalBf) {
      const delta = +(last.fatPct - baseline.fatPct).toFixed(1);
      const days = (new Date(last.date) - new Date(baseline.date)) / 86400000;
      const ratePerDay = delta / days;
      const toGo = goalBf - last.fatPct;
      let proj = "";
      if (ratePerDay < 0 && toGo < 0) {
        const months = Math.round((toGo / ratePerDay) / 30);
        if (months >= 1 && months <= 24) proj = ` At this rate, ~${months} month${months !== 1 ? "s" : ""} to ${goalBf}%.`;
      }
      const arrow = delta < 0 ? "▼" : delta > 0 ? "▲" : "=";
      out.push({
        id: "bf-trend",
        icon: "fat",
        title: "Body fat trend",
        body: `${last.fatPct}% now · ${arrow}${Math.abs(delta)}% in ~${Math.round(days)} days.${proj}`,
        color: delta < 0 ? "var(--c-success)" : delta > 0 ? "var(--c-bodyfat)" : "var(--t-3)",
        severity: delta > 0.5 ? 2 : 0,
      });
    }
  }

  /* 4. Recovery week-over-week */
  if (whoopHist && whoopHist.length >= 5) {
    const last7 = whoopHist.filter(d => inLast(d.date, 7));
    const prev7 = whoopHist.filter(d => { const a = daysAgo(d.date); return a > 7 && a <= 14; });
    if (last7.length >= 3) {
      const avgThis = Math.round(last7.reduce((a,b) => a + (+b.recovery || 0), 0) / last7.length);
      const avgPrev = prev7.length >= 3 ? Math.round(prev7.reduce((a,b) => a + (+b.recovery || 0), 0) / prev7.length) : null;
      let deltaTxt = "";
      if (avgPrev !== null) {
        const d = avgThis - avgPrev;
        deltaTxt = ` ${d > 0 ? "▲" : d < 0 ? "▼" : "="}${Math.abs(d)} vs last week.`;
      }
      out.push({
        id: "recovery",
        icon: "heart",
        title: "Recovery",
        body: `${avgThis}% average this week.${deltaTxt}`,
        color: avgThis >= 67 ? "var(--c-success)" : avgThis >= 34 ? "var(--c-warn)" : "var(--c-danger)",
        severity: avgThis < 34 ? 2 : 0,
      });
    }
  }

  /* 5. Waist trend (measurements) */
  if (measurements && measurements.length >= 2) {
    const sorted = [...measurements].sort((a,b) => b.date.localeCompare(a.date));
    const latest = sorted.find(m => m.waist != null);
    let older = null;
    if (latest) {
      for (const m of sorted) {
        if (m.date === latest.date) continue;
        if (m.waist == null) continue;
        const d = daysAgo(m.date) - daysAgo(latest.date);
        if (d >= 14) { older = m; break; }
      }
    }
    if (latest && older) {
      const delta = +(latest.waist - older.waist).toFixed(1);
      const days = Math.round(daysAgo(older.date) - daysAgo(latest.date));
      if (Math.abs(delta) >= 0.3) {
        out.push({
          id: "waist",
          icon: "ruler",
          title: "Waist",
          body: `${latest.waist}cm now (${delta < 0 ? "▼" : "▲"}${Math.abs(delta)}cm over ${days} days).`,
          color: delta < 0 ? "var(--c-success)" : "var(--c-warn)",
          severity: 0,
        });
      }
    }
  }

  /* 6. Klow recovery correlation (the killer cross-stream insight) */
  if (whoopHist && whoopHist.length >= 7 && pepHist && pepHist.length >= 7) {
    const klowDates = new Set(pepHist.filter(d => (d.checks || {})["klow"]).map(d => d.date));
    const withK = whoopHist.filter(w => klowDates.has(w.date) && w.recovery != null);
    const noK = whoopHist.filter(w => !klowDates.has(w.date) && w.recovery != null);
    if (withK.length >= 3 && noK.length >= 3) {
      const aW = Math.round(withK.reduce((a,b) => a + +b.recovery, 0) / withK.length);
      const aN = Math.round(noK.reduce((a,b) => a + +b.recovery, 0) / noK.length);
      const diff = aW - aN;
      if (Math.abs(diff) >= 5) {
        out.push({
          id: "klow-corr",
          icon: "vial",
          title: "Klow × recovery",
          body: `Recovery averages ${aW}% on Klow days (n=${withK.length}) vs ${aN}% on rest days (n=${noK.length}). ${diff > 0 ? "Worth keeping in the stack." : "Worth a closer look."}`,
          color: diff > 0 ? "var(--c-success)" : "var(--c-warn)",
          severity: 1,
        });
      }
    }
  }

  /* 7. Peptide cycles ending */
  (userPeps || []).forEach(p => {
    if (p.cycleEnd) {
      const left = Math.round((new Date(p.cycleEnd + "T23:59:59") - now) / 86400000);
      if (left >= 0 && left <= 10) {
        out.push({
          id: `cycle-${p.id}`,
          icon: "calendar",
          title: `${p.name} cycle ending`,
          body: `${left} day${left !== 1 ? "s" : ""} remaining (ends ${new Date(p.cycleEnd + "T12:00:00").toLocaleDateString("en-US", {weekday: "long", month: "short", day: "numeric"})}).`,
          color: p.color,
          severity: 1,
        });
      }
    }
  });

  /* 8. Energy balance (deficit) */
  if (macroHist && macroHist.length >= 5 && userConfig?.weight && userConfig?.height && userConfig?.age) {
    const w = userConfig.weight, h = userConfig.height, a = userConfig.age;
    const bmr = userConfig.gender === "male" ? 10*w + 6.25*h - 5*a + 5 : 10*w + 6.25*h - 5*a - 161;
    const mult = ({sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725})[userConfig.activity] || 1.375;
    const tdee = Math.round(bmr * mult);
    const last7 = macroHist.filter(d => inLast(d.date, 7));
    if (last7.length >= 3 && tdee > 0) {
      const cals = last7.map(d => {
        let c = 0;
        (d.meals || []).forEach(m => c += ((+m.protein || 0) * 4 + (+m.carbs || 0) * 4 + (+m.fat || 0) * 9));
        if (d.whey !== false && whey?.enabled) c += (whey.protein * 4 + whey.carbs * 4 + whey.fat * 9);
        return c;
      });
      const avg = Math.round(cals.reduce((a,b) => a+b, 0) / cals.length);
      const def = tdee - avg;
      const pct = Math.round(def / tdee * 100);
      if (Math.abs(pct) >= 5) {
        const sustainable = def > 0 && pct <= 25;
        out.push({
          id: "energy",
          icon: "macros",
          title: "Energy balance",
          body: def > 0
            ? `Averaging ${avg} kcal · ${def} below TDEE (${pct}% deficit). ${sustainable ? "Sustainable range." : "Aggressive — watch for fatigue."}`
            : `Averaging ${avg} kcal · ${-def} over TDEE (${-pct}% surplus). Recheck targets if fat loss is the goal.`,
          color: sustainable ? "var(--c-success)" : "var(--c-warn)",
          severity: !sustainable ? 1 : 0,
        });
      }
    }
  }

  /* 9. Plateau detection — weight unchanged despite an active deficit */
  if (scans && scans.length >= 2 && macroHist && macroHist.length >= 7 && userConfig?.weight && userConfig?.height && userConfig?.age) {
    const last = scans[scans.length - 1];
    let baseline = null;
    for (let i = scans.length - 2; i >= 0; i--) {
      const d = daysAgo(scans[i].date);
      if (d >= 14 && d <= 42) { baseline = scans[i]; break; }
    }
    if (baseline) {
      const wDelta = +(last.weight - baseline.weight).toFixed(1);
      const days = Math.round(daysAgo(baseline.date) - daysAgo(last.date));
      const w = userConfig.weight, h = userConfig.height, a = userConfig.age;
      const bmr = userConfig.gender === "male" ? 10*w + 6.25*h - 5*a + 5 : 10*w + 6.25*h - 5*a - 161;
      const mult = ({sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725})[userConfig.activity] || 1.375;
      const tdee = Math.round(bmr * mult);
      const last14 = macroHist.filter(d => inLast(d.date, 14));
      if (last14.length >= 5 && tdee > 0) {
        const cals = last14.map(d => {
          let c = 0;
          (d.meals || []).forEach(m => c += ((+m.protein || 0) * 4 + (+m.carbs || 0) * 4 + (+m.fat || 0) * 9));
          if (d.whey !== false && whey?.enabled) c += (whey.protein * 4 + whey.carbs * 4 + whey.fat * 9);
          return c;
        });
        const avgCal = Math.round(cals.reduce((a,b) => a+b, 0) / cals.length);
        const deficit = tdee - avgCal;
        const deficitPct = Math.round(deficit / tdee * 100);
        if (Math.abs(wDelta) <= 0.4 && deficit > 0 && deficitPct >= 10) {
          const drop = Math.round(150 / 4);
          out.push({
            id: "plateau",
            icon: "warn",
            title: "Plateau detected",
            body: `Weight unchanged (±${Math.abs(wDelta)}kg over ${days} days) despite ~${deficit} kcal/day deficit. Body's adapting — drop carbs by ~${drop}g/day, or add a single refeed day this week to break it.`,
            color: "var(--c-warn)",
            severity: 1,
          });
        }
      }
    }
  }

  /* 10. Side effect pattern */
  if (pepHist && pepHist.length >= 5) {
    const fxCount = {};
    pepHist.filter(d => inLast(d.date, 14)).forEach(d => {
      (d.sideEffects || []).forEach(fx => { fxCount[fx] = (fxCount[fx] || 0) + 1; });
    });
    const top = Object.entries(fxCount).sort((a,b) => b[1] - a[1])[0];
    if (top && top[1] >= 3) {
      out.push({
        id: "side-fx",
        icon: "warn",
        title: "Side effect pattern",
        body: `"${top[0]}" logged ${top[1]} times in last 14 days. Worth tracking timing against dose/time of day.`,
        color: "var(--c-warn)",
        severity: 1,
      });
    }
  }

  out.sort((a,b) => (b.severity || 0) - (a.severity || 0));
  return out;
};

