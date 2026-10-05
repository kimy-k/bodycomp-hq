/* ═══ WORKOUTS TAB ═══
   One session per day. Exercises → sets (kg × reps). Every session is
   compared against the previous session of the SAME split, because that is
   the only comparison that means anything for progressive overload.

   Saving a session marks that day "hard" in daily_macros, which bumps the
   macro targets' carbs for the day. Export renders Kim's standard coach
   table as a PNG: title WORKOUT LOG, subtitle "<split> · KSM", reps bold,
   gains green, "—" for unused sets, italic note at the bottom. */
import {useState, useEffect, useMemo, useCallback} from "react";
import {Icon} from "./Icon.jsx";
import {H2} from "./ui.jsx";
import {todayKey} from "./helpers.js";
import {compareSessions, deltaLabel, sessionVolume, DEFAULT_SPLITS, normName} from "./bcq-math.js";

const MAX_SETS = 5;
const emptySet = () => ({w: "", r: ""});
const emptyEx = (name = "") => ({name, sets: [emptySet(), emptySet(), emptySet()]});
const clean = exercises => exercises
  .map(ex => ({name: String(ex.name || "").trim(), sets: (ex.sets || []).map(s => ({w: +s.w || 0, r: +s.r || 0})).filter(s => s.r > 0)}))
  .filter(ex => ex.name && ex.sets.length);

