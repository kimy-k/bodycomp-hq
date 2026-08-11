import {energyFromConfig, SUSTAINABLE_DEFICIT_PCT} from "./bcq-math.js";

/* ═══ INSIGHTS ENGINE ═══
   Pure function: takes all data streams + targets, returns ranked insight array.
   Each insight has a guard clause — degrades gracefully on sparse data. */

export const computeInsights = ({pepHist, macroHist, whoopHist, wellnessHist, measurements, scans, userPeps, TARGETS, whey, goalBf, userConfig}) => {
  /* Per-day whey. whey_scoops is the real count; the legacy boolean only says
     yes/no, so fall back to the standing default for rows written before the
     column existed. Returns null when no whey was taken that day. */
  const wheyOf = d => {
    if (!whey?.enabled) return null;
    const s = d?.whey_scoops != null ? +d.whey_scoops : (d?.whey === false ? 0 : (whey.scoops || 0)); /* numeric: half-scoops supported */
    if (!(s > 0)) return null;
    const per = whey.perScoop || (whey.scoops ? whey.protein / whey.scoops : 0);
    return { protein: per * s, fat: +(s * 0.5).toFixed(1), carbs: s * 2 };
  };
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
        { const w = wheyOf(d); if (w) p += w.protein; }
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
      /* A peptide is "due" on historical day d only if it was actually running then.
         Active/prn count always; starting counts if its start date had passed by d. */
      const dueFor = userPeps.filter(p => {
        const wasLive = p.status === "active"
                     || p.status === "prn"
                     || (p.status === "starting" && p.startDate && p.startDate <= d.date);
        return wasLive && (p.schedule || []).includes(dow);
      });
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

    /* 3b. Muscle loss detection — flag when muscle drops between consecutive scans */
    const prev = scans[scans.length - 2];
    if (last.muscle && prev.muscle) {
      const muscleDelta = +(last.muscle - prev.muscle).toFixed(1);
      const daysBetween = Math.round((new Date(last.date) - new Date(prev.date)) / 86400000);
      if (muscleDelta < -0.3) {
        out.push({
          id: "muscle-loss",
          icon: "warn",
          title: "Muscle loss detected",
          body: `Muscle dropped ${Math.abs(muscleDelta)} kg in ${daysBetween} days (${prev.muscle} → ${last.muscle} kg). Consider: increasing protein, adding resistance training, or reducing deficit. Losing muscle makes your body fat % goal harder to reach.`,
          color: "var(--c-danger)",
          severity: 3,
        });
      } else if (muscleDelta > 0.3) {
        out.push({
          id: "muscle-gain",
          icon: "trending-up",
          title: "Muscle gain",
          body: `Muscle up ${muscleDelta} kg in ${daysBetween} days (${prev.muscle} → ${last.muscle} kg). Good recomp signal — keep it up.`,
          color: "var(--c-success)",
          severity: 0,
        });
      }
    }

    /* 3c. Recomp ratio — fat lost vs lean mass lost over recent scans */
    if (baseline) {
      const fatLost = +(baseline.fatMass - last.fatMass).toFixed(1);
      const leanLost = +(baseline.leanMass - last.leanMass).toFixed(1);
      if (Math.abs(fatLost) > 0.5 || Math.abs(leanLost) > 0.5) {
        const ratio = leanLost > 0.2 && fatLost > 0.2 ? +(fatLost / leanLost).toFixed(1) : null;
        const isGoodRecomp = fatLost > 0 && leanLost <= 0.3;  /* losing fat, keeping/gaining lean */
        const isBadRecomp = leanLost > 0.5 && fatLost < leanLost;  /* losing more lean than fat */
        if (isBadRecomp) {
          out.push({
            id: "recomp-ratio",
            icon: "scale",
            title: "Recomp warning",
            body: `Lost ${leanLost > 0 ? leanLost + "kg lean" : ""} ${fatLost > 0 ? "but only " + fatLost + "kg fat" : "and gained " + Math.abs(fatLost) + "kg fat"} since ${baseline.label}. ${ratio ? `Ratio: ${ratio}:1 (want >3:1).` : ""} Weight is dropping but body composition isn't improving. Deficit may be too aggressive or training insufficient.`,
            color: "var(--c-danger)",
            severity: 3,
          });
        } else if (isGoodRecomp) {
          out.push({
            id: "recomp-ratio",
            icon: "target",
            title: "Good recomp",
            body: `Lost ${fatLost}kg fat while ${leanLost <= 0 ? "gaining " + Math.abs(leanLost) + "kg lean" : "preserving lean mass"} since ${baseline.label}. This is the trajectory to ${goalBf}%.`,
            color: "var(--c-success)",
            severity: 0,
          });
        }
      }
    }

    /* 3d. Protein adequacy check — are you hitting the minimum for muscle preservation? */
    if (macroHist && macroHist.length >= 5 && last.leanMass) {
      const last7Macros = macroHist.filter(d => inLast(d.date, 7));
      if (last7Macros.length >= 3) {
        const avgProtein = Math.round(last7Macros.reduce((s, d) => {
          let p = 0; (d.meals || []).forEach(m => p += (+m.protein || 0));
          { const w = wheyOf(d); if (w) p += w.protein; }
          return s + p;
        }, 0) / last7Macros.length);
        const minProtein = Math.round(last.leanMass * 2.2);  /* 2.2g/kg lean mass minimum for muscle preservation during cut */
        if (avgProtein < minProtein) {
          out.push({
            id: "protein-muscle",
            icon: "warn",
            title: "Protein below muscle-preservation threshold",
            body: `Averaging ${avgProtein}g protein/day. At ${last.leanMass}kg lean mass, minimum is ~${minProtein}g (2.2g/kg lean) to prevent muscle loss during a deficit. Target: ${TARGETS?.protein || minProtein}g.`,
            color: "var(--c-warn)",
            severity: 2,
          });
        }
      }
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

  /* 6. Peptide × Whoop correlations — v2 (smarter metric selection + lag logic).
        Changes from v1:
        - Removed strain (user-controlled, not peptide-affected)
        - Added RHR (lower = better, genuinely influenced by recovery peptides)
        - Bedtime peptides: lag=1 only (next-morning reflects dose effect)
        - Morning peptides: lag=0 only (same-day reading reflects dose)
        - Weekly peptides (reta): 3-day post-dose window
        - Excluded topicals (snap8) — no Whoop signal expected
        - Minimum 7 data points (was 5) to reduce noise
        - Confounder flag when two peptides overlap >80% of days */
  if (whoopHist && whoopHist.length >= 10 && pepHist && pepHist.length >= 7 && userPeps && userPeps.length > 0) {
    const addDay = (dateStr, days) => {
      const d = new Date(dateStr + "T12:00:00");
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const METRICS = [
      {key: "recovery",         label: "recovery",        threshold: 5,   higherBetter: true,  fmt: v => `${Math.round(v)}%`},
      {key: "hrv_ms",           label: "HRV",             threshold: 3,   higherBetter: true,  fmt: v => `${Math.round(v)}ms`},
      {key: "rhr",              label: "resting HR",      threshold: 2,   higherBetter: false, fmt: v => `${Math.round(v)}bpm`},
      {key: "sleep_hours",      label: "sleep",           threshold: 0.3, higherBetter: true,  fmt: v => `${v.toFixed(1)}h`},
      {key: "sleep_efficiency", label: "sleep efficiency",threshold: 3,   higherBetter: true,  fmt: v => `${Math.round(v)}%`},
    ];
    /* Smart lag: bedtime peptides show effect next morning; AM peptides show same-day */
    const BEDTIME_PEPS = new Set(["cjcipa"]);
    const WEEKLY_PEPS = new Set(["reta"]);
    const TOPICAL_PEPS = new Set(["snap8"]);

    const loggedDates = new Set(pepHist.map(d => d.date));
    const findings = [];
    const considered = userPeps.filter(p =>
      (p.status === "active" || p.status === "prn" || p.status === "starting") &&
      !TOPICAL_PEPS.has(p.id)
    );

    /* Build per-peptide date sets for confounder detection */
    const pepDateSets = {};
    for (const pep of considered) {
      pepDateSets[pep.id] = new Set(pepHist.filter(d => (d.checks || {})[pep.id]).map(d => d.date));
    }

    for (const pep of considered) {
      const pepDates = pepDateSets[pep.id];
      if (pepDates.size < 5) continue;

      /* Choose lag strategy based on dosing time */
      const lags = BEDTIME_PEPS.has(pep.id)
        ? [{days: 1, suffix: " (next morning)"}]                /* Bedtime → next-morning only */
        : WEEKLY_PEPS.has(pep.id)
          ? [{days: 0, suffix: ""}, {days: 1, suffix: " (+1d)"}, {days: 2, suffix: " (+2d)"}]  /* Weekly → 3-day window */
          : [{days: 0, suffix: ""}];                             /* Morning/default → same-day only */

      for (const metric of METRICS) {
        for (const lag of lags) {
          const taken = [], rest = [];

          for (const w of whoopHist) {
            const raw = w[metric.key];
            if (raw == null || raw === "") continue;
            const val = Number(raw);
            if (!isFinite(val)) continue;

            const checkDate = lag.days === 0 ? w.date : addDay(w.date, -lag.days);
            if (!loggedDates.has(checkDate)) continue;

            if (pepDates.has(checkDate)) taken.push(val);
            else rest.push(val);
          }

          if (taken.length < 7 || rest.length < 5) continue;

          const meanT = taken.reduce((s, v) => s + v, 0) / taken.length;
          const meanR = rest.reduce((s, v) => s + v, 0) / rest.length;
          const diff = meanT - meanR;
          if (Math.abs(diff) < metric.threshold) continue;

          const preliminary = taken.length < 10 || rest.length < 8;
          const direction = diff > 0;
          const isGood = metric.higherBetter ? direction : !direction;

          /* Detect confounders: other peptides with >80% date overlap */
          const confounders = considered.filter(other => {
            if (other.id === pep.id) return false;
            const otherDates = pepDateSets[other.id];
            if (!otherDates || otherDates.size < 5) return false;
            const overlap = [...pepDates].filter(d => otherDates.has(d)).length;
            return overlap / pepDates.size > 0.8;
          }).map(c => c.name);

          findings.push({
            pep, metric, lag, meanT, meanR, diff,
            nT: taken.length, nR: rest.length,
            preliminary, isGood, confounders,
            score: (Math.abs(diff) / metric.threshold) * Math.log(taken.length + rest.length + 1),
          });
        }
      }
    }

    findings.sort((a, b) => b.score - a.score);
    const seenPepMetric = new Set();
    const topFindings = [];
    for (const f of findings) {
      const key = `${f.pep.id}-${f.metric.key}`;
      if (seenPepMetric.has(key)) continue;
      seenPepMetric.add(key);
      topFindings.push(f);
      if (topFindings.length >= 6) break;
    }
    for (const f of topFindings) {
      const confounderNote = f.confounders.length > 0
        ? ` ⚠ overlaps with ${f.confounders.join(", ")} — can't isolate effect.`
        : "";
      out.push({
        id: `pep-whoop-${f.pep.id}-${f.metric.key}-${f.lag.days}`,
        icon: "vial",
        title: `${f.pep.name} × ${f.metric.label}${f.lag.suffix}`,
        body: `Averages ${f.metric.fmt(f.meanT)} on ${f.pep.name} days (n=${f.nT}) vs ${f.metric.fmt(f.meanR)} on rest days (n=${f.nR}). ${f.isGood ? "Positive signal" : "Worth a closer look"}${f.preliminary ? " · preliminary" : ""}.${confounderNote}`,
        color: f.isGood ? "var(--c-success)" : "var(--c-warn)",
        severity: f.preliminary ? 0 : 1,
      });
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
    /* Katch-McArdle off the latest scan — was Mifflin off a config weight that goes
       stale, which disagreed with the macros page by ~130 kcal. */
    const tdee = energyFromConfig(userConfig, scans && scans.length ? scans[scans.length-1] : null)?.tdee || 0;
    const last7 = macroHist.filter(d => inLast(d.date, 7));
    if (last7.length >= 3 && tdee > 0) {
      const cals = last7.map(d => {
        let c = 0;
        (d.meals || []).forEach(m => c += ((+m.protein || 0) * 4 + (+m.carbs || 0) * 4 + (+m.fat || 0) * 9));
        { const w = wheyOf(d); if (w) c += (w.protein * 4 + w.carbs * 4 + w.fat * 9); }
        return c;
      });
      const avg = Math.round(cals.reduce((a,b) => a+b, 0) / cals.length);
      const def = tdee - avg;
      const pct = Math.round(def / tdee * 100);
      if (Math.abs(pct) >= 5) {
        const sustainable = def > 0 && pct <= SUSTAINABLE_DEFICIT_PCT;
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
      const tdee = energyFromConfig(userConfig, scans && scans.length ? scans[scans.length-1] : null)?.tdee || 0;
      const last14 = macroHist.filter(d => inLast(d.date, 14));
      if (last14.length >= 5 && tdee > 0) {
        const cals = last14.map(d => {
          let c = 0;
          (d.meals || []).forEach(m => c += ((+m.protein || 0) * 4 + (+m.carbs || 0) * 4 + (+m.fat || 0) * 9));
          { const w = wheyOf(d); if (w) c += (w.protein * 4 + w.carbs * 4 + w.fat * 9); }
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

  /* 11. Sleep × next-day recovery (cross-stream)
     Pairs each night's sleep_hours with the FOLLOWING day's recovery to
     quantify the sleep dividend. Uses consecutive-day pairs only. */
  if (whoopHist && whoopHist.length >= 7) {
    const sorted = [...whoopHist].sort((a,b) => a.date.localeCompare(b.date));
    const goodSleepNext = []; const poorSleepNext = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i-1], curr = sorted[i];
      const sh = +prev.sleep_hours;
      if (!sh || curr.recovery == null) continue;
      const dGap = Math.round((new Date(curr.date) - new Date(prev.date)) / 86400000);
      if (dGap !== 1) continue;
      if (sh >= 7) goodSleepNext.push(+curr.recovery);
      else if (sh < 6) poorSleepNext.push(+curr.recovery);
    }
    if (goodSleepNext.length >= 3 && poorSleepNext.length >= 3) {
      const aG = Math.round(goodSleepNext.reduce((a,b) => a+b, 0) / goodSleepNext.length);
      const aP = Math.round(poorSleepNext.reduce((a,b) => a+b, 0) / poorSleepNext.length);
      const diff = aG - aP;
      if (Math.abs(diff) >= 5) {
        out.push({
          id: "sleep-recovery",
          icon: "moon",
          title: "Sleep × recovery",
          body: `Nights with ≥7h sleep → next-day recovery averaged ${aG}% (n=${goodSleepNext.length}). Nights <6h → ${aP}% (n=${poorSleepNext.length}). ${diff > 0 ? "Strong sleep dividend." : "Atypical pattern — investigate."}`,
          color: diff > 0 ? "var(--c-success)" : "var(--c-warn)",
          severity: 1,
        });
      }
    }
  }

  /* 12. Protein hit-rate × fat loss velocity (cross-stream)
     Pairs scan-to-scan windows with the protein adherence DURING that window. */
  if (scans && scans.length >= 2 && macroHist && macroHist.length >= 7 && TARGETS) {
    const last = scans[scans.length - 1];
    let baseline = null;
    for (let i = scans.length - 2; i >= 0; i--) {
      const d = daysAgo(scans[i].date);
      if (d >= 14 && d <= 49) { baseline = scans[i]; break; }
    }
    if (baseline) {
      const between = macroHist.filter(d => d.date > baseline.date && d.date <= last.date);
      if (between.length >= 7) {
        const proteins = between.map(d => {
          let p = 0;
          (d.meals || []).forEach(m => p += (+m.protein || 0));
          { const w = wheyOf(d); if (w) p += w.protein; }
          return p;
        });
        const hitDays = proteins.filter(p => p >= TARGETS.protein).length;
        const hitRate = Math.round(hitDays / proteins.length * 100);
        const fatDelta = +(last.fatPct - baseline.fatPct).toFixed(1);
        const days = Math.round((new Date(last.date) - new Date(baseline.date)) / 86400000);
        if (Math.abs(fatDelta) >= 0.3) {
          const success = fatDelta < 0 && hitRate >= 70;
          out.push({
            id: "protein-fatloss",
            icon: "muscle",
            title: "Protein × fat loss",
            body: `Hit protein on ${hitDays}/${proteins.length} days (${hitRate}%) → body fat ${fatDelta < 0 ? "dropped" : "rose"} ${Math.abs(fatDelta)}% over ${days} days.`,
            color: success ? "var(--c-success)" : fatDelta > 0 ? "var(--c-warn)" : "var(--accent)",
            severity: success ? 0 : 1,
          });
        }
      }
    }
  }

  /* 13. Training balance (recovery × strain mismatch — Whoop's own signal) */
  if (whoopHist && whoopHist.length >= 7) {
    const last14 = whoopHist.filter(d => inLast(d.date, 14) && d.recovery != null && d.strain != null);
    const overtraining = last14.filter(d => +d.recovery < 50 && +d.strain > 12);
    if (last14.length >= 7 && overtraining.length / last14.length >= 0.25) {
      out.push({
        id: "training-balance",
        icon: "warn",
        title: "Training balance",
        body: `${overtraining.length} of last ${last14.length} days had high strain (>12) on low recovery (<50%). Consider easing strain when recovery is red — that's where overtraining starts.`,
        color: "var(--c-warn)",
        severity: 1,
      });
    }
  }

  /* 14. Body sense × Whoop recovery (cross-stream)
     Compares subjective energy rating against objective recovery score. */
  if (wellnessHist && wellnessHist.length >= 5 && whoopHist && whoopHist.length >= 5) {
    const pairs = [];
    for (const w of wellnessHist) {
      if (w.energy == null) continue;
      const obj = whoopHist.find(h => h.date === w.date);
      if (!obj || obj.recovery == null) continue;
      pairs.push({ subj: +w.energy, obj: +obj.recovery });
    }
    if (pairs.length >= 5) {
      let aligned = 0, divergent = 0;
      for (const p of pairs) {
        const sB = p.subj <= 2 ? "L" : p.subj <= 3 ? "M" : "H";
        const oB = p.obj < 34 ? "L" : p.obj < 67 ? "M" : "H";
        if (sB === oB) aligned++;
        else if ((sB === "L" && oB === "H") || (sB === "H" && oB === "L")) divergent++;
      }
      const alignedPct = Math.round(aligned / pairs.length * 100);
      if (alignedPct >= 60) {
        out.push({
          id: "intuition-match",
          icon: "vial",
          title: "Body sense × data",
          body: `Your energy ratings matched Whoop recovery ${aligned} of ${pairs.length} days (${alignedPct}%). Intuition is well-calibrated — trust it.`,
          color: "var(--c-success)",
          severity: 0,
        });
      } else if (divergent >= 2) {
        out.push({
          id: "intuition-gap",
          icon: "warn",
          title: "Body sense × data",
          body: `${divergent} of last ${pairs.length} days you felt strong but Whoop showed low recovery (or vice versa). Body may be masking accumulated strain.`,
          color: "var(--c-warn)",
          severity: 1,
        });
      }
    }
  }

  out.sort((a,b) => (b.severity || 0) - (a.severity || 0));
  return out;
};