export const Workouts = ({db, userConfig, onToast}) => {
  const [date, setDate] = useState(todayKey());
  const [split, setSplit] = useState("");
  const [exercises, setExercises] = useState([]);
  const [note, setNote] = useState("");
  const [prev, setPrev] = useState(null);
  const [hist, setHist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [customSplit, setCustomSplit] = useState("");

  const splits = useMemo(() => {
    const seen = new Set(DEFAULT_SPLITS.map(normName));
    const extra = [];
    hist.forEach(h => { if (h.split && !seen.has(normName(h.split))) { seen.add(normName(h.split)); extra.push(h.split); } });
    return [...DEFAULT_SPLITS, ...extra];
  }, [hist]);

  /* Load this date's session + history */
  useEffect(() => { (async () => {
    setLoading(true);
    const [row, list] = await Promise.all([db.get("workouts", date), db.list("workouts", 60)]);
    setHist(Array.isArray(list) ? list : []);
    if (row) {
      setSplit(row.split || "");
      setExercises((row.exercises || []).map(ex => ({name: ex.name, sets: [...(ex.sets || []).map(s => ({w: s.w, r: s.r})), ...Array(Math.max(0, 3 - (ex.sets || []).length)).fill(0).map(emptySet)]})));
      setNote(row.note || "");
    } else { setSplit(""); setExercises([]); setNote(""); }
    setDirty(false);
    setLoading(false);
  })(); }, [date, db]);

  /* Previous session of the same split, strictly before this date */
  useEffect(() => { (async () => {
    if (!split) { setPrev(null); return; }
    setPrev(await db.lastWorkoutOfSplit(split, date));
  })(); }, [split, date, db]);

  const cmp = useMemo(() => compareSessions({exercises: clean(exercises)}, prev), [exercises, prev]);
  const cmpBy = useMemo(() => Object.fromEntries(cmp.map(c => [normName(c.name), c])), [cmp]);

  const loadFromPrev = () => {
    if (!prev) return;
    setExercises((prev.exercises || []).map(ex => ({name: ex.name, sets: [...ex.sets.map(s => ({w: s.w, r: ""})), ...Array(Math.max(0, 3 - ex.sets.length)).fill(0).map(emptySet)]})));
    setDirty(true);
  };

  const upEx = (i, patch) => { setExercises(xs => xs.map((e, j) => j === i ? {...e, ...patch} : e)); setDirty(true); };
  const upSet = (i, k, field, v) => { setExercises(xs => xs.map((e, j) => j !== i ? e : {...e, sets: e.sets.map((s, m) => m === k ? {...s, [field]: v} : s)})); setDirty(true); };
  const addSet = i => setExercises(xs => xs.map((e, j) => j === i && e.sets.length < MAX_SETS ? {...e, sets: [...e.sets, emptySet()]} : e));
  const addEx = () => { setExercises(xs => [...xs, emptyEx()]); setDirty(true); };
  const rmEx = i => { setExercises(xs => xs.filter((_, j) => j !== i)); setDirty(true); };
  const moveEx = (i, d) => setExercises(xs => { const j = i + d; if (j < 0 || j >= xs.length) return xs; const c = [...xs]; [c[i], c[j]] = [c[j], c[i]]; return c; });

  const save = async () => {
    const ex = clean(exercises);
    if (!split) { onToast?.("Pick a split first", "error"); return; }
    if (!ex.length) { onToast?.("Add at least one exercise with reps", "error"); return; }
    setSaving(true);
    const ok = await db.upsert("workouts", {date, split, exercises: ex, note: note.trim() || null, updated_at: new Date().toISOString()});
    if (ok) {
      await db.setDayType(date, "hard");     /* a logged session = a hard day for macros */
      setDirty(false);
      onToast?.(`Saved · ${split} · day marked Hard`, "ok");
      const list = await db.list("workouts", 60);
      setHist(Array.isArray(list) ? list : []);
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!confirm("Delete this session?")) return;
    await db.del("workouts", date);
    setSplit(""); setExercises([]); setNote(""); setDirty(false);
    const list = await db.list("workouts", 60); setHist(Array.isArray(list) ? list : []);
  };

  /* ── PNG export in the coach-table format ───────────────────────────── */
  const exportPNG = useCallback(() => {
    const ex = clean(exercises);
    if (!ex.length) return;
    const nSets = Math.min(MAX_SETS, Math.max(3, ...ex.map(e => e.sets.length)));
    const cols = ["Exercise", "Weight", ...Array.from({length: nSets}, (_, i) => `Set ${i + 1}`), "vs. last session"];
    const colW = [230, 90, ...Array(nSets).fill(70), 170];
    const W = colW.reduce((a, b) => a + b, 0) + 48, rowH = 40, headH = 118, footH = note.trim() ? 56 : 28;
    const H = headH + 44 + ex.length * rowH + footH;
    const scale = 2;
    const cv = document.createElement("canvas"); cv.width = W * scale; cv.height = H * scale;
    const c = cv.getContext("2d"); c.scale(scale, scale);
    c.fillStyle = "#0b0b0d"; c.fillRect(0, 0, W, H);
    const f = (w, sz, it = false) => `${it ? "italic " : ""}${w} ${sz}px Inter, ui-sans-serif, system-ui, sans-serif`;
    /* title */
    c.fillStyle = "#f3f4f6"; c.font = f(800, 26); c.textBaseline = "alphabetic";
    c.fillText("WORKOUT LOG", 24, 44);
    c.font = f(500, 13); c.fillStyle = "#9ca3af";
    const dLbl = new Date(date + "T12:00:00").toLocaleDateString("en-US", {weekday: "short", month: "short", day: "numeric", year: "numeric"});
    c.fillText(`${split} · KSM`, 24, 66);
    c.fillText(dLbl, 24, 84);
    c.textAlign = "right"; c.font = f(600, 12); c.fillStyle = "#6b7280";
    c.fillText(`${sessionVolume(ex).toLocaleString()} kg total volume`, W - 24, 44);
    if (prev) c.fillText(`vs ${new Date(prev.date + "T12:00:00").toLocaleDateString("en-US", {month: "short", day: "numeric"})}`, W - 24, 66);
    c.textAlign = "left";
    /* header */
    let y = headH; let x = 24;
    c.fillStyle = "#16171b"; c.fillRect(24, y, W - 48, 36);
    c.font = f(700, 11); c.fillStyle = "#9ca3af";
    cols.forEach((h, i) => { c.textAlign = i === 0 ? "left" : "center"; c.fillText(h.toUpperCase(), i === 0 ? x + 12 : x + colW[i] / 2, y + 23); x += colW[i]; });
    y += 44;
    /* rows */
    ex.forEach((e, r) => {
      x = 24;
      if (r % 2) { c.fillStyle = "#101114"; c.fillRect(24, y - 6, W - 48, rowH); }
      const cm = cmpBy[normName(e.name)];
      const top = e.sets.reduce((b, s) => (!b || s.w > b.w) ? s : b, null);
      c.textAlign = "left"; c.font = f(600, 14); c.fillStyle = "#e5e7eb"; c.fillText(e.name, x + 12, y + 20); x += colW[0];
      c.textAlign = "center"; c.font = f(500, 13); c.fillStyle = "#d1d5db"; c.fillText(top && top.w > 0 ? `${top.w} kg` : "BW", x + colW[1] / 2, y + 20); x += colW[1];
      for (let k = 0; k < nSets; k++) {
        const s = e.sets[k];
        if (s) { c.font = f(800, 15); c.fillStyle = "#f3f4f6"; c.fillText(String(s.r), x + colW[2 + k] / 2, y + 21); }
        else   { c.font = f(400, 14); c.fillStyle = "#4b5563"; c.fillText("—", x + colW[2 + k] / 2, y + 20); }
        x += colW[2 + k];
      }
      const lbl = deltaLabel(cm);
      c.font = f(700, 13);
      c.fillStyle = cm?.verdict === "up" ? "#4ade80" : cm?.verdict === "down" ? "#f87171" : cm?.verdict === "new" ? "#60a5fa" : "#9ca3af";
      c.fillText(lbl, x + colW[colW.length - 1] / 2, y + 20);
      y += rowH;
    });
    if (note.trim()) { c.textAlign = "left"; c.font = f(400, 12, true); c.fillStyle = "#9ca3af"; c.fillText(note.trim(), 24, y + 22); }
    const a = document.createElement("a");
    a.download = `workout-${date}-${split.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.href = cv.toDataURL("image/png"); a.click();
  }, [exercises, split, date, note, prev, cmpBy]);

  /* ── nav helpers ── */
  const todayK = todayKey();
  const isToday = date === todayK;
  const dObj = new Date(date + "T12:00:00");
  const dayLabel = isToday ? "Today" : dObj.toLocaleDateString("en-US", {weekday: "short", month: "short", day: "numeric"});
  const shift = n => { const d = new Date(dObj); d.setDate(d.getDate() + n); const k = d.toISOString().slice(0, 10); if (k <= todayK) setDate(k); };
  const vol = sessionVolume(clean(exercises));
  const prevVol = prev ? sessionVolume(prev.exercises) : null;

  const cellStyle = {width: "100%", background: "var(--elev-2)", border: "1px solid var(--line-soft)", borderRadius: 7, padding: "7px 4px", fontSize: 13, color: "var(--t-1)", textAlign: "center", outline: "none"};
  const vCol = v => v === "up" ? "var(--c-success)" : v === "down" ? "var(--c-danger)" : v === "new" ? "var(--accent)" : "var(--t-4)";

  if (loading) return <div style={{padding: 40, textAlign: "center", color: "var(--t-4)"}}>Loading…</div>;

  return (<>
    {/* date nav */}
    <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12}}>
      <div style={{display: "flex", alignItems: "center", gap: 6}}>
        <button onClick={() => shift(-1)} className="touch" style={{background: "var(--elev-2)", border: "1px solid var(--line-soft)", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0}}><Icon n="chevLeft" s={16} c="var(--t-3)"/></button>
        <div style={{textAlign: "center", minWidth: 90}}>
          <h3 className="serif" style={{fontSize: isToday ? 20 : 16, margin: 0, color: isToday ? "var(--t-1)" : "var(--accent)", fontStyle: "italic", fontWeight: 400}}>{dayLabel}</h3>
        </div>
        <button onClick={() => shift(1)} disabled={isToday} className="touch" style={{background: isToday ? "transparent" : "var(--elev-2)", border: isToday ? "1px solid transparent" : "1px solid var(--line-soft)", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: isToday ? "default" : "pointer", padding: 0, opacity: isToday ? 0.3 : 1}}><Icon n="chevRight" s={16} c="var(--t-3)"/></button>
        {!isToday && <button onClick={() => setDate(todayK)} className="touch" style={{background: "var(--accent-soft)", border: "1px solid var(--accent-line)", borderRadius: 999, padding: "4px 10px", fontSize: 10, fontWeight: 600, color: "var(--accent)", cursor: "pointer", marginLeft: 4}}>Today</button>}
      </div>
      {clean(exercises).length > 0 && <button onClick={exportPNG} className="touch mono" style={{padding: "7px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-soft)", background: "var(--elev-1)", color: "var(--t-2)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 6}}><Icon n="image" s={13}/> PNG</button>}
    </div>

    {/* split */}
    <div style={{display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 10}}>
      {splits.map(s => <button key={s} onClick={() => { setSplit(s); setDirty(true); }} className="touch" style={{flexShrink: 0, padding: "7px 12px", borderRadius: 999, border: `1px solid ${split === s ? "var(--accent-line)" : "var(--line-soft)"}`, background: split === s ? "var(--accent-soft)" : "var(--elev-1)", color: split === s ? "var(--accent)" : "var(--t-3)", fontSize: 12, fontWeight: split === s ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap"}}>{s}</button>)}
      <input value={customSplit} onChange={e => setCustomSplit(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && customSplit.trim()) { setSplit(customSplit.trim()); setCustomSplit(""); setDirty(true); } }} placeholder="custom…" style={{flexShrink: 0, width: 90, ...cellStyle, textAlign: "left", borderRadius: 999, padding: "7px 12px"}}/>
    </div>

    {/* prev-session strip */}
    {split && (
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--elev-1)", borderRadius: "var(--r-sm)", padding: "10px 12px", marginBottom: 12}}>
        <div style={{fontSize: 11.5, color: "var(--t-3)"}}>
          {prev
            ? <>Last <strong style={{color: "var(--t-1)"}}>{split}</strong> · {new Date(prev.date + "T12:00:00").toLocaleDateString("en-US", {month: "short", day: "numeric"})} · <span className="mono">{sessionVolume(prev.exercises).toLocaleString()} kg</span></>
            : <>First logged <strong style={{color: "var(--t-1)"}}>{split}</strong> session</>}
        </div>
        {prev && exercises.length === 0 && <button onClick={loadFromPrev} className="touch mono" style={{padding: "6px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--accent-line)", background: "var(--accent-soft)", color: "var(--accent)", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer"}}>Load last</button>}
      </div>)}

    {/* exercises */}
    {exercises.map((ex, i) => {
      const cm = cmpBy[normName(ex.name)];
      return (
        <div key={i} className="rise" style={{background: "var(--elev-1)", borderRadius: "var(--r-md)", padding: "10px 12px", marginBottom: 8}}>
          <div style={{display: "flex", alignItems: "center", gap: 6, marginBottom: 8}}>
            <input value={ex.name} onChange={e => upEx(i, {name: e.target.value})} placeholder="Exercise" list="ex-names" style={{...cellStyle, textAlign: "left", flex: 1, fontWeight: 600, padding: "7px 10px"}}/>
            {cm && ex.name.trim() && <span className="mono" style={{fontSize: 11, fontWeight: 700, color: vCol(cm.verdict), whiteSpace: "nowrap"}}>{deltaLabel(cm)}</span>}
            <button onClick={() => moveEx(i, -1)} className="touch" style={{background: "none", border: "none", cursor: "pointer", padding: 4, opacity: i === 0 ? .25 : 1}}><Icon n="chevUp" s={14} c="var(--t-4)"/></button>
            <button onClick={() => moveEx(i, 1)} className="touch" style={{background: "none", border: "none", cursor: "pointer", padding: 4, opacity: i === exercises.length - 1 ? .25 : 1}}><Icon n="chevDown" s={14} c="var(--t-4)"/></button>
            <button onClick={() => rmEx(i)} className="touch" style={{background: "none", border: "none", cursor: "pointer", padding: 4}}><Icon n="trash" s={14} c="var(--t-4)"/></button>
          </div>
          <div style={{display: "grid", gridTemplateColumns: `repeat(${ex.sets.length}, 1fr) auto`, gap: 6, alignItems: "end"}}>
            {ex.sets.map((s, k) => {
              const ps = prev && (prev.exercises || []).find(p => normName(p.name) === normName(ex.name))?.sets?.[k];
              return (
                <div key={k}>
                  <div className="mono" style={{fontSize: 8.5, color: "var(--t-5)", textAlign: "center", marginBottom: 3, letterSpacing: ".06em"}}>SET {k + 1}{ps ? <span style={{color: "var(--t-4)"}}> · {ps.w}×{ps.r}</span> : ""}</div>
                  <div style={{display: "flex", gap: 3}}>
                    <input inputMode="decimal" value={s.w} onChange={e => upSet(i, k, "w", e.target.value)} placeholder="kg" style={cellStyle}/>
                    <input inputMode="numeric" value={s.r} onChange={e => upSet(i, k, "r", e.target.value)} placeholder="reps" style={{...cellStyle, fontWeight: 800}}/>
                  </div>
                </div>);
            })}
            {ex.sets.length < MAX_SETS && <button onClick={() => addSet(i)} className="touch" style={{background: "var(--elev-2)", border: "1px solid var(--line-soft)", borderRadius: 7, width: 32, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0}}><Icon n="plus" s={13} c="var(--t-3)"/></button>}
          </div>
        </div>);
    })}
    <datalist id="ex-names">{[...new Set(hist.flatMap(h => (h.exercises || []).map(e => e.name)))].map(n => <option key={n} value={n}/>)}</datalist>

    <button onClick={addEx} className="touch" style={{width: "100%", padding: 11, borderRadius: "var(--r-sm)", border: "1px dashed var(--line)", background: "transparent", color: "var(--t-3)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6}}><Icon n="plus" s={14}/> Add exercise</button>

    <textarea value={note} onChange={e => { setNote(e.target.value); setDirty(true); }} placeholder="Note — how it felt, what to change next time" rows={2} style={{...cellStyle, textAlign: "left", padding: "9px 12px", resize: "vertical", fontFamily: "inherit", marginBottom: 12}}/>

    {/* summary + save */}
    {clean(exercises).length > 0 && (
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 11.5, color: "var(--t-3)"}}>
        <span>Volume <strong className="mono" style={{color: "var(--t-1)"}}>{vol.toLocaleString()}</strong> kg{prevVol != null && <span className="mono" style={{color: vol > prevVol ? "var(--c-success)" : vol < prevVol ? "var(--c-danger)" : "var(--t-4)", marginLeft: 6}}>{vol > prevVol ? "+" : ""}{(vol - prevVol).toLocaleString()}</span>}</span>
        <span className="mono" style={{fontSize: 10}}>{cmp.filter(c => c.verdict === "up").length} up · {cmp.filter(c => c.verdict === "down").length} down · {cmp.filter(c => c.verdict === "new").length} new</span>
      </div>)}
    <div style={{display: "flex", gap: 8, marginBottom: 24}}>
      <button onClick={save} disabled={saving || !dirty} className="touch" style={{flex: 1, padding: 13, borderRadius: "var(--r-sm)", border: "none", background: dirty ? "var(--accent)" : "var(--elev-2)", color: dirty ? "#000" : "var(--t-4)", fontSize: 13, fontWeight: 700, cursor: dirty ? "pointer" : "default"}}>{saving ? "Saving…" : dirty ? "Save session" : "Saved"}</button>
      {hist.some(h => h.date === date) && <button onClick={remove} className="touch" style={{padding: "0 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-soft)", background: "transparent", color: "var(--t-4)", cursor: "pointer"}}><Icon n="trash" s={15}/></button>}
    </div>

    {/* history */}
    <H2 sub="tap to open">Recent sessions</H2>
    {hist.length === 0 && <div style={{textAlign: "center", padding: "32px 0", color: "var(--t-4)", fontSize: 13}}>No sessions yet. Pick a split and add your first exercise.</div>}
    {hist.map(h => {
      const v = sessionVolume(h.exercises);
      return (
        <button key={h.date} onClick={() => setDate(h.date)} className="touch" style={{display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "10px 12px", borderRadius: "var(--r-sm)", border: `1px solid ${h.date === date ? "var(--accent-line)" : "var(--line-soft)"}`, background: h.date === date ? "var(--accent-soft)" : "var(--elev-1)", cursor: "pointer", textAlign: "left", marginBottom: 6}}>
          <div>
            <div style={{fontSize: 12.5, fontWeight: 600, color: "var(--t-1)"}}>{h.split || "—"}</div>
            <div className="mono" style={{fontSize: 10, color: "var(--t-4)", marginTop: 2}}>{new Date(h.date + "T12:00:00").toLocaleDateString("en-US", {weekday: "short", month: "short", day: "numeric"})} · {(h.exercises || []).length} exercises</div>
          </div>
          <div className="mono" style={{fontSize: 12, color: "var(--t-2)", fontWeight: 600}}>{v.toLocaleString()} kg</div>
        </button>);
    })}
  </>);
};
