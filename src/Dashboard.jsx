import { useState, useEffect, useMemo, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine, Legend, Cell } from "recharts";
import {
  enrich,
  daysSinceRecon,
  isPastPGStability as isPastPGStability_pure,
  parseTimeStr,
  dueState as dueState_pure,
  concentration,
  batchStatus as batchStatus_pure,
  currentBatchFor as currentBatchFor_pure,
  mgFromDoseStr,
  inventoryFor as inventoryFor_pure,
} from "./bcq-math.js";
import {SB, SB_KEY, hdr, makeDb} from "./supabase.js";
import {
  PROFILES, SCANS, WHEY, COL, calcCal,
  PEPTIDES, DEFAULT_STACK, AVAILABLE_PEPS, SELLERS,
  PRODUCT_FOR_PEPTIDE, PRICES,
  PG_SLUG_FOR_PEPTIDE, PG_BASE, PG_DIRECTORY, pgUrlFor,
  reorderOptionsFor, RECONSTITUTION, PHARMACOKINETICS, recommendedReconFor,
} from "./data.js";
import {todayKey, localDateKey, addDays, buildProj, calcMonthly, compressImage} from "./helpers.js";
import {computeInsights} from "./insights.js";
import {Icon} from "./Icon.jsx";
import {FONT_URL, STYLE} from "./styles.js";
import {Tip, Card, H2, TabBtn, Insight, cBox, Skel, SkelTab, Toast, Logo} from "./ui.jsx";
import {ensureServiceWorker, subscribePush, unsubscribePush, sendTestPush} from "./push-client.js";
import {Onboarding} from "./Onboarding.jsx";
import {ErrorBoundary} from "./ErrorBoundary.jsx";
import {Settings} from "./Settings.jsx";

/* Helper bridge: isPastPGStability needs the RECONSTITUTION map injected. */
const isPastPGStability = batch => isPastPGStability_pure(batch, RECONSTITUTION[batch?.peptide_id]);

/* ═══ MAIN ═══ */
function DashboardInner(){
  const [tab,setTab]=useState("macros");
  /* Resolve userId in priority order:
     1. ?user= URL parameter — locks device immediately (deep-linking still works)
     2. localStorage bcq-user — chosen previously, persists forever until "Switch user"
     3. null → show "Who are you?" picker, no data loads
     Once a user is chosen via either path, we persist to localStorage AND drop the
     URL parameter so the address bar reads the same on every visit. */
  const urlUser=useMemo(()=>{try{const p=new URLSearchParams(window.location.search);return p.get("user");}catch{return null;}},[]);
  const storedUser=useMemo(()=>{try{return localStorage.getItem("bcq-user");}catch{return null;}},[]);
  const initialUser=urlUser||storedUser||null;
  const [userId,setUserIdRaw]=useState(initialUser);
  const setUserId=useCallback(uid=>{try{localStorage.setItem("bcq-user",uid);if(window.history?.replaceState){const u=new URL(window.location.href);u.searchParams.delete("user");window.history.replaceState({},"",u.toString());}}catch{}setUserIdRaw(uid);},[]);
  useEffect(()=>{if(initialUser&&!storedUser){try{localStorage.setItem("bcq-user",initialUser);}catch{}}},[initialUser,storedUser]);
  const switchUser=useCallback(()=>{if(!window.confirm("Switch to the other user? This is for when you're lending the phone briefly. Your data won't sync to them — they'll see their own."))return;try{localStorage.removeItem("bcq-user");}catch{}window.location.replace(window.location.pathname);},[]);
  const locked=true;  // always locked now — no in-app profile switching
  const [userConfig,setUserConfig]=useState(null);
  const [toast,setToast]=useState(null);
  const showToast=useCallback((msg,type="error")=>{const id=Date.now()+Math.random();setToast({msg,type,id});setTimeout(()=>setToast(t=>t&&t.id===id?null:t),3800);},[]);
  const defaultProfile=userId?(PROFILES[userId]||PROFILES.kim):PROFILES.kim;
  const profile=userConfig?{...defaultProfile,name:userConfig.name||defaultProfile.name,targets:userConfig.targets||defaultProfile.targets}:defaultProfile;
  const db=useMemo(()=>makeDb(userId||"_none_",msg=>showToast(msg,"error")),[userId,showToast]);
  const TARGETS=profile.targets;

  const [onboarded,setOnboarded]=useState(null);
  useEffect(()=>{(async()=>{const ob=await db.getConfig("onboarded");const cfg=await db.getConfig("profile");if(cfg)setUserConfig(cfg);setOnboarded(!!ob);})();},[db]);
  const handleOnboardComplete=(cfg)=>{setUserConfig(cfg);setOnboarded(true);};

  const [dark,setDark]=useState(true);
  useEffect(()=>{(async()=>{const t=await db.getConfig("theme");if(t==="light")setDark(false);})();},[db]);
  useEffect(()=>{document.documentElement.setAttribute("data-theme",dark?"dark":"light");},[dark]);
  const toggleTheme=()=>{const next=!dark;setDark(next);db.setConfig("theme",next?"dark":"light");};

  const [userScans,setUserScans]=useState([]);const [scansLoaded,setScansLoaded]=useState(false);
  const [showAddScan,setShowAddScan]=useState(false);
  const [newScan,setNewScan]=useState({weight:"",muscle:"",fatPct:"",date:todayKey()});
  useEffect(()=>{(async()=>{const rows=await db.list("inbody_scans",50);setUserScans(rows.map(r=>({date:r.date,weight:r.weight,muscle:r.muscle,fatPct:r.fat_pct})));setScansLoaded(true);})();},[db]);
  const saveScans=async(s)=>{setUserScans(s);};
  const addScan=()=>{if(!newScan.weight||!newScan.fatPct)return;const s={date:newScan.date,weight:+newScan.weight,muscle:+(newScan.muscle||0),fatPct:+newScan.fatPct};setUserScans([...userScans,s]);db.upsert("inbody_scans",{date:s.date,weight:s.weight,muscle:s.muscle,fat_pct:s.fatPct});setNewScan({weight:"",muscle:"",fatPct:"",date:todayKey()});setShowAddScan(false);};
  const removeUserScan=(date)=>{setUserScans(userScans.filter(s=>s.date!==date));db.del("inbody_scans",date);};

  const baseScans=profile.showScans?SCANS:[];
  const allScans=useMemo(()=>{const combined=[...baseScans,...userScans];combined.sort((a,b)=>a.date.localeCompare(b.date));return combined;},[userScans,userId]);
  const data=useMemo(()=>allScans.map(enrich),[allScans]);
  const monthly=useMemo(()=>calcMonthly(data),[data]);
  const first=data[0]||{fatPct:40,weight:60,muscle:18,fatMass:24,leanMass:36};
  const last=data.length>0?data[data.length-1]:first;
  const best=data.length>0?data.reduce((a,b)=>b.fatPct<a.fatPct?b:a):first;
  const goalPct=userConfig?.goalBf||30;
  const fatToLose=data.length>0?+(last.fatMass-(last.leanMass/(1-goalPct/100))*goalPct/100).toFixed(1):0;
  const pctDone=(()=>{if(data.length===0)return 0;const denom=first.fatPct-goalPct;if(!denom||denom<=0)return 100;const v=+(((first.fatPct-last.fatPct)/denom)*100).toFixed(0);return Math.max(0,Math.min(100,isFinite(v)?v:0));})();
  const {scenarios,projections}=useMemo(()=>buildProj(last),[last]);
  /* Find the first month each scenario's projected body fat drops to/below the user's goal */
  const etaMonths=scenarios.map(s=>{const h=projections.find(p=>p[s.name]<=goalPct);return{...s,months:h?h.month:">12"};});

  /* ═══ MACRO STATE ═══ */
  const MEAL_TAGS=["Lunch","Snack","Dinner","Breakfast","Other"];
  const [meals,setMeals]=useState([]);const [wheyOn,setWheyOn]=useState(true);const [macroSub,setMacroSub]=useState("log");const [mLoading,setMLoading]=useState(true);const [histDays,setHistDays]=useState([]);const [adding,setAdding]=useState(false);const [newMeal,setNewMeal]=useState({name:"",protein:"",fat:"",carbs:"",tag:"Lunch"});
  const [favs,setFavs]=useState([]);const [showFavs,setShowFavs]=useState(false);
  const [editId,setEditId]=useState(null);const [editMeal,setEditMeal]=useState({name:"",protein:"",fat:"",carbs:"",tag:""});
  const day=todayKey();
  /* Whey config derived from userConfig (Settings). Sensible defaults match the original constant (25g protein/scoop × 2 scoops). */
  const whey=useMemo(()=>{const perScoop=+(userConfig?.wheyProtein||25);const scoops=+(userConfig?.wheyScoops||2);return{protein:perScoop*scoops,fat:+(scoops*0.5).toFixed(1),carbs:scoops*2,scoops,perScoop,enabled:perScoop>0&&scoops>0,label:scoops>0?`Whey · ${scoops} scoop${scoops!==1?"s":""}`:"Whey"};},[userConfig]);

  /* P18: macroDate lets the user back-edit a past day's macros. Defaults to today.
     Changing this re-runs the load effect below and reroutes saves to that date. */
  const [macroDate,setMacroDate]=useState(todayKey());
  /* Reset macroDate to today whenever user re-enters Macros tab — avoids confusion if they previously back-edited */
  useEffect(()=>{if(tab==="macros")setMacroDate(todayKey());},[tab]);

  useEffect(()=>{setMeals([]);setWheyOn(true);setMLoading(true);(async()=>{
    const row=await db.get("daily_macros",macroDate);
    if(row){setMeals(row.meals||[]);setWheyOn(row.whey!==false);}
    const cfg=await db.getConfig("favs");
    if(cfg)setFavs(cfg);
    setMLoading(false);
  })();},[macroDate,db]);

  const saveMacro=useCallback((m,w)=>{
    setMeals(m);setWheyOn(w);
    db.upsert("daily_macros",{date:macroDate,meals:m,whey:w});
  },[macroDate]);

  const saveFavs=async(f)=>{setFavs(f);db.setConfig("favs",f);};

  useEffect(()=>{if(macroSub!=="history"||tab!=="macros")return;(async()=>{
    const rows=await db.list("daily_macros",14);
    const res=rows.map(md=>{let t={cal:0,protein:0,fat:0,carbs:0};(md.meals||[]).forEach(m=>{t.protein+=m.protein||0;t.fat+=m.fat||0;t.carbs+=m.carbs||0;});t.cal=calcCal(t.protein,t.fat,t.carbs);if(md.whey!==false&&whey.enabled){t.protein+=whey.protein;t.fat+=whey.fat;t.carbs+=whey.carbs;t.cal+=calcCal(whey.protein,whey.fat,whey.carbs);}return{date:md.date,...t};});
    setHistDays(res);
  })();},[macroSub,tab]);
  const totals=useMemo(()=>{let t={protein:0,fat:0,carbs:0};meals.forEach(m=>{t.protein+=m.protein||0;t.fat+=m.fat||0;t.carbs+=m.carbs||0;});if(wheyOn&&whey.enabled){t.protein+=whey.protein;t.fat+=whey.fat;t.carbs+=whey.carbs;}t.cal=calcCal(t.protein,t.fat,t.carbs);return t;},[meals,wheyOn,whey]);
  const rem={cal:TARGETS.cal-totals.cal,protein:TARGETS.protein-totals.protein};
  const weekAvgProtein=useMemo(()=>{if(histDays.length===0)return null;const recent=histDays.slice(0,7);return Math.round(recent.reduce((s,d)=>s+d.protein,0)/recent.length);},[histDays]);
  const addMeal=()=>{if(!newMeal.name)return;const m={name:newMeal.name,protein:+(newMeal.protein||0),fat:+(newMeal.fat||0),carbs:+(newMeal.carbs||0),tag:newMeal.tag||"Other",id:Date.now()};saveMacro([...meals,m],wheyOn);setNewMeal({name:"",protein:"",fat:"",carbs:"",tag:"Lunch"});setAdding(false);};
  const removeMeal=id=>saveMacro(meals.filter(m=>m.id!==id),wheyOn);
  const toggleWhey=()=>saveMacro(meals,!wheyOn);
  const addFav=(m)=>{if(!favs.find(f=>f.name===m.name))saveFavs([...favs,{name:m.name,protein:m.protein,fat:m.fat,carbs:m.carbs,tag:m.tag||"Other"}]);};
  const removeFav=(name)=>saveFavs(favs.filter(f=>f.name!==name));
  const addFromFav=(f)=>{saveMacro([...meals,{...f,id:Date.now()}],wheyOn);setShowFavs(false);};
  const startEdit=(m)=>{setEditId(m.id);setEditMeal({name:m.name,protein:m.protein,fat:m.fat,carbs:m.carbs,tag:m.tag||"Other"});};
  const saveEdit=()=>{saveMacro(meals.map(m=>m.id===editId?{...m,name:editMeal.name,protein:+(editMeal.protein||0),fat:+(editMeal.fat||0),carbs:+(editMeal.carbs||0),tag:editMeal.tag}:m),wheyOn);setEditId(null);};

  /* ═══ PEPTIDE STATE ═══ */
  const SIDE_FX = ["headache","insomnia","nightmare","nausea","flush","stinging","fatigue","hunger","jitter"];
  const [pepData,setPepData]=useState({checks:{},sideEffects:[]});
  const [pepLoading,setPepLoading]=useState(true);
  const [pepHist,setPepHist]=useState([]);const [pepSub,setPepSub]=useState("today");
  const [showOther,setShowOther]=useState(false);
  const [editingDose,setEditingDose]=useState(null);const [doseVal,setDoseVal]=useState("");

  useEffect(()=>{setPepData({checks:{},sideEffects:[]});setPepLoading(true);(async()=>{
    const row=await db.get("daily_peptides",day);
    if(row){setPepData({checks:row.checks||{},sideEffects:row.side_effects||[]});}
    setPepLoading(false);
  })();},[day,db]);

  const savePep=useCallback((nd)=>{setPepData(nd);db.upsert("daily_peptides",{date:day,checks:nd.checks,side_effects:nd.sideEffects});},[day]);

  const togglePep=(id,defaultDose)=>{const nc={...pepData.checks};if(nc[id]){delete nc[id];}else{nc[id]={time:new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}),dose:defaultDose||""};}savePep({...pepData,checks:nc});};
  const updateDose=(id,dose)=>{const nc={...pepData.checks};if(nc[id])nc[id]={...nc[id],dose};savePep({...pepData,checks:nc});};
  const toggleSideFx=(fx)=>{const sf=[...pepData.sideEffects];const i=sf.indexOf(fx);if(i>=0)sf.splice(i,1);else sf.push(fx);savePep({...pepData,sideEffects:sf});};

  useEffect(()=>{if(tab!=="peptides")return;(async()=>{
    const rows=await db.list("daily_peptides",21);
    setPepHist(rows.map(r=>({date:r.date,checks:r.checks||{},sideEffects:r.side_effects||[]})));
  })();},[tab]);

  /* ═══ P17: WELLNESS DAILY LOG ═══
     Subjective markers — complements Whoop's objective data. One row per (user,date)
     in daily_wellness table. mood/energy/sleep_quality are 1-5; notes is free text.
     Tap a button to save instantly (no submit). */
  const [wellness,setWellness]=useState({mood:null,energy:null,sleep_quality:null,notes:""});
  const [wellnessLoading,setWellnessLoading]=useState(true);
  const [wellnessHist,setWellnessHist]=useState([]);
  useEffect(()=>{setWellnessLoading(true);(async()=>{
    const row=await db.getWellness(day);
    setWellness({mood:row?.mood??null,energy:row?.energy??null,sleep_quality:row?.sleep_quality??null,notes:row?.notes||""});
    const hist=await db.listWellness(14);
    setWellnessHist(hist||[]);
    setWellnessLoading(false);
  })();},[day,db]);
  const saveWellness=useCallback(async(patch)=>{
    const merged={...wellness,...patch};
    setWellness(merged);  /* optimistic */
    const saved=await db.upsertWellness(day,patch);
    /* Refresh hist so the sparkline updates */
    if(saved){
      const hist=await db.listWellness(14);
      setWellnessHist(hist||[]);
    }
  },[wellness,db,day]);

  const todayDow=new Date().getDay();

  /* ═══ PEPTIDE STACK (P10) — per-user editable peptide list, sourced from DB ═══
     The catalog (PEPTIDES) defines what peptides exist. The stack table holds
     which ones each user is taking and their dose/schedule/timing/status. On first
     boot for a user, we backfill from DEFAULT_STACK + any legacy peptide_overrides. */
  const [peptideStack,setPeptideStack]=useState([]);
  const [stackLoading,setStackLoading]=useState(true);
  useEffect(()=>{
    if(!db||!userId)return;
    (async()=>{
      setStackLoading(true);
      let stack=await db.getStack();
      if(stack.length===0){
        /* First boot for this user — seed from DEFAULT_STACK + any legacy overrides */
        const legacyOverrides=userConfig?.peptide_overrides||{};
        const legacyPepIds=userConfig?.peptides;
        const userHasLegacyToggle=Array.isArray(legacyPepIds)&&legacyPepIds.length>0;
        const seedRows=Object.entries(DEFAULT_STACK)
          .filter(([id,d])=>{
            if(d.users&&!d.users.includes(userId))return false;
            if(userHasLegacyToggle)return legacyPepIds.includes(id);
            return true;
          })
          .map(([id,d])=>{
            const o=legacyOverrides[id]||{};
            /* legacy overrides used camelCase startDate/totalWeeks/cycleEnd; map them */
            return {
              peptide_id:id,
              enabled:true,
              dose:o.dose??d.dose,
              schedule:o.schedule??d.schedule,
              time:o.time??d.time,
              status:o.status??d.status,
              start_date:o.startDate??d.start_date??null,
              total_weeks:o.totalWeeks??d.total_weeks??null,
              cycle_end:o.cycleEnd??d.cycle_end??null,
              note:o.note??d.note??null,
            };
          });
        if(seedRows.length>0){
          await db.bulkInsertStack(seedRows);
          /* Clear legacy keys so they don't re-seed if user clears stack later */
          if(userConfig?.peptide_overrides){await db.setConfig("peptide_overrides",null);}
          stack=await db.getStack();
        }
      }
      setPeptideStack(stack);
      setStackLoading(false);
    })();
  },[db,userId]); // userConfig intentionally excluded to avoid re-seeding on every config change

  /* Merge catalog + stack to get user's effective peptide list. Stack rows are the
     source of truth for runtime state; catalog provides name/color/purpose. */
  const userPeps=useMemo(()=>{
    const cat=Object.fromEntries(PEPTIDES.map(p=>[p.id,p]));
    return peptideStack
      .filter(s=>s.enabled)
      .map(s=>{
        const c=cat[s.peptide_id];
        if(!c)return null; /* peptide removed from catalog — skip */
        return {
          ...c,
          dose:s.dose||"",
          schedule:Array.isArray(s.schedule)?s.schedule:[],
          time:s.time||"",
          status:s.status||"active",
          startDate:s.start_date,
          totalWeeks:s.total_weeks,
          cycleEnd:s.cycle_end,
          note:s.note,
          _stackId:s.id, /* opaque ref for editing */
        };
      })
      .filter(Boolean);
  },[peptideStack]);

  const duePeptides=userPeps.filter(p=>(p.status==="active"||p.status==="prn")&&p.schedule.includes(todayDow));
  const notDue=userPeps.filter(p=>!duePeptides.includes(p));
  const checkedCount=duePeptides.filter(p=>pepData.checks[p.id]).length;

  /* ═══ P18: BACKDATED DOSE EDITING ═══
     When the user taps a cell in the "Last 7 days" grid, this state opens a
     small modal letting them log/edit/remove a dose for ANY past date. The 30-day
     cap is enforced in the click handler. Placed AFTER peptideStack is declared
     so the load effect can reference it for default-dose lookup. */
  const [editPastDose,setEditPastDose]=useState(null);  // {peptideId, date} | null
  const [editPastForm,setEditPastForm]=useState({time:"",dose:"",loading:false,exists:false});
  /* When the modal opens, fetch existing data (if any) and preload form */
  useEffect(()=>{
    if(!editPastDose){setEditPastForm({time:"",dose:"",loading:false,exists:false});return;}
    const {peptideId,date}=editPastDose;
    /* Find the peptide's default dose from this user's stack */
    const stackEntry=peptideStack.find(s=>s.peptide_id===peptideId&&s.enabled);
    const fallbackDose=stackEntry?.dose||"";
    setEditPastForm({time:new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}),dose:fallbackDose,loading:true,exists:false});
    (async()=>{
      const row=await db.get("daily_peptides",date);
      const existing=row?.checks?.[peptideId];
      if(existing){
        setEditPastForm({time:existing.time||"",dose:existing.dose||fallbackDose,loading:false,exists:true});
      }else{
        setEditPastForm(f=>({...f,loading:false}));
      }
    })();
  },[editPastDose,db,peptideStack]);
  const editPastDoseSave=useCallback(async(time,dose)=>{
    if(!editPastDose)return;
    const {peptideId,date}=editPastDose;
    /* Fetch current row to merge, since upsert replaces the whole record */
    const row=await db.get("daily_peptides",date);
    const checks={...((row&&row.checks)||{})};
    checks[peptideId]={time:time||new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}),dose:dose||""};
    const sideFx=(row&&row.side_effects)||[];
    await db.upsert("daily_peptides",{date,checks,side_effects:sideFx});
    /* Refresh views: pepHist (for grid/history), and if this was today, pepData */
    const rows=await db.list("daily_peptides",21);
    setPepHist(rows.map(r=>({date:r.date,checks:r.checks||{},sideEffects:r.side_effects||[]})));
    if(date===day)setPepData({checks,sideEffects:sideFx});
    setEditPastDose(null);
    showToast(`Logged ${peptideId} for ${date===day?"today":date}`,"success");
  },[editPastDose,db,day,showToast]);
  const editPastDoseRemove=useCallback(async()=>{
    if(!editPastDose)return;
    const {peptideId,date}=editPastDose;
    const row=await db.get("daily_peptides",date);
    if(!row||!row.checks||!row.checks[peptideId]){setEditPastDose(null);return;}
    const checks={...row.checks};delete checks[peptideId];
    await db.upsert("daily_peptides",{date,checks,side_effects:row.side_effects||[]});
    const rows=await db.list("daily_peptides",21);
    setPepHist(rows.map(r=>({date:r.date,checks:r.checks||{},sideEffects:r.side_effects||[]})));
    if(date===day)setPepData({checks,sideEffects:row.side_effects||[]});
    setEditPastDose(null);
    showToast(`Removed ${peptideId} from ${date}`,"success");
  },[editPastDose,db,day,showToast]);

  /* ═══ REORDER SHEET — opens when user taps "Reorder" on a low-supply peptide ═══ */
  const [reorderModal,setReorderModal]=useState(null);
  /* ═══ RECONSTITUTION GUIDE — opens when user taps "Recon" on a peptide card ═══ */
  const [reconGuide,setReconGuide]=useState(null);
  /* ═══ EDIT PEPTIDE SHEET — opens when user taps the edit icon on a Stack card ═══ */
  const [editPepModal,setEditPepModal]=useState(null);
  /* Save edits to peptide_stack via upsert, then refresh local state */
  const savePepOverride=useCallback(async(pepId,patch)=>{
    /* Map camelCase form fields to snake_case DB columns */
    const dbPatch={};
    if(patch.dose!==undefined)dbPatch.dose=patch.dose;
    if(patch.schedule!==undefined)dbPatch.schedule=patch.schedule;
    if(patch.time!==undefined)dbPatch.time=patch.time;
    if(patch.status!==undefined)dbPatch.status=patch.status;
    if(patch.startDate!==undefined)dbPatch.start_date=patch.startDate||null;
    if(patch.totalWeeks!==undefined)dbPatch.total_weeks=patch.totalWeeks||null;
    if(patch.cycleEnd!==undefined)dbPatch.cycle_end=patch.cycleEnd||null;
    if(patch.note!==undefined)dbPatch.note=patch.note;
    if(patch.enabled!==undefined)dbPatch.enabled=patch.enabled;
    const row=await db.upsertStackEntry(pepId,dbPatch);
    if(row){
      setPeptideStack(prev=>{
        const i=prev.findIndex(r=>r.peptide_id===pepId);
        return i>=0?prev.map(r=>r.peptide_id===pepId?row:r):[...prev,row];
      });
      showToast("Peptide updated","success");
      setEditPepModal(null);
    }else{showToast("Couldn't save changes","error");}
  },[db,showToast]);
  const resetPepOverride=useCallback(async(pepId)=>{
    if(!window.confirm("Reset this peptide back to its built-in defaults? Your edits will be lost."))return;
    const d=DEFAULT_STACK[pepId];
    if(!d){showToast("No defaults for this peptide","error");return;}
    const row=await db.upsertStackEntry(pepId,{
      dose:d.dose,schedule:d.schedule,time:d.time,status:d.status,
      start_date:d.start_date??null,total_weeks:d.total_weeks??null,
      cycle_end:d.cycle_end??null,note:d.note??null,enabled:true,
    });
    if(row){
      setPeptideStack(prev=>prev.map(r=>r.peptide_id===pepId?row:r));
      showToast("Reset to defaults","success");
      setEditPepModal(null);
    }
  },[db,showToast]);

  /* ═══ NOTIFICATIONS — foreground reminders for overdue peptides ═══ */
  const [notifEnabled,setNotifEnabled]=useState(false);
  const [notifPerm,setNotifPerm]=useState(typeof Notification!=="undefined"?Notification.permission:"unsupported");
  useEffect(()=>{(async()=>{const n=await db.getConfig("notifEnabled");if(n===true||n==="true")setNotifEnabled(true);})();},[db]);
  /* Register service worker on app boot so push delivery can work even when the app is closed */
  useEffect(()=>{ensureServiceWorker().catch(()=>{});},[]);
  const requestNotifPermission=useCallback(async()=>{
    if(typeof Notification==="undefined"){showToast("This browser doesn't support notifications","error");return;}
    try{
      const result=await Notification.requestPermission();
      setNotifPerm(result);
      if(result!=="granted"){showToast("Notifications blocked — enable in browser settings","error");return;}
      /* Try to subscribe to push for background delivery. Falls back gracefully if not supported. */
      try{
        await subscribePush(userId);
        setNotifEnabled(true);
        db.setConfig("notifEnabled",true);
        showToast("Reminders on · push enabled","success");
      }catch(e){
        /* Push failed (iOS not installed, no service worker, etc.) but in-page notifications still work */
        setNotifEnabled(true);
        db.setConfig("notifEnabled",true);
        const msg=String(e?.message||e);
        if(msg.includes("ios-requires-install")){
          showToast("Reminders on. For background alerts, install to home screen first.","success");
        }else{
          showToast("Reminders on (foreground only)","success");
        }
      }
    }catch{showToast("Couldn't request permission","error");}
  },[db,showToast,userId]);
  const disableNotifs=useCallback(async()=>{
    setNotifEnabled(false);
    db.setConfig("notifEnabled",false);
    try{await unsubscribePush();}catch{}
    showToast("Notifications off","success");
  },[db,showToast]);
  /* Poll every 2 minutes for overdue peptides; fire one notif per peptide per day. */
  useEffect(()=>{
    if(!notifEnabled||notifPerm!=="granted")return;
    const firedKey=`bcq-fired-${userId}-${todayKey()}`;
    const check=()=>{
      if(document.visibilityState!=="visible")return;
      let fired=[];try{fired=JSON.parse(sessionStorage.getItem(firedKey)||"[]");}catch{}
      duePeptides.forEach(p=>{
        const checked=!!pepData.checks[p.id];
        const ds=dueState(p,checked);
        if(ds?.overdue&&!fired.includes(p.id)){
          try{new Notification(`${p.name} — overdue`,{body:`${p.dose} · ${ds.label}`,icon:"/icon-192.png",tag:`bcq-${p.id}`});}catch{}
          fired.push(p.id);
          sessionStorage.setItem(firedKey,JSON.stringify(fired));
        }
      });
    };
    check();
    const id=setInterval(check,120000);
    const onVis=()=>{if(document.visibilityState==="visible")check();};
    document.addEventListener("visibilitychange",onVis);
    return()=>{clearInterval(id);document.removeEventListener("visibilitychange",onVis);};
  },[notifEnabled,notifPerm,duePeptides,pepData.checks,userId]);

  /* ═══ DATA EXPORT — full Supabase dump as JSON download ═══ */
  const [exporting,setExporting]=useState(false);
  const exportData=useCallback(async()=>{
    setExporting(true);
    try{
      const tables=["inbody_scans","daily_macros","daily_peptides","daily_whoop","body_measurements","progress_photos"];
      const result={user:userId,exported_at:new Date().toISOString(),tables:{}};
      for(const t of tables){const rows=await db.list(t,5000);result.tables[t]=rows||[];}
      const bRes=await db.listShared("peptide_batches",5000,"date_recon");
      result.tables.peptide_batches=bRes||[];
      result.tables.peptide_batches_note="Shared household resource — both profiles see this set";
      const cfgRows=await fetch(`${SB}/config?user_id=eq.${userId}&select=*`,{headers:hdr}).then(r=>r.ok?r.json():[]).catch(()=>[]);
      result.config=cfgRows||[];
      const blob=new Blob([JSON.stringify(result,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;a.download=`bodycomp-hq-${userId}-${todayKey()}.json`;
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      showToast("Data exported","success");
    }catch{showToast("Export failed","error");}
    setExporting(false);
  },[userId,db,showToast]);

  /* ═══ INSIGHTS DATA — loaded when Body tab opens ═══ */
  const [insightsData,setInsightsData]=useState({pepHist:[],macroHist:[],whoopHist:[],meas:[]});
  const [insightsLoaded,setInsightsLoaded]=useState(false);
  useEffect(()=>{if(tab!=="overview")return;(async()=>{const [pH,mH,wH,mE]=await Promise.all([db.list("daily_peptides",21),db.list("daily_macros",21),db.list("daily_whoop",21),db.list("body_measurements",30)]);setInsightsData({pepHist:pH||[],macroHist:mH||[],whoopHist:wH||[],meas:mE||[]});setInsightsLoaded(true);})();},[tab,day,db]);

  const insights=useMemo(()=>{if(!insightsLoaded)return[];return computeInsights({pepHist:insightsData.pepHist,macroHist:insightsData.macroHist,whoopHist:insightsData.whoopHist,measurements:insightsData.meas,scans:data,userPeps,TARGETS,whey,goalBf:goalPct,userConfig});},[insightsLoaded,insightsData,data,userPeps,TARGETS,whey,goalPct,userConfig]);

  const streak=useMemo(()=>{let s=0;const sorted=[...pepHist].sort((a,b)=>b.date.localeCompare(a.date));for(const d of sorted){const chks=d.checks||{};const ids=typeof Object.values(chks)[0]==="string"?Object.keys(chks):Object.keys(chks);if(ids.length>0)s++;else break;}return s;},[pepHist]);

  const prev=data.length>=2?data[data.length-2]:null;
  const deltaFat=prev?+(last.fatPct-prev.fatPct).toFixed(1):null;
  const deltaMuscle=prev?+(last.muscle-prev.muscle).toFixed(1):null;
  const deltaWeight=prev?+(last.weight-prev.weight).toFixed(1):null;

  const [whoopData,setWhoopData]=useState(null);const [whoopLoading,setWhoopLoading]=useState(true);const [whoopHist,setWhoopHist]=useState([]);
  const [showPlan,setShowPlan]=useState(false);
  useEffect(()=>{setWhoopData(null);setWhoopLoading(true);(async()=>{const row=await db.get("daily_whoop",day);if(row)setWhoopData({recovery:row.recovery,sleep:row.sleep,strain:row.strain,hrv_ms:row.hrv_ms,rhr:row.rhr,sleep_hours:row.sleep_hours,sleep_efficiency:row.sleep_efficiency,source:row.source});const hist=await db.list("daily_whoop",14);setWhoopHist(hist.map(r=>({date:r.date,recovery:r.recovery,sleep:r.sleep,strain:r.strain,hrv_ms:r.hrv_ms,rhr:r.rhr})));setWhoopLoading(false);})();},[day,db]);
  const saveWhoop=async(d)=>{setWhoopData(d);db.upsert("daily_whoop",{date:day,source:"manual",...d});};
  const [whoopInput,setWhoopInput]=useState({recovery:"",sleep:"",strain:""});

  /* ═══ P14: WHOOP OAUTH ═══
     whoopConn = row from whoop_tokens (null if not connected).
     - "Connect" → builds Whoop auth URL with state="{user_id}.{nonce}", redirects.
     - "Sync now" → POSTs to /api/whoop/sync, which refreshes tokens if needed & fills daily_whoop.
     - "Disconnect" → deletes the whoop_tokens row.
     After Whoop redirects back, the URL has ?whoop=connected → auto-sync once. */
  const WHOOP_CLIENT_ID="f88aeb97-f469-43fa-9523-14bbf8fc0e6f";
  const WHOOP_AUTH_URL="https://api.prod.whoop.com/oauth/oauth2/auth";
  const WHOOP_REDIRECT="https://bodycomp-hq.vercel.app/api/whoop/callback";
  const WHOOP_SCOPES="offline read:profile read:recovery read:sleep read:cycles";
  const [whoopConn,setWhoopConn]=useState(null);
  const [whoopConnLoading,setWhoopConnLoading]=useState(true);
  const [whoopSyncing,setWhoopSyncing]=useState(false);
  const [whoopSyncMsg,setWhoopSyncMsg]=useState(null);
  const loadWhoopConn=useCallback(async()=>{setWhoopConnLoading(true);const c=await db.getWhoopConnection();setWhoopConn(c);setWhoopConnLoading(false);return c;},[db]);
  useEffect(()=>{loadWhoopConn();},[loadWhoopConn]);
  const connectWhoop=useCallback(()=>{
    /* Whoop requires state ≥8 chars; pack user_id so callback knows which BCQ user. */
    const nonce=Math.random().toString(36).slice(2,12);
    const state=`${userId}.${nonce}`;
    sessionStorage.setItem("bcq.whoop.state",state);
    const url=`${WHOOP_AUTH_URL}?response_type=code&client_id=${WHOOP_CLIENT_ID}&redirect_uri=${encodeURIComponent(WHOOP_REDIRECT)}&scope=${encodeURIComponent(WHOOP_SCOPES)}&state=${state}`;
    window.location.href=url;
  },[userId]);
  const syncWhoop=useCallback(async()=>{
    if(whoopSyncing)return;
    setWhoopSyncing(true);setWhoopSyncMsg(null);
    const result=await db.syncWhoop();
    setWhoopSyncing(false);
    if(result.ok){
      setWhoopSyncMsg(`✓ synced ${result.synced} day${result.synced!==1?"s":""}`);
      await loadWhoopConn();
      const row=await db.get("daily_whoop",day);if(row)setWhoopData({recovery:row.recovery,sleep:row.sleep,strain:row.strain,hrv_ms:row.hrv_ms,rhr:row.rhr,sleep_hours:row.sleep_hours,sleep_efficiency:row.sleep_efficiency,source:row.source});
      const hist=await db.list("daily_whoop",14);setWhoopHist(hist.map(r=>({date:r.date,recovery:r.recovery,sleep:r.sleep,strain:r.strain,hrv_ms:r.hrv_ms,rhr:r.rhr})));
    } else {
      setWhoopSyncMsg(`✗ ${result.error||"sync failed"}`);
    }
    setTimeout(()=>setWhoopSyncMsg(null),5000);
  },[db,day,whoopSyncing,loadWhoopConn]);
  const disconnectWhoop=useCallback(async()=>{
    if(!confirm("Disconnect Whoop? Existing data stays, but no future syncs."))return;
    await db.disconnectWhoop();
    await loadWhoopConn();
  },[db,loadWhoopConn]);
  /* On mount: check if we just returned from Whoop OAuth → auto-sync once */
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get("whoop")==="connected"){
      const url=new URL(window.location.href);url.searchParams.delete("whoop");
      window.history.replaceState({},"",url.toString());
      setTimeout(()=>{loadWhoopConn().then(c=>{if(c)syncWhoop();});},500);
    } else if(params.get("whoop")==="error"){
      setWhoopSyncMsg(`✗ Whoop: ${params.get("msg")||"connection failed"}`);
      const url=new URL(window.location.href);url.searchParams.delete("whoop");url.searchParams.delete("msg");
      window.history.replaceState({},"",url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const navItems=[{id:"macros",icon:"macros",label:"Macros"},profile.showPeptides&&{id:"peptides",icon:"peps",label:"Peps"},{id:"overview",icon:"body",label:"Body"},{id:"whoop",icon:"whoop",label:"Whoop"},{id:"more",icon:"more",label:"More"}].filter(Boolean);
  const [showMore,setShowMore]=useState(false);
  const [showSettings,setShowSettings]=useState(false);

  /* ═══ DATA TAB SUBTABS — scans / measurements / photos ═══ */
  const [dataSub,setDataSub]=useState("scans");

  /* ═══ MEASUREMENTS STATE ═══ */
  const M_FIELDS=[{k:"waist",l:"Waist",c:"var(--c-bodyfat)"},{k:"hips",l:"Hips",c:"var(--c-cal)"},{k:"chest",l:"Chest",c:"var(--c-muscle)"},{k:"neck",l:"Neck",c:"var(--c-fat)"},{k:"arms",l:"Arms",c:"var(--c-protein)"},{k:"thighs",l:"Thighs",c:"var(--c-carbs)"}];
  const [measurements,setMeasurements]=useState([]);
  const [measLoading,setMeasLoading]=useState(false);
  const [addingMeas,setAddingMeas]=useState(false);
  const [newMeas,setNewMeas]=useState({date:todayKey(),waist:"",hips:"",chest:"",neck:"",arms:"",thighs:"",notes:""});
  const [trendField,setTrendField]=useState("waist");
  useEffect(()=>{if(tab!=="data"||dataSub!=="measurements")return;(async()=>{setMeasLoading(true);const rows=await db.list("body_measurements",60);setMeasurements(rows||[]);setMeasLoading(false);})();},[tab,dataSub,db]);
  const saveMeas=async()=>{const hasAny=M_FIELDS.some(f=>newMeas[f.k]);if(!hasAny)return;const row={date:newMeas.date,notes:newMeas.notes||null};M_FIELDS.forEach(f=>{row[f.k]=newMeas[f.k]?+newMeas[f.k]:null;});const ok=await db.upsert("body_measurements",row);if(ok){const rows=await db.list("body_measurements",60);setMeasurements(rows||[]);setNewMeas({date:todayKey(),waist:"",hips:"",chest:"",neck:"",arms:"",thighs:"",notes:""});setAddingMeas(false);showToast("Measurements saved","success");}};
  const deleteMeas=async(date)=>{if(!window.confirm("Delete this measurement entry?"))return;const ok=await db.del("body_measurements",date);if(ok){setMeasurements(measurements.filter(m=>m.date!==date));showToast("Deleted","success");}};

  /* ═══ PHOTOS STATE ═══ */
  const [photos,setPhotos]=useState([]);
  const [photosLoading,setPhotosLoading]=useState(false);
  const [photoUploading,setPhotoUploading]=useState(false);
  const [photoUploadPreview,setPhotoUploadPreview]=useState(null);
  const [photoUploadMeta,setPhotoUploadMeta]=useState({date:todayKey(),pose:"front",notes:""});
  const [photoModal,setPhotoModal]=useState(null);
  const [compareMode,setCompareMode]=useState(false);
  const [compareSel,setCompareSel]=useState([]);
  useEffect(()=>{if(tab!=="data"||dataSub!=="photos")return;(async()=>{setPhotosLoading(true);const rows=await db.list("progress_photos",60);setPhotos(rows||[]);setPhotosLoading(false);})();},[tab,dataSub,db]);
  const handlePhotoFile=async(e)=>{const f=e.target.files?.[0];if(!f)return;try{const blob=await compressImage(f);const url=URL.createObjectURL(blob);setPhotoUploadPreview({blob,previewUrl:url,name:f.name});}catch(err){showToast("Couldn't read photo","error");}e.target.value="";};
  const uploadPhoto=async()=>{if(!photoUploadPreview)return;setPhotoUploading(true);try{const rand=Math.random().toString(36).slice(2,10);const path=`${userId}/${photoUploadMeta.date}-${photoUploadMeta.pose}-${rand}.jpg`;const url=await db.storageUpload("progress-photos",path,photoUploadPreview.blob,"image/jpeg");if(!url){setPhotoUploading(false);return;}const ok=await db.upsert("progress_photos",{date:photoUploadMeta.date,pose:photoUploadMeta.pose,url,storage_path:path,notes:photoUploadMeta.notes||null});if(ok){URL.revokeObjectURL(photoUploadPreview.previewUrl);setPhotoUploadPreview(null);setPhotoUploadMeta({date:todayKey(),pose:"front",notes:""});const rows=await db.list("progress_photos",60);setPhotos(rows||[]);showToast("Photo saved","success");}}finally{setPhotoUploading(false);}};
  const deletePhoto=async(p)=>{if(!window.confirm("Delete this photo?"))return;await db.delById("progress_photos",p.id);if(p.storage_path)await db.storageDelete("progress-photos",p.storage_path);setPhotos(photos.filter(x=>x.id!==p.id));setPhotoModal(null);showToast("Photo deleted","success");};
  const toggleCompareSel=(p)=>{const ids=compareSel.map(x=>x.id);if(ids.includes(p.id))setCompareSel(compareSel.filter(x=>x.id!==p.id));else if(compareSel.length<2)setCompareSel([...compareSel,p]);else setCompareSel([compareSel[1],p]);};

  /* ═══ PEPTIDE BATCHES STATE — vial reconstitution log ═══ */
  const [batches,setBatches]=useState([]);
  const [batchesLoading,setBatchesLoading]=useState(false);
  const [addingBatch,setAddingBatch]=useState(false);
  const [newBatch,setNewBatch]=useState({peptide_id:"",date_recon:todayKey(),mg_total:"",ml_bac:"",storage:"",expiry_date:"",notes:""});
  const [editingBatch,setEditingBatch]=useState(null);
  useEffect(()=>{if(tab!=="peptides")return;(async()=>{setBatchesLoading(true);const rows=await db.listShared("peptide_batches",100,"date_recon");setBatches(rows||[]);setBatchesLoading(false);})();},[tab,db]);
  /* Helper bridges to the pure math module — wrap to inject closure-local state */
  const batchStatus = b => batchStatus_pure(b);
  const currentBatchFor = pepId => currentBatchFor_pure(pepId, batches);
  const dueState = (p, checked) => dueState_pure(p, checked);
  const saveBatch=async()=>{if(!newBatch.peptide_id||!newBatch.mg_total||!newBatch.ml_bac)return;const row={peptide_id:newBatch.peptide_id,date_recon:newBatch.date_recon,mg_total:+newBatch.mg_total,ml_bac:+newBatch.ml_bac,storage:newBatch.storage||null,expiry_date:newBatch.expiry_date||addDays(newBatch.date_recon,30),notes:newBatch.notes||null,exhausted:false};const ok=await db.upsert("peptide_batches",row);if(ok){const rows=await db.listShared("peptide_batches",100,"date_recon");setBatches(rows||[]);setNewBatch({peptide_id:"",date_recon:todayKey(),mg_total:"",ml_bac:"",storage:"",expiry_date:"",notes:""});setAddingBatch(false);showToast("Batch logged · shared with household","success");}};
  const updateBatch=async(b,patch)=>{const updated={...b,...patch};const res=await fetch(`${SB}/peptide_batches?id=eq.${b.id}&user_id=eq.${b.user_id}`,{method:"PATCH",headers:{...hdr,Prefer:"return=minimal"},body:JSON.stringify(patch)}).catch(()=>null);if(res&&res.ok){setBatches(batches.map(x=>x.id===b.id?updated:x));}else{showToast("Couldn't update batch","error");}};
  const deleteBatch=async(b)=>{if(!window.confirm("Delete this shared batch entry? It will disappear from both profiles."))return;const ok=await db.delByIdShared("peptide_batches",b.id,b.user_id);if(ok){setBatches(batches.filter(x=>x.id!==b.id));setEditingBatch(null);showToast("Batch deleted","success");}};

  /* ═══ CROSS-USER DOSE LOG — for shared-inventory math
       When ANY user (Kim or Bea) logs a peptide dose, it counts against the shared
       vial's running total. Privacy stays intact for the dose log itself: each user
       sees only their own checklist. We just aggregate the counts for inventory. */
  const [sharedDoseLog,setSharedDoseLog]=useState([]);
  useEffect(()=>{if(tab!=="peptides"&&tab!=="overview")return;const oldestBatch=batches.length?batches.reduce((a,b)=>a.date_recon<b.date_recon?a:b):null;if(!oldestBatch)return;(async()=>{const rows=await db.listSharedSince("daily_peptides",oldestBatch.date_recon,"date");setSharedDoseLog(rows||[]);})();},[tab,batches,db]);
  /* inventoryFor wrapper — bridges the pure inventoryFor to the closure-local batches + sharedDoseLog */
  const inventoryFor=useCallback(peptide=>inventoryFor_pure(peptide,batches,sharedDoseLog),[batches,sharedDoseLog]);

  const todayLabel=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});

  /* All hooks above — early returns safe below */
  if(!userId)return(<div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 20px"}}>
    <style>{STYLE}</style>
    <div className="fade" style={{maxWidth:380,width:"100%",textAlign:"center"}}>
      <div style={{marginBottom:36}}><Logo size={42} sub="Who's using this device?"/></div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {Object.entries(PROFILES).map(([id,p])=>(<button key={id} onClick={()=>setUserId(id)} className="touch" style={{padding:"18px 22px",borderRadius:"var(--r-md)",border:"1px solid var(--line-soft)",background:"var(--elev-1)",color:"var(--t-1)",fontSize:15,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:14,textAlign:"left",transition:"all .18s var(--ease-out)"}} onMouseEnter={e=>{e.currentTarget.style.background="var(--elev-2)";e.currentTarget.style.borderColor="var(--accent-line)";}} onMouseLeave={e=>{e.currentTarget.style.background="var(--elev-1)";e.currentTarget.style.borderColor="var(--line-soft)";}}>
          <div style={{width:42,height:42,borderRadius:"50%",background:"var(--accent-soft)",color:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,fontWeight:600}}>{p.name.charAt(0)}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:600,color:"var(--t-1)"}}>{p.name}</div>
            <div className="mono" style={{fontSize:10.5,color:"var(--t-3)",letterSpacing:".06em",textTransform:"uppercase",marginTop:2}}>Tap to use this profile</div>
          </div>
          <div style={{color:"var(--t-4)",fontSize:18}}>→</div>
        </button>))}
      </div>
      <div style={{fontSize:11,color:"var(--t-4)",marginTop:24,lineHeight:1.5,fontStyle:"italic"}}>Once you pick, this device stays locked to that profile. You can switch later from Settings.</div>
    </div>
  </div>);
  if(onboarded===null)return(<div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20}}><style>{STYLE}</style><div className="fade"><Logo size={36}/></div><div className="fade" style={{color:"var(--t-3)",fontSize:11,letterSpacing:".12em",textTransform:"uppercase",animationDelay:".15s"}}>Loading…</div></div>);
  if(!onboarded)return <Onboarding db={db} onComplete={handleOnboardComplete}/>;

  return(
    <div className="bcq-app">
      <style>{STYLE}</style>

      {/* ═══ HEADER ═══ */}
      <header className="rise" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16,gap:12}}>
        <div style={{minWidth:0,flex:1}}>
          <div className="mono" style={{fontSize:10.5,color:"var(--t-3)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:4}}>{todayLabel}</div>
          <h1 className="serif" style={{fontSize:30,color:"var(--t-1)",margin:0,fontStyle:"italic",letterSpacing:"-0.025em",lineHeight:1,fontWeight:400}}>
            Hello, <span style={{color:"var(--accent)"}}>{profile.name}</span>
          </h1>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button onClick={toggleTheme} className="touch" style={{width:38,height:38,borderRadius:12,border:"1px solid var(--line-soft)",background:"var(--elev-1)",color:"var(--t-3)",cursor:"pointer"}}>
            <Icon n={dark?"moon":"sun"} s={16}/>
          </button>
          <button onClick={()=>setShowSettings(true)} className="touch" style={{width:38,height:38,borderRadius:12,border:"1px solid var(--line-soft)",background:"var(--elev-1)",color:"var(--t-3)",cursor:"pointer"}}>
            <Icon n="gear" s={16}/>
          </button>
        </div>
      </header>

      {/* Goal strip — only when scans exist */}
      {data.length>0&&<div className="rise r1" style={{background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:"14px 16px",marginBottom:18,borderLeft:"3px solid var(--accent)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
          <div>
            <div style={{fontSize:10.5,color:"var(--t-3)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:600,marginBottom:2}}>Goal · {goalPct}% body fat</div>
            <div style={{fontSize:12,color:"var(--t-2)"}}>{fatToLose>0?`${fatToLose}kg to go`:"Goal reached"}</div>
          </div>
          <div className="serif tabular" style={{fontSize:34,color:"var(--t-1)",lineHeight:1,fontStyle:"italic"}}>{pctDone}<span style={{fontSize:18,color:"var(--t-3)"}}>%</span></div>
        </div>
        <div className="hbar"><i style={{width:`${pctDone}%`,background:`linear-gradient(90deg, var(--accent), oklch(0.82 0.16 80))`}}/></div>
      </div>}

      {/* More menu sheet with outside-tap-to-close backdrop */}
      {showMore&&(<><div onClick={()=>setShowMore(false)} style={{position:"fixed",inset:0,zIndex:99,background:"transparent"}}/><div style={{position:"fixed",bottom:90,left:0,right:0,zIndex:100,padding:"0 16px",maxWidth:520,margin:"0 auto"}}>
        <div className="sheet" style={{background:"oklch(0.18 0.018 285 / 0.96)",backdropFilter:"blur(28px) saturate(180%)",borderRadius:"var(--r-md)",border:"1px solid var(--line)",padding:6,display:"flex",flexDirection:"column",gap:2,boxShadow:"var(--shadow-1)"}}>
          {[["data","scale","Data"],["projection","target","Projection"],["monthly","calendar","Monthly"]].map(([id,ic,label])=>(
            <button key={id} onClick={()=>{setTab(id);setShowMore(false);}} className="touch" style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:"var(--r-sm)",border:"none",background:tab===id?"var(--accent-soft)":"transparent",cursor:"pointer",width:"100%",textAlign:"left",color:tab===id?"var(--accent)":"var(--t-2)"}}>
              <Icon n={ic} s={18}/>
              <span style={{fontSize:14,fontWeight:tab===id?600:500}}>{label}</span>
            </button>
          ))}
        </div>
      </div></>)}
      {showSettings&&<Settings db={db} userId={userId} userConfig={userConfig} defaultProfile={defaultProfile} peptideStack={peptideStack} onStackToggle={async(pepId,enabled)=>{
        /* If enabling and no row exists yet (new peptide added to catalog later), seed from DEFAULT_STACK */
        const existing=peptideStack.find(s=>s.peptide_id===pepId);
        let patch={enabled};
        if(enabled&&!existing){
          const d=DEFAULT_STACK[pepId];
          if(d){patch={enabled:true,dose:d.dose,schedule:d.schedule,time:d.time,status:d.status,start_date:d.start_date??null,total_weeks:d.total_weeks??null,cycle_end:d.cycle_end??null,note:d.note??null};}
        }
        const row=await db.upsertStackEntry(pepId,patch);
        if(row){setPeptideStack(prev=>{const i=prev.findIndex(r=>r.peptide_id===pepId);return i>=0?prev.map(r=>r.peptide_id===pepId?row:r):[...prev,row];});}
      }} onClose={()=>setShowSettings(false)} onSave={(cfg)=>{setUserConfig(cfg);setShowSettings(false);}} notifEnabled={notifEnabled} notifPerm={notifPerm} requestNotifPermission={requestNotifPermission} disableNotifs={disableNotifs} sendTestPush={async()=>{try{const r=await sendTestPush(userId);showToast(r.sent>0?`Test sent to ${r.sent} device(s)`:"No active devices","success");}catch(e){showToast("Test failed: "+String(e?.message||e).slice(0,60),"error");}}} exportData={exportData} exporting={exporting} switchUser={switchUser}/>}

      {/* ═══ P18: EDIT PAST DOSE MODAL ═══ */}
      {editPastDose&&(()=>{
        const pep=userPeps.find(p=>p.id===editPastDose.peptideId)||PEPTIDES[editPastDose.peptideId]||{name:editPastDose.peptideId,color:"var(--accent)"};
        const dateObj=new Date(editPastDose.date+"T12:00:00");
        const isToday=editPastDose.date===day;
        const dateLabel=isToday?"Today":dateObj.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
        return(
          <div onClick={()=>setEditPastDose(null)} style={{position:"fixed",inset:0,zIndex:150,background:"oklch(0.05 0 0 / 0.78)",backdropFilter:"blur(10px)",display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"20px"}}>
            <div onClick={e=>e.stopPropagation()} className="sheet" style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:"var(--r-lg)",padding:20,maxWidth:420,width:"100%"}}>
              <div style={{width:34,height:4,background:"var(--elev-3)",borderRadius:2,margin:"0 auto 16px"}}/>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                <div style={{width:10,height:10,borderRadius:5,background:pep.color,flexShrink:0}}/>
                <h3 className="serif" style={{fontSize:24,fontWeight:400,color:"var(--t-1)",margin:0,fontStyle:"italic",letterSpacing:"-0.015em"}}>{pep.name}</h3>
              </div>
              <div className="mono" style={{fontSize:11,color:"var(--t-3)",letterSpacing:".08em",textTransform:"uppercase",fontWeight:600,marginBottom:18}}>{dateLabel} · {editPastForm.exists?"Edit":"Log dose"}</div>

              {editPastForm.loading?(<div style={{padding:"24px 0",textAlign:"center",color:"var(--t-4)",fontSize:12}}>Loading…</div>):(<>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <div>
                    <label className="mono" style={{display:"block",fontSize:10,color:"var(--t-3)",letterSpacing:".08em",textTransform:"uppercase",fontWeight:600,marginBottom:5}}>Time</label>
                    <input type="text" value={editPastForm.time} onChange={e=>setEditPastForm({...editPastForm,time:e.target.value})} placeholder="e.g. 8:00 AM" className="bcq-input" style={{width:"100%"}}/>
                  </div>
                  <div>
                    <label className="mono" style={{display:"block",fontSize:10,color:"var(--t-3)",letterSpacing:".08em",textTransform:"uppercase",fontWeight:600,marginBottom:5}}>Dose</label>
                    <input type="text" value={editPastForm.dose} onChange={e=>setEditPastForm({...editPastForm,dose:e.target.value})} placeholder="e.g. 40u (10.7mg)" className="bcq-input" style={{width:"100%"}}/>
                  </div>
                </div>

                <div style={{display:"flex",gap:8,marginTop:20,flexWrap:"wrap"}}>
                  <button onClick={()=>editPastDoseSave(editPastForm.time,editPastForm.dose)} className="touch" style={{flex:1,minWidth:120,padding:"11px 14px",borderRadius:"var(--r-sm)",border:"1px solid var(--accent-line)",background:"var(--accent)",color:"var(--bg)",fontSize:13,fontWeight:600,cursor:"pointer"}}>{editPastForm.exists?"Save changes":"Log dose"}</button>
                  {editPastForm.exists&&(<button onClick={editPastDoseRemove} className="touch" style={{padding:"11px 14px",borderRadius:"var(--r-sm)",border:"1px solid color-mix(in oklch, var(--c-danger) 30%, var(--line))",background:"color-mix(in oklch, var(--c-danger) 8%, transparent)",color:"var(--c-danger)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Remove</button>)}
                  <button onClick={()=>setEditPastDose(null)} className="touch" style={{padding:"11px 14px",borderRadius:"var(--r-sm)",border:"1px solid var(--line-soft)",background:"var(--elev-2)",color:"var(--t-2)",fontSize:13,fontWeight:500,cursor:"pointer"}}>Cancel</button>
                </div>
              </>)}
            </div>
          </div>
        );
      })()}

      {/* ═══ OVERVIEW (BODY) ═══ */}
      {tab==="overview"&&(<>
        {insightsLoaded&&(<div className="rise" style={{marginBottom:22}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
            <h2 className="serif" style={{fontSize:24,fontWeight:400,color:"var(--t-1)",margin:0,fontStyle:"italic",letterSpacing:"-0.015em"}}>This week</h2>
            {insights.length>0&&<span className="mono" style={{fontSize:10,color:"var(--t-4)",letterSpacing:".08em",textTransform:"uppercase"}}>{insights.length} pattern{insights.length!==1?"s":""}</span>}
          </div>
          {insights.length===0?(<div style={{padding:"14px 16px",background:"var(--elev-1)",borderRadius:"var(--r-md)",color:"var(--t-3)",fontSize:12.5,fontStyle:"italic",borderLeft:"3px solid var(--t-5)"}}>Log a few more days to surface patterns. Need ≥3 macro days, ≥3 peptide days, or ≥3 Whoop entries.</div>):(insights.slice(0,6).map((ins,i)=>(<div key={ins.id} className="rise" style={{animationDelay:`${i*0.05}s`,background:"var(--elev-1)",borderLeft:`3px solid ${ins.color}`,borderRadius:"var(--r-sm)",padding:"12px 14px",marginBottom:7,display:"flex",alignItems:"flex-start",gap:11}}>
            <div style={{marginTop:1,flexShrink:0}}><Icon n={ins.icon} s={15} c={ins.color} sw={1.7}/></div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:10,color:ins.color,fontWeight:600,letterSpacing:".10em",textTransform:"uppercase",marginBottom:3}}>{ins.title}</div>
              <div style={{fontSize:12.5,color:"var(--t-2)",lineHeight:1.55}}>{ins.body}</div>
            </div>
          </div>)))}
        </div>)}

        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:8}}>
          <Card title="Body Fat" value={last.fatPct} unit="%" sub={`Best ${best.fatPct}%${deltaFat!==null?` · ${deltaFat>0?"▲":"▼"}${Math.abs(deltaFat)} from last`:""}`} color="var(--c-bodyfat)" icon="fat" delay={0.04}/>
          <Card title="Muscle" value={last.muscle} unit="kg" sub={`Peak 19.0${deltaMuscle!==null?` · ${deltaMuscle>0?"▲":"▼"}${Math.abs(deltaMuscle)}kg`:""}`} color="var(--c-muscle)" icon="muscle" delay={0.10}/>
          <Card title="Weight" value={last.weight} unit="kg" sub={deltaWeight!==null?`${deltaWeight>0?"▲":"▼"}${Math.abs(deltaWeight)}kg from last`:"Latest"} color="var(--c-weight)" icon="scale" delay={0.16}/>
          <Card title="To Lose" value={fatToLose} unit="kg" sub={`fat mass to reach ${goalPct}%`} color="var(--c-fat)" icon="target" delay={0.22}/>
        </div>

        <H2 sub={`${goalPct}% goal line`} delay={0.28}>Body fat</H2>
        <div className="rise r5" style={cBox}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data} margin={{top:10,right:14,left:4,bottom:0}}>
              <defs><linearGradient id="bfArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--c-bodyfat)" stopOpacity={0.32}/><stop offset="100%" stopColor="var(--c-bodyfat)" stopOpacity={0.02}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--line-soft)" vertical={false}/>
              <XAxis dataKey="labelYr" tick={{fill:"var(--t-3)",fontSize:9,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false} interval={1}/>
              <YAxis domain={[Math.min(goalPct-2,28),48]} allowDecimals={false} tick={{fill:"var(--t-3)",fontSize:10,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false} width={34}/>
              <Tooltip content={<Tip/>}/>
              <ReferenceLine y={goalPct} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth={1.5} strokeOpacity={0.6} label={{value:`${goalPct}% goal`,position:"insideBottomRight",fill:"var(--accent)",fontSize:10,fontFamily:"Geist Mono"}}/>
              <Area type="monotone" dataKey="fatPct" stroke="var(--c-bodyfat)" strokeWidth={2.2} fill="url(#bfArea)" name="Body Fat" dot={{r:3,fill:"var(--c-bodyfat)",stroke:"var(--bg)",strokeWidth:1.5}} activeDot={{r:5,fill:"var(--c-bodyfat)",stroke:"var(--bg)",strokeWidth:2}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <H2 delay={0.32}>Weight & muscle</H2>
        <div className="rise r6" style={cBox}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{top:10,right:14,left:4,bottom:0}}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--line-soft)" vertical={false}/>
              <XAxis dataKey="labelYr" tick={{fill:"var(--t-3)",fontSize:9,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false} interval={1}/>
              <YAxis yAxisId="w" domain={[53,59]} tick={{fill:"var(--t-3)",fontSize:10,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false} width={28}/>
              <YAxis yAxisId="m" orientation="right" domain={[15,20]} tick={{fill:"var(--t-3)",fontSize:10,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false} width={28}/>
              <Tooltip content={<Tip/>}/>
              <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:11,color:"var(--t-3)",fontFamily:"Geist Mono",paddingTop:4}}/>
              <Line yAxisId="w" type="monotone" dataKey="weight" stroke="var(--c-weight)" strokeWidth={2} name="Weight" dot={{r:2.5}} activeDot={{r:4.5}}/>
              <Line yAxisId="m" type="monotone" dataKey="muscle" stroke="var(--c-muscle)" strokeWidth={2} name="Muscle" dot={{r:2.5}} activeDot={{r:4.5}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{marginTop:22}}>
          <button onClick={()=>setShowPlan(!showPlan)} className="touch" style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderRadius:"var(--r-sm)",border:"1px solid var(--line-soft)",background:"transparent",cursor:"pointer",color:"var(--t-2)",fontSize:13,fontWeight:500}}>
            <span style={{display:"flex",alignItems:"center",gap:8}}><Icon n="target" s={15} c="var(--t-3)"/> Plan & recommendations</span>
            <Icon n={showPlan?"chevUp":"chevDown"} s={16} c="var(--t-3)"/>
          </button>
          {showPlan&&(<div style={{marginTop:10}}>
            <Insight icon="macros" title="Nutrition" color="var(--c-fat)" text={`${TARGETS.cal} kcal target · ${TARGETS.protein}g protein per day.`}/>
            <Insight icon="muscle" title="Protect muscle" color="var(--c-muscle)" text="Resistance training 3–4× per week. If muscle drops on a scan, raise intake by 100 kcal."/>
            {profile.showPeptides&&<Insight icon="peps" title="Peptide stack" color="var(--accent)" text="Reta (appetite), 5-Amino (fat metabolism), MOTS-c (mitochondria), CJC+Ipa (GH/recovery) — all synergize with the deficit."/>}
            <Insight icon="calendar" title="Saturday scans" color="var(--c-weight)" text="Weekly InBody at BGC. Add results in Data."/>
          </div>)}
        </div>
      </>)}

      {/* ═══ MACROS ═══ */}
      {tab==="macros"&&mLoading&&<SkelTab/>}
      {tab==="macros"&&!mLoading&&(<>
        <div style={{display:"flex",gap:6,marginBottom:16}}>{[["log","Today"],["history","History"]].map(([k,l])=>(<TabBtn key={k} active={macroSub===k} onClick={()=>setMacroSub(k)}>{l}</TabBtn>))}</div>

        {macroSub==="log"&&(<>
          {/* P18: Date selector — lets you back-log macros for a past day */}
          {(()=>{
            const todayK=todayKey();
            const isToday=macroDate===todayK;
            const dateObj=new Date(macroDate+"T12:00:00");
            const minDate=(()=>{const d=new Date();d.setDate(d.getDate()-30);return localDateKey(d);})();
            const friendly=isToday?"Today":dateObj.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
            return(<>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:isToday?16:10,flexWrap:"wrap"}}>
                <span className="mono" style={{fontSize:10.5,color:"var(--t-3)",letterSpacing:".12em",textTransform:"uppercase",fontWeight:600}}>Logging for</span>
                <input type="date" value={macroDate} min={minDate} max={todayK} onChange={e=>setMacroDate(e.target.value||todayK)} className="bcq-input" style={{colorScheme:"dark",padding:"5px 8px",fontSize:12,maxWidth:170}}/>
                {!isToday&&<button onClick={()=>setMacroDate(todayK)} className="touch" style={{padding:"5px 10px",borderRadius:"var(--r-sm)",border:"1px solid var(--accent-line)",background:"var(--accent-soft)",color:"var(--accent)",fontSize:11,fontWeight:600,cursor:"pointer"}}>← Today</button>}
              </div>
              {!isToday&&<div style={{padding:"10px 14px",background:"color-mix(in oklch, var(--c-warn) 10%, transparent)",borderLeft:"3px solid var(--c-warn)",borderRadius:"var(--r-sm)",fontSize:12,color:"var(--t-2)",marginBottom:16,lineHeight:1.5,display:"flex",alignItems:"center",gap:8}}><Icon n="warn" s={14} c="var(--c-warn)"/> <span>Editing <strong>{friendly}</strong> — changes save to that day's record, not today.</span></div>}
            </>);
          })()}
          {/* Protein hero — the gasping moment */}
          <div className="rise" style={{background:"var(--elev-1)",borderRadius:"var(--r-lg)",padding:"20px 22px 22px",marginBottom:12,borderLeft:"3px solid var(--c-protein)",position:"relative",overflow:"hidden"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
                  <Icon n="muscle" s={15} c="var(--c-protein)" sw={1.7}/>
                  <span style={{fontSize:10.5,color:"var(--c-protein)",letterSpacing:".12em",fontWeight:600,textTransform:"uppercase"}}>Protein</span>
                </div>
                <div style={{fontSize:11,color:"var(--t-3)",letterSpacing:".01em"}}>The number that matters most</div>
              </div>
              {weekAvgProtein&&<div className="mono" style={{fontSize:10.5,color:"var(--t-3)",background:"var(--elev-2)",padding:"4px 10px",borderRadius:999,letterSpacing:".02em"}}>7d avg {weekAvgProtein}g</div>}
            </div>
            <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:12}}>
              <span className="serif tabular" style={{fontSize:72,color:totals.protein>=TARGETS.protein?"var(--c-success)":"var(--t-1)",fontStyle:"italic",lineHeight:.95,letterSpacing:"-0.03em"}}>{Math.round(totals.protein)}</span>
              <span className="serif" style={{fontSize:24,color:"var(--t-3)",fontStyle:"italic"}}>/ {TARGETS.protein}<span style={{fontSize:14}}>g</span></span>
            </div>
            <div className="hbar" style={{marginBottom:8}}><i style={{width:`${Math.min(100,totals.protein/TARGETS.protein*100)}%`,background:totals.protein>=TARGETS.protein?"var(--c-success)":"var(--c-protein)"}}/></div>
            <div className="mono" style={{fontSize:11,color:rem.protein>0?"var(--t-3)":"var(--c-success)",letterSpacing:".01em"}}>{rem.protein>0?`${Math.round(rem.protein)}g remaining`:"✓ Target hit"}</div>
          </div>

          {/* TDEE strip */}
          {userConfig?.weight&&userConfig?.height&&userConfig?.age&&(<div className="rise r1" style={{background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:"14px 16px",marginBottom:12}}>
            {(()=>{
              const w=userConfig.weight,h=userConfig.height,a=userConfig.age;
              const bmr=userConfig.gender==="male"?10*w+6.25*h-5*a+5:10*w+6.25*h-5*a-161;
              const mult={sedentary:1.2,light:1.375,moderate:1.55,active:1.725}[userConfig.activity]||1.375;
              const tdee=Math.round(bmr*mult);
              const deficit=tdee-TARGETS.cal;
              const defPct=Math.round(deficit/tdee*100);
              return(<div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                {[["BMR",Math.round(bmr),"var(--c-carbs)"],["TDEE",tdee,"var(--c-weight)"],["Target",TARGETS.cal,"var(--t-1)"],[deficit>0?"Deficit":"Surplus",deficit>0?`−${deficit}`:`+${Math.abs(deficit)}`,deficit>0?"var(--c-success)":"var(--c-danger)",defPct]].map(([l,v,c,p],i)=>(
                  <div key={i} style={{textAlign:"center",flex:1}}>
                    <div style={{fontSize:9.5,color:"var(--t-3)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:600,marginBottom:2}}>{l}</div>
                    <div className="serif tabular" style={{fontSize:22,color:c,fontStyle:"italic",lineHeight:1}}>{v}</div>
                    {p&&<div className="mono" style={{fontSize:9,color:"var(--t-4)",marginTop:1}}>{p}%</div>}
                  </div>
                ))}
              </div>);
            })()}
          </div>)}

          {/* Secondary macros */}
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {[{k:"cal",l:"Cal",v:totals.cal,t:TARGETS.cal,c:"var(--c-cal)"},{k:"fat",l:"Fat",v:Math.round(totals.fat),t:TARGETS.fat,c:"var(--c-fat)"},{k:"carbs",l:"Carbs",v:Math.round(totals.carbs),t:TARGETS.carbs,c:"var(--c-carbs)"}].map((m,i)=>(
              <div key={m.k} className="rise" style={{animationDelay:`${0.04+i*0.04}s`,flex:1,background:"var(--elev-1)",borderRadius:"var(--r-sm)",padding:"10px 8px",textAlign:"center"}}>
                <div style={{fontSize:9.5,color:"var(--t-3)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:600,marginBottom:2}}>{m.l}</div>
                <div className="serif tabular" style={{fontSize:22,color:m.c,fontStyle:"italic",lineHeight:1}}>{m.v}</div>
                <div className="mono" style={{fontSize:9.5,color:"var(--t-4)",marginTop:3}}>/ {m.t}</div>
              </div>
            ))}
          </div>

          {/* Whey toggle — only shown when configured in Settings */}
          {whey.enabled&&<button onClick={toggleWhey} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:wheyOn?"var(--accent-soft)":"var(--elev-1)",border:wheyOn?"1px solid var(--accent-line)":"1px solid transparent",borderRadius:"var(--r-sm)",padding:"12px 14px",marginBottom:18,cursor:"pointer",transition:"all .2s var(--ease-out)",minHeight:54}}>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:13.5,fontWeight:600,color:"var(--t-1)"}}>{whey.label}</div>
              <div className="mono" style={{fontSize:11,color:"var(--t-3)",marginTop:2,letterSpacing:".01em"}}>{calcCal(whey.protein,whey.fat,whey.carbs)} kcal · {whey.protein}g protein</div>
            </div>
            <div style={{width:42,height:24,borderRadius:12,background:wheyOn?"var(--accent)":"var(--elev-3)",display:"flex",alignItems:"center",padding:"0 3px",transition:"background .2s var(--ease-out)"}}><div style={{width:18,height:18,borderRadius:9,background:"var(--bg)",transform:wheyOn?"translateX(18px)":"translateX(0)",transition:"transform .25s var(--ease-out)"}}/></div>
          </button>}

          {/* Meals list header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
            <h3 className="serif" style={{fontSize:20,fontWeight:400,margin:0,color:"var(--t-1)",fontStyle:"italic",letterSpacing:"-0.015em"}}>Meals</h3>
            <span className="mono" style={{fontSize:10.5,color:"var(--t-3)",letterSpacing:".02em"}}>{meals.length} logged</span>
          </div>

          {meals.length===0&&!adding&&!showFavs&&<div style={{textAlign:"center",padding:"32px 0 12px",color:"var(--t-4)",fontSize:13}}><Icon n="macros" s={28} c="var(--t-5)"/><div style={{marginTop:10}}>Nothing logged yet</div><div style={{fontSize:11,color:"var(--t-5)",marginTop:3}}>Tap below to start your day</div></div>}

          {meals.map((m,i)=>editId===m.id?(
            <div key={m.id} className="sheet" style={{background:"var(--elev-1)",border:"1px solid var(--accent-line)",borderRadius:"var(--r-sm)",padding:14,marginBottom:8}}>
              <input value={editMeal.name} onChange={e=>setEditMeal({...editMeal,name:e.target.value})} className="bcq-input" style={{marginBottom:8}}/>
              <div style={{display:"flex",gap:4,marginBottom:10,flexWrap:"wrap"}}>{MEAL_TAGS.map(t=>(<button key={t} onClick={()=>setEditMeal({...editMeal,tag:t})} style={{padding:"4px 10px",borderRadius:999,border:editMeal.tag===t?"1px solid var(--accent-line)":"1px solid transparent",background:editMeal.tag===t?"var(--accent-soft)":"var(--elev-2)",color:editMeal.tag===t?"var(--accent)":"var(--t-3)",fontSize:11,cursor:"pointer",fontWeight:500}}>{t}</button>))}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
                {[{k:"protein",l:"P",c:"var(--c-protein)"},{k:"fat",l:"F",c:"var(--c-fat)"},{k:"carbs",l:"C",c:"var(--c-carbs)"}].map(f=>(<div key={f.k}><div style={{fontSize:9,color:f.c,fontWeight:600,marginBottom:2,letterSpacing:".06em"}}>{f.l}</div><input type="number" value={editMeal[f.k]} onChange={e=>setEditMeal({...editMeal,[f.k]:e.target.value})} className="bcq-input mono" style={{textAlign:"center",fontSize:14,padding:"7px 4px",fontWeight:600}}/></div>))}
              </div>
              <div style={{display:"flex",gap:6}}><button onClick={saveEdit} className="touch" style={{flex:1,padding:"10px",borderRadius:"var(--r-sm)",border:"none",background:"var(--t-1)",color:"var(--bg)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Save</button><button onClick={()=>setEditId(null)} className="touch" style={{padding:"10px 14px",borderRadius:"var(--r-sm)",border:"none",background:"var(--elev-2)",color:"var(--t-3)",fontSize:13,cursor:"pointer"}}>Cancel</button></div>
            </div>
          ):(
            <div key={m.id} className="rise" style={{animationDelay:`${i*0.03}s`,display:"flex",alignItems:"center",padding:"12px 0",borderBottom:i<meals.length-1?"1px solid var(--line-soft)":"none",gap:10}}>
              <div onClick={()=>startEdit(m)} style={{flex:1,minWidth:0,cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                  {m.tag&&<span style={{fontSize:9.5,color:"var(--t-3)",background:"var(--elev-2)",padding:"2px 8px",borderRadius:999,letterSpacing:".04em",fontWeight:500}}>{m.tag}</span>}
                  <span style={{fontSize:14,color:"var(--t-1)",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name}</span>
                </div>
                <div className="mono" style={{display:"flex",gap:10,fontSize:11,letterSpacing:".01em"}}>
                  <span style={{color:"var(--c-cal)"}}>{calcCal(m.protein,m.fat,m.carbs)}</span>
                  <span style={{color:"var(--c-protein)",fontWeight:600}}>{m.protein}P</span>
                  <span style={{color:"var(--c-fat)"}}>{m.fat}F</span>
                  <span style={{color:"var(--c-carbs)"}}>{m.carbs}C</span>
                </div>
              </div>
              <div style={{display:"flex",gap:4}}>
                {!favs.find(f=>f.name===m.name)&&<button onClick={()=>addFav(m)} className="touch" style={{background:"none",border:"none",color:"var(--t-4)",cursor:"pointer",padding:6,borderRadius:8}}><Icon n="star" s={16}/></button>}
                <button onClick={()=>removeMeal(m.id)} className="touch" style={{background:"none",border:"none",color:"var(--t-4)",cursor:"pointer",padding:6,borderRadius:8}}><Icon n="x" s={16}/></button>
              </div>
            </div>
          ))}

          {/* Action buttons */}
          {!adding&&!showFavs&&(<div style={{display:"flex",gap:8,marginTop:14}}>
            <button onClick={()=>setAdding(true)} className="touch" style={{flex:1,padding:"14px",borderRadius:"var(--r-md)",border:"1px dashed var(--accent-line)",background:"var(--accent-soft)",color:"var(--accent)",fontSize:13.5,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon n="plus" s={16}/> Add meal</button>
            {favs.length>0&&<button onClick={()=>setShowFavs(true)} className="touch" style={{padding:"14px 18px",borderRadius:"var(--r-md)",border:"1px solid var(--line-soft)",background:"var(--elev-1)",color:"var(--c-warn)",fontSize:13.5,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}><Icon n="starFilled" s={14} c="var(--c-warn)"/> {favs.length}</button>}
          </div>)}

          {/* Favorites panel */}
          {showFavs&&(<div className="sheet" style={{marginTop:14,background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:16,borderLeft:"3px solid var(--c-warn)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,alignItems:"center"}}>
              <span style={{display:"flex",alignItems:"center",gap:7,fontSize:13.5,fontWeight:600,color:"var(--c-warn)"}}><Icon n="starFilled" s={15} c="var(--c-warn)"/> Favorites</span>
              <button onClick={()=>setShowFavs(false)} className="touch" style={{background:"none",border:"none",color:"var(--t-3)",cursor:"pointer",padding:4}}><Icon n="x" s={16}/></button>
            </div>
            {favs.map((f,i)=>(<div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:i<favs.length-1?"1px solid var(--line-soft)":"none"}}>
              <div onClick={()=>addFromFav(f)} style={{flex:1,cursor:"pointer"}}>
                <div style={{fontSize:13,fontWeight:500,color:"var(--t-1)"}}>{f.name}</div>
                <div className="mono" style={{fontSize:11,color:"var(--t-3)",marginTop:2}}>{calcCal(f.protein,f.fat,f.carbs)} · <span style={{color:"var(--c-protein)",fontWeight:600}}>{f.protein}P</span> · {f.fat}F · {f.carbs}C</div>
              </div>
              <button onClick={()=>removeFav(f.name)} className="touch" style={{background:"none",border:"none",color:"var(--t-4)",cursor:"pointer",padding:6}}><Icon n="x" s={14}/></button>
            </div>))}
            {favs.length===0&&<div style={{textAlign:"center",padding:"16px 0",color:"var(--t-4)",fontSize:12}}>Star a meal to save it here</div>}
          </div>)}

          {/* Add meal sheet */}
          {adding&&(<div className="sheet" style={{marginTop:14,background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:18,borderTop:"1px solid var(--line)"}}>
            <div style={{width:34,height:4,background:"var(--elev-3)",borderRadius:2,margin:"-6px auto 12px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14,alignItems:"baseline"}}>
              <h3 className="serif" style={{fontSize:22,fontWeight:400,color:"var(--t-1)",margin:0,fontStyle:"italic",letterSpacing:"-0.015em"}}>New meal</h3>
              <button onClick={()=>{setAdding(false);setNewMeal({name:"",protein:"",fat:"",carbs:"",tag:"Lunch"});}} className="touch" style={{background:"none",border:"none",color:"var(--t-3)",cursor:"pointer",padding:4}}><Icon n="x" s={18}/></button>
            </div>
            <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>{MEAL_TAGS.map(t=>(<button key={t} onClick={()=>setNewMeal({...newMeal,tag:t})} className="touch" style={{padding:"7px 13px",borderRadius:999,border:newMeal.tag===t?"1px solid var(--accent-line)":"1px solid transparent",background:newMeal.tag===t?"var(--accent-soft)":"var(--elev-2)",color:newMeal.tag===t?"var(--accent)":"var(--t-3)",fontSize:11.5,fontWeight:500,cursor:"pointer"}}>{t}</button>))}</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:"var(--t-3)",marginBottom:5,fontWeight:600,letterSpacing:".10em",textTransform:"uppercase"}}>Meal name</div>
              <input value={newMeal.name} onChange={e=>setNewMeal({...newMeal,name:e.target.value})} placeholder="Beef taco wrap" className="bcq-input"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
              {[{k:"protein",l:"Protein",c:"var(--c-protein)"},{k:"fat",l:"Fat",c:"var(--c-fat)"},{k:"carbs",l:"Carbs",c:"var(--c-carbs)"}].map(f=>(<div key={f.k}>
                <div style={{fontSize:10,color:f.c,marginBottom:5,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>{f.l}</div>
                <input type="number" value={newMeal[f.k]} onChange={e=>setNewMeal({...newMeal,[f.k]:e.target.value})} placeholder="0" className="bcq-input serif" style={{textAlign:"center",fontSize:20,padding:"12px 6px",fontStyle:"italic"}}/>
              </div>))}
            </div>
            {(newMeal.protein||newMeal.fat||newMeal.carbs)&&(<div className="fade" style={{textAlign:"center",padding:"10px",background:"var(--elev-2)",borderRadius:"var(--r-sm)",marginBottom:14}}>
              <span style={{fontSize:11,color:"var(--t-3)",letterSpacing:".04em"}}>= </span>
              <span className="serif tabular" style={{fontSize:24,color:"var(--c-cal)",fontStyle:"italic"}}>{calcCal(+newMeal.protein,+newMeal.fat,+newMeal.carbs)}</span>
              <span style={{fontSize:11,color:"var(--t-3)",marginLeft:4}}>kcal</span>
            </div>)}
            <button onClick={addMeal} disabled={!newMeal.name} className="touch" style={{width:"100%",padding:"14px",borderRadius:"var(--r-md)",border:"none",background:newMeal.name?"var(--t-1)":"var(--elev-2)",color:newMeal.name?"var(--bg)":"var(--t-4)",fontSize:14,fontWeight:600,cursor:newMeal.name?"pointer":"default",transition:"all .2s var(--ease-out)"}}>Add meal</button>
          </div>)}
        </>)}

        {macroSub==="history"&&(<>
          {weekAvgProtein&&<div className="rise" style={{background:"var(--elev-1)",borderLeft:"3px solid var(--c-protein)",borderRadius:"var(--r-md)",padding:"14px 18px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
            <div>
              <div style={{fontSize:10.5,color:"var(--c-protein)",letterSpacing:".10em",fontWeight:600,textTransform:"uppercase"}}>7-day protein average</div>
              <div className="mono" style={{fontSize:11,color:"var(--t-3)",marginTop:2}}>vs {TARGETS.protein}g target</div>
            </div>
            <span className="serif tabular" style={{fontSize:38,color:weekAvgProtein>=TARGETS.protein?"var(--c-success)":"var(--c-protein)",fontStyle:"italic",lineHeight:1}}>{weekAvgProtein}<span style={{fontSize:18,color:"var(--t-3)"}}>g</span></span>
          </div>}
          {histDays.length===0?<div style={{textAlign:"center",padding:"48px 0",color:"var(--t-4)",fontSize:13}}><Icon n="calendar" s={28} c="var(--t-5)"/><div style={{marginTop:10}}>No history yet</div></div>:histDays.map((d,i)=>{const lb=new Date(d.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});const ph=d.protein>=TARGETS.protein;return(<div key={i} className="rise" style={{animationDelay:`${i*0.04}s`,background:"var(--elev-1)",borderRadius:"var(--r-sm)",padding:"14px 16px",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:600,color:"var(--t-1)"}}>{lb}</span>
              {ph&&<span style={{fontSize:9.5,background:"color-mix(in oklch, var(--c-success) 14%, transparent)",color:"var(--c-success)",padding:"3px 10px",borderRadius:999,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>Protein ✓</span>}
            </div>
            <div className="mono" style={{display:"flex",gap:14,fontSize:11.5,letterSpacing:".01em"}}>
              <span style={{color:"var(--c-cal)"}}>{d.cal}</span>
              <span style={{color:"var(--c-protein)",fontWeight:ph?700:500}}>{Math.round(d.protein)}P</span>
              <span style={{color:"var(--c-fat)"}}>{Math.round(d.fat)}F</span>
              <span style={{color:"var(--c-carbs)"}}>{Math.round(d.carbs)}C</span>
            </div>
            <div className="hbar" style={{marginTop:8,height:3}}><i style={{width:`${Math.min(100,d.protein/TARGETS.protein*100)}%`,background:ph?"var(--c-success)":"var(--c-protein)"}}/></div>
          </div>);})}
        </>)}
      </>)}

      {/* ═══ PEPTIDES ═══ */}
      {tab==="peptides"&&pepLoading&&<SkelTab/>}
      {tab==="peptides"&&!pepLoading&&(<>
        <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>{[["today","Today"],["all","Stack"],["batches","Batches"],["history","History"]].map(([k,l])=>(<TabBtn key={k} active={pepSub===k} onClick={()=>setPepSub(k)}>{l}</TabBtn>))}</div>

        {pepSub==="today"&&(<>
          {/* Supply alerts — use live inventory from shared batches when available, else hardcoded supplyNote */}
          {(()=>{
            const enriched=userPeps.filter(p=>p.status==="active").map(p=>{const inv=inventoryFor(p);return{peptide:p,daysSupply:inv?.daysSupply,dosesRemaining:inv?.dosesRemaining,liveNote:inv?`${inv.dosesRemaining}/${inv.totalDosesInVial} doses left in current vial`:null,isLive:!!inv};}).filter(x=>x.daysSupply!=null&&x.daysSupply<=14).sort((a,b)=>a.daysSupply-b.daysSupply);
            if(enriched.length===0)return null;
            return(<div style={{marginBottom:16}}>{enriched.map(({peptide:p,daysSupply,dosesRemaining,liveNote,isLive})=>{const urgent=daysSupply<=7;return(<div key={p.id} className="rise" style={{background:urgent?"color-mix(in oklch, var(--c-danger) 10%, var(--elev-1))":"color-mix(in oklch, var(--c-warn) 8%, var(--elev-1))",borderLeft:`3px solid ${urgent?"var(--c-danger)":"var(--c-warn)"}`,borderRadius:"var(--r-sm)",padding:"10px 14px",marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{display:"flex",alignItems:"center",gap:7,fontSize:13,fontWeight:600,color:urgent?"var(--c-danger)":"var(--c-warn)"}}><Icon n="warn" s={15} c={urgent?"var(--c-danger)":"var(--c-warn)"} sw={2}/> {p.name}{isLive&&<span className="mono" style={{fontSize:9,color:"var(--accent)",background:"var(--accent-soft)",padding:"1px 6px",borderRadius:999,letterSpacing:".06em",fontWeight:600,marginLeft:4}}>LIVE</span>}</span>
                <span className="mono" style={{fontSize:11.5,fontWeight:600,color:urgent?"var(--c-danger)":"var(--c-warn)"}}>{daysSupply}d left</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6,gap:10}}>
                <div style={{fontSize:11,color:"var(--t-3)",flex:1,minWidth:0}}>{liveNote}</div>
                <button onClick={()=>setReorderModal({...p,daysSupply,dosesLeft:dosesRemaining,supplyNote:liveNote})} className="touch" style={{padding:"5px 11px",borderRadius:999,border:`1px solid ${urgent?"var(--c-danger)":"var(--c-warn)"}`,background:`color-mix(in oklch, ${urgent?"var(--c-danger)":"var(--c-warn)"} 14%, transparent)`,color:urgent?"var(--c-danger)":"var(--c-warn)",fontSize:11,fontWeight:600,cursor:"pointer",flexShrink:0,display:"inline-flex",alignItems:"center",gap:4}}>Reorder →</button>
              </div>
            </div>);})}</div>);
          })()}

          {/* Streak + progress */}
          <div className="rise" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <h3 className="serif" style={{fontSize:24,margin:0,color:"var(--t-1)",fontStyle:"italic",fontWeight:400,letterSpacing:"-0.015em"}}>{new Date().toLocaleDateString("en-US",{weekday:"long"})}</h3>
              {streak>0&&<span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:600,color:"var(--c-streak)",background:"color-mix(in oklch, var(--c-streak) 12%, transparent)",padding:"4px 10px",borderRadius:999,letterSpacing:".02em"}}><Icon n="flame" s={12} c="var(--c-streak)" sw={2}/> {streak}d</span>}
            </div>
            <div className="mono" style={{fontSize:13,fontWeight:600,color:checkedCount===duePeptides.length&&duePeptides.length>0?"var(--c-success)":"var(--t-3)"}}>{checkedCount}<span style={{color:"var(--t-4)"}}>/{duePeptides.length}</span></div>
          </div>
          {duePeptides.length>0&&<div className="hbar" style={{marginBottom:18}}><i style={{width:`${checkedCount/duePeptides.length*100}%`,background:checkedCount===duePeptides.length?"var(--c-success)":`linear-gradient(90deg, var(--accent), var(--c-streak))`}}/></div>}

          {/* Checklist */}
          {duePeptides.map((p,i)=>{const check=pepData.checks[p.id];const checked=!!check;const time=check?.time||"";const dose=check?.dose||"";const isEditing=editingDose===p.id;const curBatch=currentBatchFor(p.id);const batchStat=curBatch?batchStatus(curBatch):null;const ds=dueState(p,checked);const pillColor=ds?ds.color:p.color;const pillLabel=ds?ds.label:p.time;return(
            <div key={p.id} className={`rise${ds?.urgent?" ring-pulse":""}`} style={{animationDelay:`${i*0.04}s`,background:"var(--elev-1)",borderLeft:`3px solid ${checked?"var(--c-success)":ds?.overdue?ds.color:p.color}`,borderRadius:"var(--r-sm)",padding:"12px 14px",marginBottom:8,opacity:checked?0.78:1,transition:"opacity .25s var(--ease-out)"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <button onClick={()=>togglePep(p.id,p.dose)} className="touch" style={{width:28,height:28,borderRadius:8,border:`1.5px solid ${checked?"var(--c-success)":p.color}`,background:checked?"var(--c-success)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",padding:0,transition:"all .2s var(--ease-out)"}}>{checked&&<Icon n="check" s={16} c="var(--bg)" sw={2.5}/>}</button>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
                    <span style={{fontSize:14,fontWeight:600,color:checked?"var(--t-3)":"var(--t-1)",textDecoration:checked?"line-through":"none"}}>{p.name}</span>
                    <span className="mono" style={{fontSize:9.5,color:pillColor,background:`color-mix(in oklch, ${pillColor} 14%, transparent)`,padding:"2px 8px",borderRadius:999,letterSpacing:".04em",fontWeight:600,flexShrink:0}}>{pillLabel}</span>
                  </div>
                  <div className="mono" style={{fontSize:11.5,color:"var(--t-3)",marginTop:3,letterSpacing:".01em"}}>
                    {checked?(<span>✓ {time}{dose?` · ${dose}`:` · ${p.dose}`}</span>):p.dose}
                  </div>
                  {curBatch&&<div className="mono" style={{fontSize:10.5,color:batchStat.color,marginTop:4,letterSpacing:".01em",display:"inline-flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                    <Icon n="vial" s={11} c={batchStat.color} sw={1.6}/> {concentration(curBatch)}mg/mL · {batchStat.label}{curBatch.storage?` · ${curBatch.storage}`:""}
                  </div>}
                  {(()=>{const inv=inventoryFor(p);if(!inv)return null;const low=inv.dosesRemaining<=2;return(<div className="mono" style={{fontSize:10,color:low?"var(--c-warn)":"var(--t-3)",marginTop:3,letterSpacing:".02em",display:"inline-flex",alignItems:"center",gap:4}}>
                    <Icon n="users" s={10} c={low?"var(--c-warn)":"var(--t-3)"} sw={1.6}/> Shared · {inv.dosesRemaining}/{inv.totalDosesInVial} doses left{inv.daysSupply!=null?` · ~${inv.daysSupply}d`:""}
                  </div>);})()}
                  {curBatch&&isPastPGStability(curBatch)&&(()=>{const r=RECONSTITUTION[p.id];return(<div className="mono" style={{fontSize:9.5,color:"var(--c-warn)",marginTop:3,letterSpacing:".02em"}}>⚠ Batch past PG's {r.stabilityDays}-day stability window</div>);})()}
                  <div style={{fontSize:11,color:"var(--t-4)",marginTop:5,lineHeight:1.45,fontStyle:"italic"}}>{p.purpose}</div>
                </div>
              </div>
              {checked&&(<div style={{marginTop:8,marginLeft:40}}>
                {!isEditing?(<button onClick={()=>{setEditingDose(p.id);setDoseVal(dose||p.dose);}} style={{fontSize:11,color:"var(--t-4)",background:"none",border:"none",cursor:"pointer",padding:0,display:"inline-flex",alignItems:"center",gap:4}}><Icon n="edit" s={11}/> edit dose</button>):(
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <input value={doseVal} onChange={e=>setDoseVal(e.target.value)} className="bcq-input mono" style={{fontSize:11.5,padding:"5px 10px",width:160}} placeholder="40u (10.7mg)"/>
                    <button onClick={()=>{updateDose(p.id,doseVal);setEditingDose(null);}} style={{fontSize:11,color:"var(--c-success)",background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:"4px 8px"}}>Save</button>
                    <button onClick={()=>setEditingDose(null)} className="touch" style={{color:"var(--t-4)",background:"none",border:"none",cursor:"pointer",padding:4}}><Icon n="x" s={14}/></button>
                  </div>
                )}
              </div>)}
            </div>
          );})}

          {duePeptides.length===0&&<div style={{textAlign:"center",padding:"36px 0",color:"var(--t-4)",fontSize:13}}><Icon n="peps" s={28} c="var(--t-5)"/><div style={{marginTop:10}}>Nothing scheduled today</div></div>}

          {/* 7-day adherence matrix */}
          <div style={{marginTop:24}}>
            <div style={{fontSize:10.5,color:"var(--t-3)",marginBottom:12,letterSpacing:".12em",textTransform:"uppercase",fontWeight:600}}>Last 7 days</div>
            {(()=>{
              const H={"2026-04-20":["glow","nad","motsc"],"2026-04-21":["reta"],"2026-04-22":["glow","nad","motsc","semax"],"2026-04-23":["semax"],"2026-04-24":["glow"],"2026-04-25":["motsc"],"2026-04-27":["glow","nad"],"2026-04-28":["reta","motsc"],"2026-04-29":["glow","nad"],"2026-05-01":["klow","motsc"],"2026-05-03":["klow"],"2026-05-04":["klow","nad","semax"],"2026-05-05":["klow","reta","motsc","semax"],"2026-05-06":["klow","nad","semax"],"2026-05-07":["klow","semax"],"2026-05-08":["klow","motsc","semax"],"2026-05-10":["klow"],"2026-05-11":["klow","nad"],"2026-05-12":["klow","reta","motsc"],"2026-05-13":["klow","nad"],"2026-05-14":["klow"],"2026-05-15":["klow","motsc"]};
              const today=new Date();
              const days=[];
              for(let i=6;i>=0;i--){
                const dt=new Date(today);dt.setDate(today.getDate()-i);
                const key=localDateKey(dt);
                const dow=dt.getDay();
                const dayName=dt.toLocaleDateString("en-US",{weekday:"narrow"});
                const dateNum=dt.getDate();
                const isToday=key===day;
                days.push({key,dow,dayName,dateNum,isToday});
              }
              const activePeps=userPeps.filter(p=>p.status==="active");
              return(<div style={{overflowX:"auto",background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:14}}>
                <div style={{display:"grid",gridTemplateColumns:`88px repeat(7,1fr)`,gap:0,minWidth:340}}>
                  <div/>
                  {days.map(d=>(<div key={d.key} style={{textAlign:"center",padding:"4px 2px",borderBottom:"1px solid var(--line-soft)"}}>
                    <div className="mono" style={{fontSize:9,color:d.isToday?"var(--accent)":"var(--t-4)",letterSpacing:".04em"}}>{d.dayName}</div>
                    <div className="serif" style={{fontSize:13,fontStyle:"italic",color:d.isToday?"var(--accent)":"var(--t-3)",lineHeight:1.2}}>{d.dateNum}</div>
                  </div>))}
                  {activePeps.map(p=>(<div key={p.id} style={{display:"contents"}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,padding:"7px 0",borderBottom:"1px solid var(--line-soft)"}}>
                      <div style={{width:4,height:4,borderRadius:2,background:p.color,flexShrink:0}}/>
                      <span style={{fontSize:10.5,color:"var(--t-2)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontWeight:500}}>{p.name.length>10?p.name.slice(0,9)+"…":p.name}</span>
                    </div>
                    {days.map(d=>{
                      const scheduled=p.schedule.includes(d.dow)&&(!p.startDate||d.key>=p.startDate);
                      const liveHist=pepHist.find(h=>h.date===d.key);
                      const liveTaken=liveHist?!!(liveHist.checks||{})[p.id]:false;
                      const histTaken=(H[d.key]||[]).includes(p.id);
                      const taken=liveTaken||histTaken;
                      const isFuture=new Date(d.key+"T23:59:59")>today&&d.key!==day;
                      /* P18: allow tapping any non-future cell to edit. 30-day cap enforced. */
                      const daysBack=Math.round((today-new Date(d.key+"T12:00:00"))/(86400000));
                      const editable=!isFuture&&daysBack<=30;
                      let icon=null,bg="transparent";
                      if(isFuture){icon="";}
                      else if(!scheduled){icon=<span style={{color:"var(--t-5)"}}>–</span>;}
                      else if(taken){icon=<Icon n="check" s={12} c="var(--c-success)" sw={2.5}/>;bg="color-mix(in oklch, var(--c-success) 14%, transparent)";}
                      else{icon=<Icon n="x" s={11} c="var(--c-danger)" sw={2.5}/>;bg="color-mix(in oklch, var(--c-danger) 10%, transparent)";}
                      const cellProps=editable&&scheduled?{onClick:()=>setEditPastDose({peptideId:p.id,date:d.key}),style:{display:"flex",alignItems:"center",justifyContent:"center",padding:"7px 0",background:bg,borderBottom:"1px solid var(--line-soft)",cursor:"pointer",transition:"background .15s var(--ease-out)"},onMouseEnter:e=>{e.currentTarget.style.background="color-mix(in oklch, var(--accent) 12%, "+bg+")";},onMouseLeave:e=>{e.currentTarget.style.background=bg;}}:{style:{display:"flex",alignItems:"center",justifyContent:"center",padding:"7px 0",background:bg,borderBottom:"1px solid var(--line-soft)"}};
                      return(<div key={d.key} {...cellProps}>{icon}</div>);
                    })}
                  </div>))}
                </div>
                <div style={{display:"flex",gap:14,justifyContent:"center",marginTop:10,flexWrap:"wrap"}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,color:"var(--t-3)"}}><Icon n="check" s={11} c="var(--c-success)" sw={2.5}/> taken</span>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,color:"var(--t-3)"}}><Icon n="x" s={10} c="var(--c-danger)" sw={2.5}/> missed</span>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,color:"var(--t-3)"}}><span style={{color:"var(--t-5)"}}>–</span> not due</span>
                </div>
                <div style={{fontSize:10,color:"var(--t-4)",textAlign:"center",marginTop:6,fontStyle:"italic"}}>Tap any cell to log a missed dose or edit history</div>
              </div>);
            })()}
          </div>

          {/* ═══ P17: Wellness daily log ═══ */}
          <div style={{marginTop:22}}>
            <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontSize:10.5,color:"var(--t-3)",letterSpacing:".12em",textTransform:"uppercase",fontWeight:600}}>How you feel today</div>
              {(wellness.mood||wellness.energy||wellness.sleep_quality)&&<span className="mono" style={{fontSize:10,color:"var(--t-4)",letterSpacing:".06em"}}>tap to update</span>}
            </div>
            {(()=>{
              /* Render three rating rows. Each row: label + 5 pill buttons.
                 The color gradient runs from danger (1) → warn (3) → success (5). */
              const ROWS = [
                {key:"mood",          label:"Mood",   hint:"😞 → 😄"},
                {key:"energy",        label:"Energy", hint:"low → high"},
                {key:"sleep_quality", label:"Sleep",  hint:"poor → great"},
              ];
              /* Colors for ratings 1..5 — keeps the visual feedback consistent */
              const tint=(v,active)=>{
                if(!active)return{bg:"var(--elev-1)",fg:"var(--t-3)",bd:"var(--line-soft)"};
                if(v<=2)return{bg:"color-mix(in oklch, var(--c-danger) 16%, transparent)",fg:"var(--c-danger)",bd:"var(--c-danger)"};
                if(v===3)return{bg:"color-mix(in oklch, var(--c-warn) 14%, transparent)",fg:"var(--c-warn)",bd:"var(--c-warn)"};
                return{bg:"var(--accent-soft)",fg:"var(--accent)",bd:"var(--accent-line)"};
              };
              return(<>
                {ROWS.map(row=>(
                  <div key={row.key} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{flex:"0 0 64px",fontSize:12,color:"var(--t-2)",fontWeight:500}}>{row.label}</div>
                    <div style={{display:"flex",gap:5,flex:1}}>
                      {[1,2,3,4,5].map(v=>{
                        const active=wellness[row.key]===v;
                        const t=tint(v,active);
                        return(<button key={v} onClick={()=>saveWellness({[row.key]:active?null:v})} className="touch" style={{flex:1,minWidth:0,padding:"8px 0",borderRadius:"var(--r-sm)",border:`1px solid ${t.bd}`,background:t.bg,color:t.fg,fontSize:13,fontWeight:active?700:500,cursor:"pointer",transition:"all .15s var(--ease-out)",fontFamily:active?"Geist Mono, monospace":"inherit"}}>{v}</button>);
                      })}
                    </div>
                  </div>
                ))}
                {/* Notes — collapsed by default, expands when typing */}
                <textarea
                  value={wellness.notes||""}
                  onChange={e=>setWellness({...wellness,notes:e.target.value})}
                  onBlur={e=>saveWellness({notes:e.target.value})}
                  placeholder="Notes (optional — sleep oddities, stressors, what you ate, etc.)"
                  rows={wellness.notes?2:1}
                  className="bcq-input"
                  style={{width:"100%",resize:"vertical",fontSize:12,marginTop:6,lineHeight:1.5,fontFamily:"inherit"}}
                />
                {/* 7-day mini-trend — only shows after a few days of data */}
                {wellnessHist.length>=2&&(<div style={{marginTop:12,padding:"10px 12px",background:"var(--elev-1)",borderRadius:"var(--r-sm)"}}>
                  <div style={{fontSize:9.5,color:"var(--t-4)",letterSpacing:".10em",textTransform:"uppercase",marginBottom:6,fontWeight:600}}>Last {wellnessHist.length} days</div>
                  {ROWS.map(row=>{
                    /* Reverse to chronological order */
                    const series=[...wellnessHist].reverse().map(w=>w[row.key]);
                    return(<div key={row.key} style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <div style={{flex:"0 0 50px",fontSize:10,color:"var(--t-4)"}}>{row.label}</div>
                      <div style={{display:"flex",gap:2,flex:1,height:18,alignItems:"flex-end"}}>
                        {series.map((v,i)=>{
                          if(v==null)return<div key={i} style={{flex:1,height:2,background:"var(--line-soft)",borderRadius:1,alignSelf:"center"}}/>;
                          const color=v<=2?"var(--c-danger)":v===3?"var(--c-warn)":"var(--accent)";
                          return<div key={i} style={{flex:1,height:`${v*20}%`,background:color,borderRadius:1,opacity:0.85}} title={`${v}/5`}/>;
                        })}
                      </div>
                    </div>);
                  })}
                </div>)}
              </>);
            })()}
          </div>

          {/* Side effects */}
          <div style={{marginTop:22}}>
            <div style={{fontSize:10.5,color:"var(--t-3)",marginBottom:10,letterSpacing:".12em",textTransform:"uppercase",fontWeight:600}}>Side effects today</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {SIDE_FX.map(fx=>{const active=pepData.sideEffects.includes(fx);return(
                <button key={fx} onClick={()=>toggleSideFx(fx)} style={{padding:"6px 12px",borderRadius:999,border:`1px solid ${active?"var(--c-danger)":"var(--line-soft)"}`,background:active?"color-mix(in oklch, var(--c-danger) 14%, transparent)":"var(--elev-1)",color:active?"var(--c-danger)":"var(--t-3)",fontSize:11.5,cursor:"pointer",fontWeight:active?600:500,transition:"all .2s var(--ease-out)"}}>{fx}</button>
              );})}
            </div>
            {pepData.sideEffects.length>0&&<div style={{fontSize:11,color:"var(--c-danger)",marginTop:8,fontStyle:"italic"}}>Logged: {pepData.sideEffects.join(", ")}</div>}
          </div>

          {/* Other peptides */}
          {(notDue.length>0)&&(<div style={{marginTop:18}}>
            <button onClick={()=>setShowOther(!showOther)} className="touch" style={{background:"none",border:"none",color:"var(--t-3)",fontSize:11.5,cursor:"pointer",padding:"6px 0",display:"inline-flex",alignItems:"center",gap:6}}>
              {notDue.filter(p=>p.status!=="break"&&p.status!=="starting").length} not due · {notDue.filter(p=>p.status==="break").length} on break · {notDue.filter(p=>p.status==="starting").length} upcoming
              <Icon n={showOther?"chevUp":"chevDown"} s={14}/>
            </button>
            {showOther&&(<div className="sheet" style={{marginTop:8}}>
              {notDue.map(p=>(<div key={p.id} style={{padding:"7px 0",fontSize:11.5,color:"var(--t-4)",borderBottom:"1px solid var(--line-soft)",display:"flex",alignItems:"center",gap:8}}>
                {p.status==="break"?<Icon n="pause" s={11} c="var(--t-4)"/>:p.status==="starting"?<Icon n="calendar" s={11} c="var(--t-4)"/>:null}
                <span>{p.name}</span><span style={{color:"var(--t-5)"}}>· {p.note}</span>
              </div>))}
            </div>)}
          </div>)}
        </>)}

        {pepSub==="all"&&(<>
          <H2 sub={`${userPeps.filter(p=>p.status==="active"||p.status==="prn").length} running`}>Active stack</H2>
          {userPeps.filter(p=>p.status==="active"||p.status==="prn").map((p,i)=>{
            /* Compute current cycle week from start_date instead of stale p.week field */
            const weekNow=p.startDate?Math.max(0,Math.floor((Date.now()-new Date(p.startDate+"T12:00:00").getTime())/(7*24*60*60*1000))+1):0;
            const cyclePct=p.totalWeeks>0?Math.min(100,(weekNow/p.totalWeeks)*100):0;
            /* Compute live supply from current batch — replaces stale dosesLeft/daysSupply/supplyNote */
            const inv=inventoryFor(p);
            const daysSupply=inv?.daysSupply;
            const dosesLeft=inv?.dosesRemaining;
            const supplyNote=inv?`${inv.dosesRemaining}/${inv.totalDosesInVial} doses left · live`:null;
            const supplyColor=daysSupply==null?"var(--t-4)":daysSupply<=4?"var(--c-danger)":daysSupply<=14?"var(--c-warn)":"var(--c-success)";
            const daysToEnd=p.cycleEnd?Math.max(0,Math.round((new Date(p.cycleEnd)-new Date())/(1000*60*60*24))):null;
            return(<div key={p.id} className="rise" style={{animationDelay:`${i*0.04}s`,background:"var(--elev-1)",borderLeft:`3px solid ${p.color}`,borderRadius:"var(--r-sm)",padding:"14px 16px",marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:15,fontWeight:600,color:p.color}}>{p.name}</span>
                <div style={{display:"flex",gap:5,alignItems:"center"}}>
                  {p.totalWeeks>0&&<span className="mono" style={{fontSize:10,color:"var(--t-3)",background:"var(--elev-2)",padding:"3px 9px",borderRadius:999,letterSpacing:".02em"}}>Wk {weekNow}/{p.totalWeeks}</span>}
                  {p.status==="prn"&&<span style={{fontSize:10,color:"var(--c-warn)",background:"color-mix(in oklch, var(--c-warn) 14%, transparent)",padding:"3px 9px",borderRadius:999,fontWeight:600,letterSpacing:".06em"}}>PRN</span>}
                  <button onClick={()=>setEditPepModal(p)} className="touch" aria-label={`Edit ${p.name}`} style={{width:28,height:28,borderRadius:8,border:"1px solid var(--line-soft)",background:"var(--elev-2)",color:"var(--t-3)",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",padding:0}}><Icon n="edit" s={13}/></button>
                </div>
              </div>
              <div className="mono" style={{fontSize:12,color:"var(--t-2)",letterSpacing:".01em"}}>{p.dose}</div>
              <div style={{fontSize:11.5,color:"var(--t-3)",marginTop:3}}>{p.time}{p.note?` · ${p.note}`:""}</div>
              <div style={{fontSize:11,color:"var(--t-4)",marginTop:6,lineHeight:1.5,paddingLeft:10,borderLeft:`1.5px solid color-mix(in oklch, ${p.color} 30%, transparent)`,fontStyle:"italic"}}>{p.purpose}</div>
              {/* ═══ Pharmacokinetics + shelf life info chips ═══
                  - Half-life: from PHARMACOKINETICS map (intrinsic to molecule)
                  - Shelf life: from RECONSTITUTION.stabilityDays (post-recon storage window)
                  - Active batch: most recent non-exhausted batch for this peptide; shows days-to-expiry
                  All three are tooltip-style — small, color-muted, on one row. */}
              {(()=>{
                const pk = PHARMACOKINETICS[p.id];
                const recon = RECONSTITUTION[p.id];
                /* Find the active batch — most recently reconstituted, not exhausted */
                const activeBatch = batches
                  .filter(b => b.peptide_id === p.id && !b.exhausted)
                  .sort((a,b) => b.date_recon.localeCompare(a.date_recon))[0];
                const batchStat = activeBatch ? batchStatus_pure(activeBatch) : null;
                if (!pk && !recon?.stabilityDays && !batchStat) return null;
                return (<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                  {pk?.halfLifeNote && (
                    <span title={pk.dosingImplication} className="mono" style={{fontSize:10,color:"var(--t-3)",background:"var(--elev-2)",padding:"3px 8px",borderRadius:999,letterSpacing:".02em",border:"1px solid var(--line-soft)"}}>
                      t½ · {pk.halfLifeNote}
                    </span>
                  )}
                  {recon?.stabilityDays && (
                    <span className="mono" style={{fontSize:10,color:"var(--t-3)",background:"var(--elev-2)",padding:"3px 8px",borderRadius:999,letterSpacing:".02em",border:"1px solid var(--line-soft)"}}>
                      shelf · ~{recon.stabilityDays}d post-recon
                    </span>
                  )}
                  {batchStat && (
                    <span className="mono" style={{fontSize:10,color:batchStat.color,background:`color-mix(in oklch, ${batchStat.color} 10%, transparent)`,padding:"3px 8px",borderRadius:999,letterSpacing:".02em",border:`1px solid color-mix(in oklch, ${batchStat.color} 35%, transparent)`,fontWeight:600}}>
                      current batch · {batchStat.label}
                    </span>
                  )}
                </div>);
              })()}
              {p.totalWeeks>0&&(<div style={{marginTop:10}}>
                <div className="mono" style={{display:"flex",justifyContent:"space-between",fontSize:9.5,color:"var(--t-3)",marginBottom:4,letterSpacing:".06em",textTransform:"uppercase"}}><span>Cycle</span><span>{daysToEnd!==null?`${daysToEnd}d left`:""}</span></div>
                <div className="hbar" style={{height:3}}><i style={{width:`${cyclePct}%`,background:p.color,opacity:.6}}/></div>
              </div>)}
              {inv&&(<div style={{marginTop:8}}>
                <div className="mono" style={{display:"flex",justifyContent:"space-between",fontSize:9.5,color:"var(--t-3)",marginBottom:4,letterSpacing:".06em",textTransform:"uppercase"}}><span>Supply</span><span style={{color:supplyColor,fontWeight:600}}>{dosesLeft} doses · {daysSupply}d</span></div>
                <div className="hbar" style={{height:3}}><i style={{width:`${Math.min(100,(daysSupply||0)/30*100)}%`,background:supplyColor,opacity:.55}}/></div>
                <div style={{fontSize:10.5,color:"var(--t-4)",marginTop:5,fontStyle:"italic"}}>{supplyNote}</div>
              </div>)}
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:9}}>
                {daysSupply!=null&&daysSupply<=21&&<button onClick={()=>setReorderModal({...p,daysSupply,dosesLeft,supplyNote})} className="touch" style={{padding:"6px 12px",borderRadius:999,border:`1px solid ${supplyColor}`,background:`color-mix(in oklch, ${supplyColor} 12%, transparent)`,color:supplyColor,fontSize:11,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}><Icon n="vial" s={11} c={supplyColor} sw={1.7}/> Reorder</button>}
                {RECONSTITUTION[p.id]&&<button onClick={()=>setReconGuide(p)} className="touch" style={{padding:"6px 12px",borderRadius:999,border:`1px solid ${p.color}`,background:`color-mix(in oklch, ${p.color} 10%, transparent)`,color:p.color,fontSize:11,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}><Icon n="vial" s={11} c={p.color} sw={1.7}/> Recon guide</button>}
                <a href={pgUrlFor(p.id)} target="_blank" rel="noopener noreferrer" className="touch" style={{padding:"6px 12px",borderRadius:999,border:"1px solid var(--line-soft)",background:"var(--elev-2)",color:"var(--t-3)",fontSize:11,fontWeight:600,cursor:"pointer",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}>📚 PG Guide →</a>
              </div>
            </div>);
          })}

          {userPeps.filter(p=>p.status==="starting").length>0&&<>
            <H2>Starting soon</H2>
            {userPeps.filter(p=>p.status==="starting").map(p=>{const inv=inventoryFor(p);return(<div key={p.id} className="rise" style={{background:"var(--elev-1)",borderLeft:`3px solid ${p.color}`,borderRadius:"var(--r-sm)",padding:"13px 16px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:14,fontWeight:600,color:p.color}}>{p.name}</span>
                <div style={{display:"flex",gap:5,alignItems:"center"}}>
                  {inv&&<span className="mono" style={{fontSize:10.5,color:"var(--t-3)"}}>{inv.dosesRemaining} doses ready</span>}
                  <button onClick={()=>setEditPepModal(p)} className="touch" aria-label={`Edit ${p.name}`} style={{width:26,height:26,borderRadius:7,border:"1px solid var(--line-soft)",background:"var(--elev-2)",color:"var(--t-3)",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",padding:0}}><Icon n="edit" s={12}/></button>
                </div>
              </div>
              <div className="mono" style={{fontSize:12,color:"var(--t-2)",marginTop:3}}>{p.dose}</div>
              <div style={{fontSize:11,color:"var(--t-3)",marginTop:2}}>{p.note}</div>
              <div style={{fontSize:11,color:"var(--t-4)",marginTop:5,lineHeight:1.5,fontStyle:"italic"}}>{p.purpose}</div>
            </div>);})}
          </>}

          {userPeps.filter(p=>p.status==="break").length>0&&<>
            <H2>On break</H2>
            {userPeps.filter(p=>p.status==="break").map(p=>{const inv=inventoryFor(p);return(<div key={p.id} className="rise" style={{background:"var(--elev-1)",borderRadius:"var(--r-sm)",padding:"11px 16px",marginBottom:6,opacity:.6}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,color:"var(--t-2)",display:"inline-flex",alignItems:"center",gap:6}}><Icon n="pause" s={12} c="var(--t-4)"/> {p.name}</span>
                <div style={{display:"flex",gap:5,alignItems:"center"}}>
                  {inv&&<span className="mono" style={{fontSize:10,color:"var(--t-4)"}}>{inv.dosesRemaining} ready</span>}
                  <button onClick={()=>setEditPepModal(p)} className="touch" aria-label={`Edit ${p.name}`} style={{width:24,height:24,borderRadius:6,border:"1px solid var(--line-soft)",background:"var(--elev-2)",color:"var(--t-4)",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",padding:0}}><Icon n="edit" s={11}/></button>
                </div>
              </div>
              <div style={{fontSize:11.5,color:"var(--t-4)",marginTop:3}}>{p.note}</div>
            </div>);})}
          </>}
        </>)}

        {pepSub==="batches"&&(<>
          <div className="rise" style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14}}>
            <div><h2 className="serif" style={{fontSize:24,fontWeight:400,color:"var(--t-1)",margin:0,fontStyle:"italic",letterSpacing:"-0.015em"}}>Reconstitution log</h2><p className="mono" style={{fontSize:11,color:"var(--t-3)",margin:"2px 0 0"}}>{batches.length} vial{batches.length!==1?"s":""} · shared with household</p></div>
            {!addingBatch&&<button onClick={()=>setAddingBatch(true)} className="touch" style={{padding:"9px 14px",borderRadius:"var(--r-sm)",border:"1px solid var(--accent-line)",background:"var(--accent-soft)",color:"var(--accent)",fontSize:12.5,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}><Icon n="vial" s={14}/> New batch</button>}
          </div>

          {batchesLoading&&<SkelTab/>}

          {/* Add batch form */}
          {addingBatch&&(<div className="sheet" style={{background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:18,marginBottom:16,borderLeft:"3px solid var(--accent)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14,alignItems:"baseline"}}>
              <h3 className="serif" style={{fontSize:20,fontWeight:400,color:"var(--accent)",margin:0,fontStyle:"italic"}}>New batch</h3>
              <button onClick={()=>{setAddingBatch(false);setNewBatch({peptide_id:"",date_recon:todayKey(),mg_total:"",ml_bac:"",storage:"",expiry_date:"",notes:""});}} className="touch" style={{background:"none",border:"none",color:"var(--t-3)",cursor:"pointer",padding:4}}><Icon n="x" s={16}/></button>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:"var(--t-3)",marginBottom:5,fontWeight:600,letterSpacing:".10em",textTransform:"uppercase"}}>Peptide</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{userPeps.map(p=>(<button key={p.id} onClick={()=>{const rec=recommendedReconFor(p.id);const stab=RECONSTITUTION[p.id]?.stabilityDays;setNewBatch({...newBatch,peptide_id:p.id,mg_total:rec?.vial?String(rec.vial):newBatch.mg_total,ml_bac:rec?.bac?String(rec.bac):newBatch.ml_bac,expiry_date:stab?addDays(newBatch.date_recon,stab):newBatch.expiry_date});}} className="touch" style={{padding:"7px 11px",borderRadius:999,border:newBatch.peptide_id===p.id?`1px solid ${p.color}`:"1px solid var(--line-soft)",background:newBatch.peptide_id===p.id?`color-mix(in oklch, ${p.color} 14%, transparent)`:"var(--elev-2)",color:newBatch.peptide_id===p.id?p.color:"var(--t-3)",fontSize:11.5,fontWeight:500,cursor:"pointer"}}>{p.name}</button>))}</div>
              {newBatch.peptide_id&&recommendedReconFor(newBatch.peptide_id)&&(()=>{const rec=recommendedReconFor(newBatch.peptide_id);const r=RECONSTITUTION[newBatch.peptide_id];const stab=r?.stabilityDays;return(<div style={{marginTop:10,padding:"10px 12px",background:"var(--accent-soft)",borderLeft:"3px solid var(--accent)",borderRadius:"var(--r-sm)",fontSize:11.5,color:"var(--t-2)",lineHeight:1.5}}>
                <div className="mono" style={{fontSize:9.5,color:"var(--accent)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:700,marginBottom:3}}>Recommended for {r.label}</div>
                {rec.vial?<><strong>{rec.vial}mg vial + {rec.bac}mL BAC → {rec.conc}mg/mL.</strong> {rec.note}.</>:rec.note}
                {stab&&<div style={{fontSize:10.5,color:"var(--t-3)",marginTop:4}}>Stability: {stab} day{stab!==1?"s":""} after reconstitution</div>}
                <button type="button" onClick={()=>setReconGuide({id:newBatch.peptide_id,name:r.label})} style={{background:"none",border:"none",color:"var(--accent)",fontSize:11,fontWeight:600,cursor:"pointer",padding:"4px 0 0",textDecoration:"underline"}}>See full guide →</button>
              </div>);})()}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div>
                <div style={{fontSize:10,color:"var(--t-3)",marginBottom:5,fontWeight:600,letterSpacing:".10em",textTransform:"uppercase"}}>Mixed on</div>
                <input type="date" value={newBatch.date_recon} onChange={e=>setNewBatch({...newBatch,date_recon:e.target.value})} className="bcq-input" style={{colorScheme:"dark"}}/>
              </div>
              <div>
                <div style={{fontSize:10,color:"var(--t-3)",marginBottom:5,fontWeight:600,letterSpacing:".10em",textTransform:"uppercase"}}>Expires</div>
                <input type="date" value={newBatch.expiry_date||addDays(newBatch.date_recon,30)} onChange={e=>setNewBatch({...newBatch,expiry_date:e.target.value})} className="bcq-input" style={{colorScheme:"dark"}}/>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div>
                <div style={{fontSize:10,color:"var(--accent)",marginBottom:5,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>Vial · mg</div>
                <input type="number" step="0.1" value={newBatch.mg_total} onChange={e=>setNewBatch({...newBatch,mg_total:e.target.value})} placeholder="10" className="bcq-input serif" style={{textAlign:"center",fontSize:22,padding:"12px 6px",fontStyle:"italic"}}/>
              </div>
              <div>
                <div style={{fontSize:10,color:"var(--accent)",marginBottom:5,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>BAC · mL</div>
                <input type="number" step="0.1" value={newBatch.ml_bac} onChange={e=>setNewBatch({...newBatch,ml_bac:e.target.value})} placeholder="2" className="bcq-input serif" style={{textAlign:"center",fontSize:22,padding:"12px 6px",fontStyle:"italic"}}/>
              </div>
            </div>
            {newBatch.mg_total&&newBatch.ml_bac&&(<div className="fade" style={{textAlign:"center",padding:"10px",background:"var(--accent-soft)",borderRadius:"var(--r-sm)",marginBottom:12}}>
              <span className="mono" style={{fontSize:11,color:"var(--t-3)"}}>Concentration </span>
              <span className="serif" style={{fontSize:22,color:"var(--accent)",fontStyle:"italic"}}>{(+newBatch.mg_total/+newBatch.ml_bac).toFixed(2)}</span>
              <span className="mono" style={{fontSize:11,color:"var(--t-3)"}}> mg/mL · 1u = </span>
              <span className="mono" style={{fontSize:13,color:"var(--accent)",fontWeight:600}}>{(+newBatch.mg_total/+newBatch.ml_bac/100).toFixed(3)} mg</span>
            </div>)}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:"var(--t-3)",marginBottom:5,fontWeight:600,letterSpacing:".10em",textTransform:"uppercase"}}>Storage</div>
              <input value={newBatch.storage} onChange={e=>setNewBatch({...newBatch,storage:e.target.value})} placeholder="Main fridge, top shelf" className="bcq-input"/>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:"var(--t-3)",marginBottom:5,fontWeight:600,letterSpacing:".10em",textTransform:"uppercase"}}>Notes</div>
              <input value={newBatch.notes} onChange={e=>setNewBatch({...newBatch,notes:e.target.value})} placeholder="Lot number, vendor, etc." className="bcq-input"/>
            </div>
            <button onClick={saveBatch} disabled={!newBatch.peptide_id||!newBatch.mg_total||!newBatch.ml_bac} className="touch" style={{width:"100%",padding:"14px",borderRadius:"var(--r-md)",border:"none",background:newBatch.peptide_id&&newBatch.mg_total&&newBatch.ml_bac?"var(--t-1)":"var(--elev-2)",color:newBatch.peptide_id&&newBatch.mg_total&&newBatch.ml_bac?"var(--bg)":"var(--t-4)",fontSize:14,fontWeight:600,cursor:"pointer"}}>Save batch</button>
          </div>)}

          {/* Empty state */}
          {!batchesLoading&&batches.length===0&&!addingBatch&&<div style={{textAlign:"center",padding:"48px 0",color:"var(--t-4)",fontSize:13}}><Icon n="vial" s={28} c="var(--t-5)"/><div style={{marginTop:10}}>No batches logged</div><div style={{fontSize:11,color:"var(--t-5)",marginTop:3,maxWidth:300,marginLeft:"auto",marginRight:"auto"}}>Track each vial's concentration and expiry. Today's checklist shows active batch info inline.</div></div>}

          {/* Batch list grouped by peptide */}
          {!batchesLoading&&batches.length>0&&(<>{userPeps.map(p=>{const peptideBatches=batches.filter(b=>b.peptide_id===p.id);if(peptideBatches.length===0)return null;return(<div key={p.id} className="rise" style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{width:6,height:6,borderRadius:3,background:p.color,flexShrink:0}}/>
              <span style={{fontSize:13.5,fontWeight:600,color:p.color}}>{p.name}</span>
              <span className="mono" style={{fontSize:10,color:"var(--t-4)",letterSpacing:".04em"}}>{peptideBatches.length} batch{peptideBatches.length!==1?"es":""}</span>
            </div>
            {peptideBatches.map(b=>{const stat=batchStatus(b);const conc=concentration(b);const isEdit=editingBatch===b.id;const creatorName=PROFILES[b.user_id]?.name||b.user_id;const isCreator=b.user_id===userId;const liveInv=(()=>{const mgPerDose=mgFromDoseStr(p.dose);if(!mgPerDose||!b.mg_total)return null;const totalDoses=Math.floor(b.mg_total/mgPerDose);const used=sharedDoseLog.filter(d=>d.date>=b.date_recon&&(!b.exhausted||d.date<=(b.exhausted_date||"9999"))&&d.checks&&d.checks[p.id]).length;return{total:totalDoses,used,remaining:Math.max(0,totalDoses-used)};})();return(<div key={b.id} style={{background:"var(--elev-1)",borderLeft:`3px solid ${stat.color}`,borderRadius:"var(--r-sm)",padding:"12px 14px",marginBottom:6,opacity:b.exhausted?0.55:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6,gap:8,flexWrap:"wrap"}}>
                <div style={{display:"flex",gap:7,alignItems:"baseline",flexWrap:"wrap"}}>
                  <span className="mono" style={{fontSize:11,color:"var(--t-2)",letterSpacing:".02em"}}>{new Date(b.date_recon+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"})}</span>
                  <span className="mono" style={{fontSize:9,color:isCreator?"var(--accent)":"var(--t-4)",background:isCreator?"var(--accent-soft)":"var(--elev-2)",padding:"1px 6px",borderRadius:999,letterSpacing:".06em",fontWeight:600}}>{isCreator?"YOU":creatorName.toUpperCase()}</span>
                </div>
                <span className="mono" style={{fontSize:10.5,color:stat.color,fontWeight:600,letterSpacing:".04em"}}>{stat.label}</span>
              </div>
              <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:6}}>
                <span className="serif tabular" style={{fontSize:26,color:"var(--t-1)",fontStyle:"italic",lineHeight:1}}>{conc}</span>
                <span className="mono" style={{fontSize:11,color:"var(--t-3)"}}>mg/mL · {b.mg_total}mg in {b.ml_bac}mL · 1u = {(conc/100).toFixed(3)}mg</span>
              </div>
              {liveInv&&!b.exhausted&&(<div style={{marginBottom:6,padding:"6px 9px",background:"var(--elev-2)",borderRadius:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span className="mono" style={{fontSize:10,color:"var(--t-3)",letterSpacing:".06em",textTransform:"uppercase",fontWeight:600}}>Shared inventory</span>
                <span style={{display:"flex",alignItems:"baseline",gap:5}}>
                  <span className="serif tabular" style={{fontSize:18,color:liveInv.remaining<=2?"var(--c-warn)":"var(--t-1)",fontStyle:"italic",lineHeight:1}}>{liveInv.remaining}</span>
                  <span className="mono" style={{fontSize:10,color:"var(--t-4)"}}>of {liveInv.total} doses left · {liveInv.used} taken</span>
                </span>
              </div>)}
              {b.storage&&<div style={{fontSize:11,color:"var(--t-3)",marginBottom:4}}>📍 {b.storage}</div>}
              {b.notes&&<div style={{fontSize:11,color:"var(--t-4)",fontStyle:"italic",marginBottom:4}}>{b.notes}</div>}
              {!b.exhausted&&isPastPGStability(b)&&(()=>{const r=RECONSTITUTION[b.peptide_id];const days=daysSinceRecon(b);return(<div style={{marginTop:6,padding:"7px 10px",background:"color-mix(in oklch, var(--c-warn) 10%, transparent)",borderLeft:"2px solid var(--c-warn)",borderRadius:6,fontSize:10.5,color:"var(--c-warn)",lineHeight:1.45}}>
                <strong>⚠ Past PG-documented stability.</strong> Reconstituted {days} days ago — recommended window for {r.label} is {r.stabilityDays} days. Consider mixing a fresh batch.
              </div>);})()}
              <div style={{display:"flex",gap:10,marginTop:8,flexWrap:"wrap"}}>
                <button onClick={()=>updateBatch(b,{exhausted:!b.exhausted})} className="touch" style={{fontSize:11,color:b.exhausted?"var(--accent)":"var(--t-3)",background:"none",border:"none",cursor:"pointer",padding:"4px 0",display:"inline-flex",alignItems:"center",gap:4}}>
                  <Icon n={b.exhausted?"plus":"check"} s={12}/> Mark {b.exhausted?"active":"exhausted"}
                </button>
                <button onClick={()=>deleteBatch(b)} className="touch" style={{fontSize:11,color:"var(--c-danger)",background:"none",border:"none",cursor:"pointer",padding:"4px 0",display:"inline-flex",alignItems:"center",gap:4}}>
                  <Icon n="trash" s={12}/> Delete
                </button>
              </div>
            </div>);})}
          </div>);})}</>)}
        </>)}

        {pepSub==="history"&&(<>
          {pepHist.length===0?<div style={{textAlign:"center",padding:"48px 0",color:"var(--t-4)",fontSize:13}}><Icon n="calendar" s={28} c="var(--t-5)"/><div style={{marginTop:10}}>No history yet</div></div>:(<>
            {pepHist.map((d,i)=>{
              const lb=new Date(d.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
              const checks=d.checks||{};
              const ids=Object.keys(checks);
              const dow=new Date(d.date+"T12:00:00").getDay();
              const dueCount=userPeps.filter(p=>(p.status==="active"||p.status==="prn")&&p.schedule.includes(dow)).length;
              const adherence=dueCount>0?Math.round(ids.length/dueCount*100):0;
              const sf=d.sideEffects||[];
              const adColor=adherence>=80?"var(--c-success)":adherence>=50?"var(--c-warn)":"var(--c-danger)";
              return(<div key={i} className="rise" style={{animationDelay:`${i*0.03}s`,background:"var(--elev-1)",borderRadius:"var(--r-sm)",padding:"14px 16px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                  <span style={{fontSize:13,fontWeight:600,color:"var(--t-1)"}}>{lb}</span>
                  <div style={{display:"flex",gap:8,alignItems:"baseline"}}>
                    <span className="serif tabular" style={{fontSize:20,color:adColor,fontStyle:"italic"}}>{adherence}<span style={{fontSize:12}}>%</span></span>
                    <span className="mono" style={{fontSize:10.5,color:"var(--t-4)"}}>{ids.length}/{dueCount}</span>
                  </div>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {ids.map(id=>{const p=userPeps.find(x=>x.id===id);const c=checks[id];const timeStr=typeof c==="string"?c:(c?.time||"");const doseStr=typeof c==="object"&&c?.dose?` ${c.dose}`:"";return p?(<span key={id} className="mono" style={{fontSize:10.5,color:p.color,background:`color-mix(in oklch, ${p.color} 14%, transparent)`,padding:"3px 9px",borderRadius:999,letterSpacing:".01em"}}>{p.name} {timeStr}{doseStr}</span>):null;})}
                </div>
                {sf.length>0&&<div style={{fontSize:11,color:"var(--c-danger)",marginTop:6,display:"inline-flex",alignItems:"center",gap:5,fontStyle:"italic"}}><Icon n="warn" s={11} c="var(--c-danger)" sw={2}/> {sf.join(", ")}</div>}
              </div>);
            })}
          </>)}
        </>)}
      </>)}

      {/* ═══ PROJECTION ═══ */}
      {tab==="projection"&&(<>
        <H2 sub="3 scenarios from your current scan">Timeline to {goalPct}%</H2>
        <div style={{display:"flex",gap:8,marginBottom:22,flexWrap:"wrap"}}>{etaMonths.map((s,i)=>(<div key={i} className="rise" style={{animationDelay:`${i*0.06}s`,flex:"1 1 92px",background:"var(--elev-1)",borderLeft:`3px solid ${s.color}`,borderRadius:"var(--r-sm)",padding:"14px 12px",textAlign:"center"}}>
          <div style={{fontSize:9.5,color:"var(--t-3)",textTransform:"uppercase",letterSpacing:".10em",marginBottom:6,fontWeight:600}}>{s.name}</div>
          <div className="serif tabular" style={{fontSize:38,color:s.color,fontStyle:"italic",lineHeight:.95}}>{s.months}<span style={{fontSize:14,color:"var(--t-3)",marginLeft:1}}>mo</span></div>
          <div className="mono" style={{fontSize:10,color:"var(--t-4)",marginTop:4,letterSpacing:".01em"}}>{s.rate} kg / mo</div>
        </div>))}</div>
        <div className="rise r4" style={cBox}><ResponsiveContainer width="100%" height={260}>
          <LineChart data={projections} margin={{top:10,right:14,left:4,bottom:0}}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--line-soft)" vertical={false}/>
            <XAxis dataKey="label" tick={{fill:"var(--t-3)",fontSize:9,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false}/>
            <YAxis domain={[Math.min(goalPct-2,26),40]} allowDecimals={false} tick={{fill:"var(--t-3)",fontSize:10,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false} width={34}/>
            <Tooltip content={<Tip/>}/>
            <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:11,color:"var(--t-3)",fontFamily:"Geist Mono",paddingTop:4}}/>
            <ReferenceLine y={goalPct} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth={1.5} strokeOpacity={0.6} label={{value:`${goalPct}% goal`,position:"insideBottomRight",fill:"var(--accent)",fontSize:10,fontFamily:"Geist Mono"}}/>
            {scenarios.map(s=>(<Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} name={s.name} dot={false} strokeDasharray={s.name==="On Track"?"0":"5 4"}/>))}
          </LineChart>
        </ResponsiveContainer></div>
      </>)}

      {/* ═══ MONTHLY ═══ */}
      {tab==="monthly"&&(<>
        <H2 sub="Average body fat by month">Monthly trend</H2>
        <div className="rise r2" style={cBox}><ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthly} margin={{top:10,right:14,left:4,bottom:0}}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--line-soft)" vertical={false}/>
            <XAxis dataKey="label" tick={{fill:"var(--t-3)",fontSize:9,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false}/>
            <YAxis domain={[Math.min(goalPct-2,30),48]} allowDecimals={false} tick={{fill:"var(--t-3)",fontSize:10,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false} width={34}/>
            <Tooltip content={<Tip/>}/>
            <ReferenceLine y={goalPct} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth={1.5} strokeOpacity={0.6} label={{value:`${goalPct}% goal`,position:"insideBottomRight",fill:"var(--accent)",fontSize:10,fontFamily:"Geist Mono"}}/>
            <Bar dataKey="avgPct" name="Avg Fat %" radius={[6,6,0,0]}>
              {monthly.map((m,i)=>(<Cell key={i} fill={m.avgPct<=38?"var(--c-success)":m.avgPct<=40?"var(--c-cal)":"var(--c-bodyfat)"} fillOpacity={0.72}/>))}
            </Bar>
          </BarChart>
        </ResponsiveContainer></div>
        <H2 sub="Month-by-month detail" delay={0.10}>Breakdown</H2>
        {monthly.map((m,i)=>{const prevM=i>0?monthly[i-1]:null;const fd=prevM?+(m.avgFat-prevM.avgFat).toFixed(1):null;return(<div key={i} className="rise" style={{animationDelay:`${i*0.04}s`,background:"var(--elev-1)",borderRadius:"var(--r-sm)",padding:"14px 16px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,alignItems:"baseline"}}>
            <span style={{fontSize:13.5,fontWeight:600,color:"var(--t-1)"}}>{m.label}</span>
            <span className="mono" style={{fontSize:10.5,color:"var(--t-3)"}}>{m.count} scan{m.count>1?"s":""}</span>
          </div>
          <div style={{display:"flex",gap:18,flexWrap:"wrap"}}>
            <div><div style={{fontSize:9,color:"var(--t-3)",letterSpacing:".06em",textTransform:"uppercase",fontWeight:600}}>Fat %</div><div className="serif tabular" style={{fontSize:20,color:"var(--c-bodyfat)",fontStyle:"italic"}}>{m.avgPct}</div></div>
            <div><div style={{fontSize:9,color:"var(--t-3)",letterSpacing:".06em",textTransform:"uppercase",fontWeight:600}}>Fat kg</div><div className="serif tabular" style={{fontSize:20,color:"var(--c-fat)",fontStyle:"italic"}}>{m.avgFat}</div></div>
            <div><div style={{fontSize:9,color:"var(--t-3)",letterSpacing:".06em",textTransform:"uppercase",fontWeight:600}}>Muscle</div><div className="serif tabular" style={{fontSize:20,color:"var(--c-muscle)",fontStyle:"italic"}}>{m.avgMuscle}</div></div>
            {fd!==null&&<div><div style={{fontSize:9,color:"var(--t-3)",letterSpacing:".06em",textTransform:"uppercase",fontWeight:600}}>Δ</div><div className="serif tabular" style={{fontSize:20,color:fd<=0?"var(--c-success)":"var(--c-danger)",fontStyle:"italic"}}>{fd>0?"+":""}{fd}</div></div>}
          </div>
        </div>);})}
      </>)}

      {/* ═══ WHOOP ═══ */}
      {tab==="whoop"&&whoopLoading&&<SkelTab/>}
      {tab==="whoop"&&!whoopLoading&&(<>
        <H2 sub={whoopConn?"Auto-synced from your Whoop account":"Log your daily Whoop metrics"}>Today's recovery</H2>

        {/* ═══ Connection bar ═══ */}
        <div className="rise" style={{background:whoopConn?"var(--accent-soft)":"var(--elev-1)",borderRadius:"var(--r-md)",padding:"12px 14px",marginBottom:16,border:whoopConn?"1px solid var(--accent-line)":"1px solid var(--line-soft)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <Icon n="whoop" s={18} c={whoopConn?"var(--accent)":"var(--t-3)"} sw={1.8}/>
            <div style={{flex:1,minWidth:0}}>
              {whoopConnLoading?(<span style={{fontSize:12,color:"var(--t-3)"}}>Checking connection…</span>):whoopConn?(<>
                <div style={{fontSize:12.5,color:"var(--t-1)",fontWeight:600}}>Whoop connected</div>
                <div style={{fontSize:10.5,color:"var(--t-3)",marginTop:2,fontFamily:"Geist Mono"}}>
                  {whoopConn.whoop_email||"account linked"}
                  {whoopConn.last_sync_at&&<> · synced {new Date(whoopConn.last_sync_at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</>}
                </div>
              </>):(<>
                <div style={{fontSize:12.5,color:"var(--t-2)",fontWeight:500}}>Connect to auto-sync</div>
                <div style={{fontSize:10.5,color:"var(--t-4)",marginTop:2}}>or enter manually below</div>
              </>)}
            </div>
            {whoopConn?(<div style={{display:"flex",gap:6}}>
              <button onClick={syncWhoop} disabled={whoopSyncing} className="touch" style={{padding:"7px 12px",borderRadius:"var(--r-sm)",border:"1px solid var(--accent)",background:"var(--accent)",color:"var(--bg)",fontSize:11.5,fontWeight:600,cursor:whoopSyncing?"wait":"pointer",opacity:whoopSyncing?0.6:1}}>{whoopSyncing?"Syncing…":"Sync now"}</button>
              <button onClick={disconnectWhoop} className="touch" style={{padding:"7px 10px",borderRadius:"var(--r-sm)",border:"1px solid var(--line-soft)",background:"transparent",color:"var(--t-3)",fontSize:11,cursor:"pointer"}}>Disconnect</button>
            </div>):(<button onClick={connectWhoop} className="touch" style={{padding:"7px 14px",borderRadius:"var(--r-sm)",border:"none",background:"var(--accent)",color:"var(--bg)",fontSize:12,fontWeight:600,cursor:"pointer"}}>Connect Whoop</button>)}
          </div>
          {whoopSyncMsg&&<div style={{marginTop:8,fontSize:11,color:whoopSyncMsg.startsWith("✓")?"var(--c-success)":"var(--c-danger)",fontFamily:"Geist Mono"}}>{whoopSyncMsg}</div>}
          {whoopConn&&whoopConn.last_sync_error&&!whoopSyncing&&<div style={{marginTop:8,fontSize:10.5,color:"var(--c-danger)",fontFamily:"Geist Mono",lineHeight:1.4}}>last error: {whoopConn.last_sync_error}</div>}
        </div>

        {whoopData?(<>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {[
              {k:"recovery",l:"Recovery",v:whoopData.recovery,u:"%",color:whoopData.recovery>=67?"var(--c-success)":whoopData.recovery>=34?"var(--c-warn)":"var(--c-danger)",icon:"heart"},
              {k:"sleep",l:"Sleep",v:whoopData.sleep,u:"%",color:whoopData.sleep>=85?"var(--c-success)":whoopData.sleep>=70?"var(--c-warn)":"var(--c-danger)",icon:"sleep"},
              {k:"strain",l:"Strain",v:whoopData.strain,u:"",color:whoopData.strain>=14?"var(--c-danger)":whoopData.strain>=8?"var(--c-warn)":"var(--c-carbs)",icon:"strain"},
            ].map((m,i)=>(<div key={m.k} className="rise" style={{animationDelay:`${i*0.06}s`,flex:1,background:"var(--elev-1)",borderLeft:`3px solid ${m.color}`,borderRadius:"var(--r-sm)",padding:"14px 8px",textAlign:"center"}}>
              <Icon n={m.icon} s={18} c={m.color} sw={1.7}/>
              <div className="serif tabular" style={{fontSize:32,color:m.color,marginTop:6,fontStyle:"italic",lineHeight:1}}>{m.v!=null?m.v:"—"}<span style={{fontSize:13,color:"var(--t-3)"}}>{m.v!=null?m.u:""}</span></div>
              <div style={{fontSize:10,color:"var(--t-3)",marginTop:4,letterSpacing:".08em",textTransform:"uppercase",fontWeight:600}}>{m.l}</div>
            </div>))}
          </div>
          {/* Secondary metrics from Whoop sync — HRV, RHR, sleep hours */}
          {(whoopData.hrv_ms||whoopData.rhr||whoopData.sleep_hours)&&(<div style={{display:"flex",gap:12,fontSize:11,color:"var(--t-3)",marginBottom:14,padding:"10px 14px",background:"var(--elev-1)",borderRadius:"var(--r-sm)",flexWrap:"wrap"}}>
            {whoopData.hrv_ms!=null&&<span><span className="mono" style={{color:"var(--t-1)",fontWeight:600}}>{whoopData.hrv_ms.toFixed(0)}</span> ms HRV</span>}
            {whoopData.rhr!=null&&<span><span className="mono" style={{color:"var(--t-1)",fontWeight:600}}>{whoopData.rhr}</span> bpm RHR</span>}
            {whoopData.sleep_hours!=null&&<span><span className="mono" style={{color:"var(--t-1)",fontWeight:600}}>{whoopData.sleep_hours}</span> h slept</span>}
            {whoopData.sleep_efficiency!=null&&<span><span className="mono" style={{color:"var(--t-1)",fontWeight:600}}>{whoopData.sleep_efficiency.toFixed(0)}%</span> efficient</span>}
          </div>)}
          {whoopData.source!=="whoop_sync"&&<button onClick={()=>{setWhoopData(null);setWhoopInput({recovery:"",sleep:"",strain:""});}} className="touch" style={{width:"100%",padding:"11px",borderRadius:"var(--r-sm)",border:"1px solid var(--line-soft)",background:"transparent",color:"var(--t-3)",fontSize:12,cursor:"pointer"}}>Edit today's entry</button>}
        </>):(
          <div className="rise" style={{background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:18,marginBottom:18}}>
            <div style={{fontSize:12,color:"var(--t-3)",marginBottom:14}}>{whoopConn?"No data for today yet. Tap Sync now above, or enter manually:":"From your Whoop app this morning:"}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
              {[
                {k:"recovery",l:"Recovery %",ph:"78",c:"var(--c-success)"},
                {k:"sleep",l:"Sleep %",ph:"85",c:"var(--c-carbs)"},
                {k:"strain",l:"Strain",ph:"12.4",c:"var(--c-warn)"},
              ].map(f=>(<div key={f.k}>
                <div style={{fontSize:10,color:f.c,marginBottom:5,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>{f.l}</div>
                <input type="number" step="0.1" value={whoopInput[f.k]} onChange={e=>setWhoopInput({...whoopInput,[f.k]:e.target.value})} placeholder={f.ph} className="bcq-input serif" style={{textAlign:"center",fontSize:24,padding:"14px 6px",fontStyle:"italic"}}/>
              </div>))}
            </div>
            <button onClick={()=>{if(!whoopInput.recovery&&!whoopInput.sleep&&!whoopInput.strain)return;const d={recovery:+(whoopInput.recovery||0),sleep:+(whoopInput.sleep||0),strain:+(whoopInput.strain||0)};saveWhoop(d);}} className="touch" style={{width:"100%",padding:"14px",borderRadius:"var(--r-md)",border:"none",background:"var(--t-1)",color:"var(--bg)",fontSize:14,fontWeight:600,cursor:"pointer"}}>Save</button>
          </div>
        )}

        <div className="rise r2" style={{background:"var(--elev-1)",borderRadius:"var(--r-sm)",padding:"12px 16px",marginBottom:18}}>
          <div style={{fontSize:9.5,color:"var(--t-3)",marginBottom:8,letterSpacing:".12em",textTransform:"uppercase",fontWeight:600}}>Quick guide</div>
          <div style={{fontSize:11.5,color:"var(--t-2)",lineHeight:1.7}}>
            <span style={{color:"var(--c-success)",fontWeight:600}}>Recovery 67%+</span> push hard · <span style={{color:"var(--c-warn)",fontWeight:600}}>34–66%</span> moderate · <span style={{color:"var(--c-danger)",fontWeight:600}}>&lt;34%</span> rest<br/>
            <span style={{color:"var(--c-carbs)",fontWeight:600}}>Sleep 85%+</span> great · <span style={{color:"var(--c-warn)",fontWeight:600}}>70–84%</span> ok · <span style={{color:"var(--c-danger)",fontWeight:600}}>&lt;70%</span> poor<br/>
            <span style={{color:"var(--c-warn)",fontWeight:600}}>Strain 14+</span> very high · <span style={{color:"var(--c-warn)",fontWeight:600}}>8–13</span> moderate · <span style={{color:"var(--c-carbs)",fontWeight:600}}>&lt;8</span> light
          </div>
        </div>

        {whoopHist.length>0&&(<>
          <H2 sub="Last 7 days">Trend</H2>
          <div className="rise r3" style={cBox}><ResponsiveContainer width="100%" height={190}>
            <LineChart data={whoopHist.slice(0,7).reverse()} margin={{top:10,right:14,left:4,bottom:0}}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--line-soft)" vertical={false}/>
              <XAxis dataKey="date" tickFormatter={d=>new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"narrow",day:"numeric"})} tick={{fill:"var(--t-3)",fontSize:9,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false}/>
              <YAxis domain={[0,100]} tick={{fill:"var(--t-3)",fontSize:10,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false} width={28}/>
              <Tooltip content={<Tip/>}/>
              <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:11,color:"var(--t-3)",fontFamily:"Geist Mono",paddingTop:4}}/>
              <Line type="monotone" dataKey="recovery" stroke="var(--c-success)" strokeWidth={2} name="Recovery" dot={{r:2.5}} activeDot={{r:4.5}}/>
              <Line type="monotone" dataKey="sleep" stroke="var(--c-carbs)" strokeWidth={2} name="Sleep" dot={{r:2.5}} activeDot={{r:4.5}}/>
            </LineChart>
          </ResponsiveContainer></div>

          <H2 sub="Daily entries">History</H2>
          {whoopHist.map((d,i)=>{const lb=new Date(d.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});const rc=d.recovery>=67?"var(--c-success)":d.recovery>=34?"var(--c-warn)":"var(--c-danger)";return(
            <div key={i} className="rise" style={{animationDelay:`${i*0.03}s`,display:"flex",gap:14,alignItems:"center",padding:"12px 0",borderBottom:i<whoopHist.length-1?"1px solid var(--line-soft)":"none"}}>
              <span style={{fontSize:11.5,color:"var(--t-2)",width:70,flexShrink:0,fontWeight:500}}>{lb}</span>
              <div className="mono" style={{display:"flex",gap:12,fontSize:12.5,letterSpacing:".01em"}}>
                <span style={{color:rc,fontWeight:600}}>{d.recovery}%</span>
                <span style={{color:"var(--c-carbs)"}}>{d.sleep}%</span>
                <span style={{color:"var(--c-warn)"}}>{d.strain}</span>
              </div>
            </div>
          );})}
        </>)}

        {whoopHist.length===0&&!whoopData&&<div style={{textAlign:"center",padding:"32px 0",color:"var(--t-4)",fontSize:13}}><Icon n="whoop" s={28} c="var(--t-5)"/><div style={{marginTop:10}}>Log to see trends</div></div>}
      </>)}

      {/* ═══ DATA — subtabs: scans / measurements / photos ═══ */}
      {tab==="data"&&(<>
        <div className="rise" style={{display:"flex",gap:6,marginTop:18,marginBottom:14,flexWrap:"wrap"}}>
          {[["scans","Scans"],["measurements","Measurements"],["photos","Photos"]].map(([k,l])=>(<TabBtn key={k} active={dataSub===k} onClick={()=>setDataSub(k)}>{l}</TabBtn>))}
        </div>

        {/* ─── SCANS subtab ─── */}
        {dataSub==="scans"&&(<>
          <div className="rise" style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14}}>
            <div><h2 className="serif" style={{fontSize:26,fontWeight:400,color:"var(--t-1)",margin:0,fontStyle:"italic",letterSpacing:"-0.015em"}}>All scans</h2><p className="mono" style={{fontSize:11,color:"var(--t-3)",margin:"2px 0 0"}}>{data.length} entries</p></div>
            {!showAddScan&&<button onClick={()=>setShowAddScan(true)} className="touch" style={{padding:"9px 14px",borderRadius:"var(--r-sm)",border:"1px solid var(--accent-line)",background:"var(--accent-soft)",color:"var(--accent)",fontSize:12.5,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}><Icon n="plus" s={14}/> Add scan</button>}
          </div>

          {showAddScan&&(<div className="sheet" style={{background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:18,marginBottom:16,borderLeft:"3px solid var(--accent)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14,alignItems:"baseline"}}>
              <h3 className="serif" style={{fontSize:20,fontWeight:400,color:"var(--accent)",margin:0,fontStyle:"italic"}}>New scan</h3>
              <button onClick={()=>setShowAddScan(false)} className="touch" style={{background:"none",border:"none",color:"var(--t-3)",cursor:"pointer",padding:4}}><Icon n="x" s={16}/></button>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:"var(--t-3)",marginBottom:5,fontWeight:600,letterSpacing:".10em",textTransform:"uppercase"}}>Date</div>
              <input type="date" value={newScan.date} onChange={e=>setNewScan({...newScan,date:e.target.value})} className="bcq-input" style={{colorScheme:"dark"}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
              {[{k:"weight",l:"Weight",c:"var(--c-weight)",ph:"54.1"},{k:"muscle",l:"Muscle",c:"var(--c-muscle)",ph:"18.0"},{k:"fatPct",l:"Fat %",c:"var(--c-bodyfat)",ph:"37.6"}].map(f=>(<div key={f.k}>
                <div style={{fontSize:10,color:f.c,marginBottom:5,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>{f.l}</div>
                <input type="number" step="0.1" value={newScan[f.k]} onChange={e=>setNewScan({...newScan,[f.k]:e.target.value})} placeholder={f.ph} className="bcq-input serif" style={{textAlign:"center",fontSize:22,padding:"12px 6px",fontStyle:"italic"}}/>
              </div>))}
            </div>
            {newScan.weight&&newScan.fatPct&&(<div className="fade" style={{textAlign:"center",padding:"10px",background:"var(--elev-2)",borderRadius:"var(--r-sm)",marginBottom:14}}>
              <span className="mono" style={{fontSize:11,color:"var(--t-3)"}}>Fat </span><span className="serif" style={{fontSize:18,color:"var(--c-bodyfat)",fontStyle:"italic"}}>{(+newScan.weight * +newScan.fatPct/100).toFixed(1)}</span><span className="mono" style={{fontSize:11,color:"var(--t-3)"}}>kg · Lean </span><span className="serif" style={{fontSize:18,color:"var(--c-muscle)",fontStyle:"italic"}}>{(+newScan.weight - +newScan.weight * +newScan.fatPct/100).toFixed(1)}</span><span className="mono" style={{fontSize:11,color:"var(--t-3)"}}>kg</span>
            </div>)}
            <button onClick={addScan} disabled={!newScan.weight||!newScan.fatPct} className="touch" style={{width:"100%",padding:"14px",borderRadius:"var(--r-md)",border:"none",background:newScan.weight&&newScan.fatPct?"var(--t-1)":"var(--elev-2)",color:newScan.weight&&newScan.fatPct?"var(--bg)":"var(--t-4)",fontSize:14,fontWeight:600,cursor:newScan.weight&&newScan.fatPct?"pointer":"default"}}>Save scan</button>
          </div>)}

          <div className="rise r2" style={{overflowX:"auto",borderRadius:"var(--r-md)",background:"var(--elev-1)"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}>
              <thead><tr style={{background:"var(--elev-2)"}}>{["Date","Wt","Musc","Fat %","Fat kg","M:F",""].map(h=>(<th key={h} className="mono" style={{padding:"10px 6px",textAlign:"right",color:"var(--t-3)",fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",fontSize:9.5,whiteSpace:"nowrap"}}>{h}</th>))}</tr></thead>
              <tbody>{data.map((d,i)=>{const isB=d.fatPct===best.fatPct;const isL=i===data.length-1;const isUser=userScans.some(s=>s.date===d.date);return(<tr key={i} style={{background:isB?"color-mix(in oklch, var(--c-success) 10%, transparent)":isL?"color-mix(in oklch, var(--accent) 8%, transparent)":i%2===0?"transparent":"oklch(1 0 0 / 0.012)"}}>
                <td className="mono" style={{padding:"8px 6px",textAlign:"right",color:"var(--t-2)",fontSize:10.5,whiteSpace:"nowrap"}}>{d.label}{isB?" ★":isL?" •":""}</td>
                <td className="mono tabular" style={{padding:"8px 6px",textAlign:"right",color:"var(--c-weight)",fontWeight:600}}>{d.weight}</td>
                <td className="mono tabular" style={{padding:"8px 6px",textAlign:"right",color:"var(--c-muscle)",fontWeight:600}}>{d.muscle}</td>
                <td className="mono tabular" style={{padding:"8px 6px",textAlign:"right",color:"var(--c-bodyfat)",fontWeight:600}}>{d.fatPct}</td>
                <td className="mono tabular" style={{padding:"8px 6px",textAlign:"right",color:"var(--t-3)"}}>{d.fatMass}</td>
                <td className="mono tabular" style={{padding:"8px 6px",textAlign:"right",color:(d.muscle/d.fatMass)>=0.9?"var(--c-success)":"var(--c-warn)"}}>{(d.muscle/d.fatMass).toFixed(2)}</td>
                <td style={{padding:"8px 4px",textAlign:"right"}}>{isUser&&<button onClick={()=>removeUserScan(d.date)} className="touch" style={{background:"none",border:"none",color:"var(--t-4)",cursor:"pointer",padding:4}}><Icon n="x" s={11}/></button>}</td>
              </tr>);})}</tbody>
            </table>
          </div>
          <div className="mono" style={{marginTop:8,fontSize:9.5,color:"var(--t-4)",letterSpacing:".04em"}}>★ best · • latest · × removable</div>
        </>)}

        {/* ─── MEASUREMENTS subtab ─── */}
        {dataSub==="measurements"&&(<>
          <div className="rise" style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14}}>
            <div><h2 className="serif" style={{fontSize:26,fontWeight:400,color:"var(--t-1)",margin:0,fontStyle:"italic",letterSpacing:"-0.015em"}}>Measurements</h2><p className="mono" style={{fontSize:11,color:"var(--t-3)",margin:"2px 0 0"}}>{measurements.length} entries · cm</p></div>
            {!addingMeas&&<button onClick={()=>setAddingMeas(true)} className="touch" style={{padding:"9px 14px",borderRadius:"var(--r-sm)",border:"1px solid var(--accent-line)",background:"var(--accent-soft)",color:"var(--accent)",fontSize:12.5,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}><Icon n="ruler" s={14}/> Log entry</button>}
          </div>

          {measLoading&&<SkelTab/>}

          {addingMeas&&(<div className="sheet" style={{background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:18,marginBottom:16,borderLeft:"3px solid var(--accent)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14,alignItems:"baseline"}}>
              <h3 className="serif" style={{fontSize:20,fontWeight:400,color:"var(--accent)",margin:0,fontStyle:"italic"}}>New entry</h3>
              <button onClick={()=>setAddingMeas(false)} className="touch" style={{background:"none",border:"none",color:"var(--t-3)",cursor:"pointer",padding:4}}><Icon n="x" s={16}/></button>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:"var(--t-3)",marginBottom:5,fontWeight:600,letterSpacing:".10em",textTransform:"uppercase"}}>Date</div>
              <input type="date" value={newMeas.date} onChange={e=>setNewMeas({...newMeas,date:e.target.value})} className="bcq-input" style={{colorScheme:"dark"}}/>
            </div>
            <p style={{fontSize:11,color:"var(--t-4)",margin:"0 0 12px",fontStyle:"italic"}}>All measurements in centimeters. Leave any field blank to skip it.</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
              {M_FIELDS.map(f=>(<div key={f.k}>
                <div style={{fontSize:10,color:f.c,marginBottom:5,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>{f.l} · cm</div>
                <input type="number" step="0.1" value={newMeas[f.k]} onChange={e=>setNewMeas({...newMeas,[f.k]:e.target.value})} placeholder="—" className="bcq-input serif" style={{textAlign:"center",fontSize:20,padding:"11px 6px",fontStyle:"italic"}}/>
              </div>))}
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:"var(--t-3)",marginBottom:5,fontWeight:600,letterSpacing:".10em",textTransform:"uppercase"}}>Notes</div>
              <input value={newMeas.notes} onChange={e=>setNewMeas({...newMeas,notes:e.target.value})} placeholder="Optional context" className="bcq-input"/>
            </div>
            <button onClick={saveMeas} disabled={!M_FIELDS.some(f=>newMeas[f.k])} className="touch" style={{width:"100%",padding:"14px",borderRadius:"var(--r-md)",border:"none",background:M_FIELDS.some(f=>newMeas[f.k])?"var(--t-1)":"var(--elev-2)",color:M_FIELDS.some(f=>newMeas[f.k])?"var(--bg)":"var(--t-4)",fontSize:14,fontWeight:600,cursor:"pointer"}}>Save</button>
          </div>)}

          {/* Trend chart — at least 2 entries needed */}
          {!measLoading&&measurements.length>=2&&(<>
            <div className="rise r2" style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>{M_FIELDS.map(f=>(<button key={f.k} onClick={()=>setTrendField(f.k)} style={{padding:"5px 11px",borderRadius:999,border:trendField===f.k?`1px solid ${f.c}`:"1px solid var(--line-soft)",background:trendField===f.k?`color-mix(in oklch, ${f.c} 14%, transparent)`:"transparent",color:trendField===f.k?f.c:"var(--t-3)",fontSize:11,cursor:"pointer",fontWeight:500}}>{f.l}</button>))}</div>
            <div className="rise r3" style={cBox}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={[...measurements].reverse().filter(m=>m[trendField]!=null)} margin={{top:10,right:14,left:4,bottom:0}}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--line-soft)" vertical={false}/>
                  <XAxis dataKey="date" tickFormatter={d=>new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} tick={{fill:"var(--t-3)",fontSize:9,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:"var(--t-3)",fontSize:10,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false} width={28} domain={["dataMin - 1","dataMax + 1"]}/>
                  <Tooltip content={<Tip/>}/>
                  <Line type="monotone" dataKey={trendField} stroke={M_FIELDS.find(f=>f.k===trendField).c} strokeWidth={2.2} name={M_FIELDS.find(f=>f.k===trendField).l} dot={{r:3,fill:M_FIELDS.find(f=>f.k===trendField).c,stroke:"var(--bg)",strokeWidth:1.5}} activeDot={{r:5}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>)}

          {/* Entries list */}
          {!measLoading&&measurements.length===0&&!addingMeas&&<div style={{textAlign:"center",padding:"48px 0",color:"var(--t-4)",fontSize:13}}><Icon n="ruler" s={28} c="var(--t-5)"/><div style={{marginTop:10}}>No measurements yet</div><div style={{fontSize:11,color:"var(--t-5)",marginTop:3}}>Log waist weekly for the cleanest fat-loss signal</div></div>}

          {!measLoading&&measurements.length>0&&(<div style={{marginTop:18}}>
            <div style={{fontSize:10.5,color:"var(--t-3)",letterSpacing:".12em",textTransform:"uppercase",fontWeight:600,marginBottom:10}}>Entries</div>
            {measurements.map((m,i)=>{const lb=new Date(m.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});const prevM=measurements[i+1];return(<div key={m.date} className="rise" style={{animationDelay:`${i*0.03}s`,background:"var(--elev-1)",borderRadius:"var(--r-sm)",padding:"12px 14px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:600,color:"var(--t-1)"}}>{lb}</span>
                <button onClick={()=>deleteMeas(m.date)} className="touch" style={{background:"none",border:"none",color:"var(--t-4)",cursor:"pointer",padding:4}}><Icon n="trash" s={13}/></button>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:14}}>{M_FIELDS.map(f=>m[f.k]!=null?(<div key={f.k}>
                <div className="mono" style={{fontSize:9,color:"var(--t-4)",letterSpacing:".06em",textTransform:"uppercase",fontWeight:600}}>{f.l}</div>
                <div className="serif tabular" style={{fontSize:18,color:f.c,fontStyle:"italic",lineHeight:1.1}}>{m[f.k]}{prevM&&prevM[f.k]!=null&&<span className="mono" style={{fontSize:10,color:m[f.k]<prevM[f.k]?"var(--c-success)":m[f.k]>prevM[f.k]?"var(--c-warn)":"var(--t-4)",marginLeft:4,fontStyle:"normal"}}>{m[f.k]<prevM[f.k]?"▼":m[f.k]>prevM[f.k]?"▲":"="}{Math.abs(+(m[f.k]-prevM[f.k]).toFixed(1))}</span>}</div>
              </div>):null)}</div>
              {m.notes&&<div style={{fontSize:11,color:"var(--t-3)",marginTop:8,fontStyle:"italic"}}>{m.notes}</div>}
            </div>);})}
          </div>)}
        </>)}

        {/* ─── PHOTOS subtab ─── */}
        {dataSub==="photos"&&(<>
          <div className="rise" style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14}}>
            <div><h2 className="serif" style={{fontSize:26,fontWeight:400,color:"var(--t-1)",margin:0,fontStyle:"italic",letterSpacing:"-0.015em"}}>Progress photos</h2><p className="mono" style={{fontSize:11,color:"var(--t-3)",margin:"2px 0 0"}}>{photos.length} · same pose, same light, weekly</p></div>
            <div style={{display:"flex",gap:6}}>
              {photos.length>=2&&<button onClick={()=>{setCompareMode(!compareMode);setCompareSel([]);}} className="touch" style={{padding:"9px 12px",borderRadius:"var(--r-sm)",border:`1px solid ${compareMode?"var(--accent)":"var(--line-soft)"}`,background:compareMode?"var(--accent-soft)":"var(--elev-1)",color:compareMode?"var(--accent)":"var(--t-3)",cursor:"pointer"}}><Icon n="compare" s={14}/></button>}
              <label className="touch" style={{padding:"9px 14px",borderRadius:"var(--r-sm)",border:"1px solid var(--accent-line)",background:"var(--accent-soft)",color:"var(--accent)",fontSize:12.5,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}>
                <Icon n="camera" s={14}/> Add
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoFile} style={{display:"none"}}/>
              </label>
            </div>
          </div>

          {photosLoading&&<SkelTab/>}

          {/* Compare bar */}
          {compareMode&&!compareSel.length&&<div className="rise" style={{background:"color-mix(in oklch, var(--accent) 8%, var(--elev-1))",borderLeft:"3px solid var(--accent)",borderRadius:"var(--r-sm)",padding:"10px 14px",marginBottom:12,fontSize:12,color:"var(--t-2)"}}>Tap two photos to compare</div>}
          {compareMode&&compareSel.length===2&&(<div className="rise" style={{marginBottom:14}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {compareSel.map((p,i)=>(<div key={p.id} style={{position:"relative"}}>
                <img src={p.url} alt={p.date} style={{width:"100%",aspectRatio:"3/4",objectFit:"cover",borderRadius:"var(--r-sm)",display:"block"}}/>
                <div className="mono" style={{position:"absolute",bottom:6,left:6,right:6,background:"oklch(0.1 0 0 / 0.6)",backdropFilter:"blur(8px)",borderRadius:6,padding:"4px 7px",fontSize:10,color:"var(--t-1)",letterSpacing:".04em"}}>{new Date(p.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"})}{p.pose?` · ${p.pose}`:""}</div>
              </div>))}
            </div>
            <div style={{textAlign:"center",fontSize:12,color:"var(--t-3)",marginTop:8,fontStyle:"italic"}}>{(()=>{const a=new Date(compareSel[0].date),b=new Date(compareSel[1].date);const diff=Math.round(Math.abs(b-a)/(1000*60*60*24));return `${diff} day${diff!==1?"s":""} apart`;})()}</div>
          </div>)}

          {/* Empty state */}
          {!photosLoading&&photos.length===0&&!photoUploadPreview&&<div style={{textAlign:"center",padding:"48px 0",color:"var(--t-4)",fontSize:13}}><Icon n="image" s={28} c="var(--t-5)"/><div style={{marginTop:10}}>No photos yet</div><div style={{fontSize:11,color:"var(--t-5)",marginTop:3}}>Weekly photos in the same pose are the highest-signal progress metric</div></div>}

          {/* Photo grid */}
          {!photosLoading&&photos.length>0&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:14}}>
            {photos.map((p,i)=>{const isSel=compareMode&&compareSel.some(x=>x.id===p.id);return(<div key={p.id} onClick={()=>compareMode?toggleCompareSel(p):setPhotoModal(p)} className="rise" style={{animationDelay:`${i*0.02}s`,position:"relative",cursor:"pointer",borderRadius:"var(--r-sm)",overflow:"hidden",aspectRatio:"3/4",border:isSel?"2px solid var(--accent)":"none"}}>
              <img src={p.url} alt={p.date} loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
              <div className="mono" style={{position:"absolute",bottom:4,left:4,right:4,background:"oklch(0.1 0 0 / 0.6)",backdropFilter:"blur(6px)",borderRadius:5,padding:"2px 5px",fontSize:9,color:"var(--t-1)",letterSpacing:".04em",textAlign:"center"}}>{new Date(p.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
              {isSel&&<div style={{position:"absolute",top:6,right:6,width:22,height:22,borderRadius:11,background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon n="check" s={14} c="var(--bg)" sw={2.5}/></div>}
            </div>);})}
          </div>)}
        </>)}
      </>)}

      <div className="mono" style={{marginTop:36,textAlign:"center",fontSize:9.5,color:"var(--t-5)",letterSpacing:".18em",textTransform:"uppercase"}}>Body Comp HQ</div>

      {/* ═══ BOTTOM NAV ═══ */}
      <nav className="bcq-nav">
        <div style={{display:"flex",justifyContent:"space-around",alignItems:"center",padding:"0 8px"}}>
          {navItems.map(n=>{const active=n.id==="more"?["data","projection","monthly"].includes(tab):tab===n.id;return(
            <button key={n.id} onClick={()=>{if(n.id==="more"){setShowMore(!showMore);}else{setTab(n.id);setShowMore(false);}}} className="touch" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"8px 10px",background:"none",border:"none",cursor:"pointer",position:"relative",color:active?"var(--accent)":"var(--t-4)",transition:"color .2s var(--ease-out)"}}>
              <Icon n={n.icon} s={22} sw={active?1.8:1.5}/>
              <span style={{fontSize:10,fontWeight:active?600:500,letterSpacing:".02em"}}>{n.label}</span>
              {active&&<span style={{position:"absolute",top:-4,width:4,height:4,borderRadius:2,background:"var(--accent)"}}/>}
            </button>
          );})}
        </div>
      </nav>

      {/* Reconstitution guide sheet — full per-peptide protocol */}
      {reconGuide&&(()=>{const r=RECONSTITUTION[reconGuide.id];if(!r)return null;const recommended=r.options.find(o=>o.recommended);const others=r.options.filter(o=>!o.recommended);return(
        <div onClick={()=>setReconGuide(null)} style={{position:"fixed",inset:0,zIndex:148,background:"oklch(0.05 0 0 / 0.78)",backdropFilter:"blur(10px)",display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"20px"}}>
          <div onClick={e=>e.stopPropagation()} className="sheet" style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:"var(--r-lg)",padding:18,maxWidth:480,width:"100%",maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{width:34,height:4,background:"var(--elev-3)",borderRadius:2,margin:"0 auto 14px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
              <h3 className="serif" style={{fontSize:26,fontWeight:400,color:"var(--t-1)",margin:0,fontStyle:"italic",letterSpacing:"-0.015em"}}>Reconstitution</h3>
              <button onClick={()=>setReconGuide(null)} className="touch" style={{background:"none",border:"none",color:"var(--t-3)",cursor:"pointer",padding:4}}><Icon n="x" s={18}/></button>
            </div>
            <div className="mono" style={{fontSize:11,color:"var(--t-3)",letterSpacing:".06em",textTransform:"uppercase",fontWeight:600,marginBottom:14}}>{r.label}</div>

            {r.preformulated&&<div style={{padding:"12px 14px",background:"var(--accent-soft)",borderLeft:"3px solid var(--accent)",borderRadius:"var(--r-sm)",fontSize:13,color:"var(--t-2)",marginBottom:14,lineHeight:1.55}}>{r.options[0].note}</div>}
            {r.topical&&<div style={{padding:"12px 14px",background:"color-mix(in oklch, var(--c-warn) 8%, transparent)",borderLeft:"3px solid var(--c-warn)",borderRadius:"var(--r-sm)",fontSize:12.5,color:"var(--t-2)",marginBottom:14,lineHeight:1.55}}>⚠️ Topical peptide — NOT injected. Follow the application protocol below.</div>}

            {/* Recommended option */}
            {recommended&&!r.preformulated&&(<div style={{background:"var(--accent-soft)",borderLeft:"3px solid var(--accent)",borderRadius:"var(--r-sm)",padding:"14px 16px",marginBottom:10}}>
              <div className="mono" style={{fontSize:9.5,color:"var(--accent)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:700,marginBottom:6}}>Recommended</div>
              {recommended.vial?(<><div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:6}}>
                <span className="serif tabular" style={{fontSize:26,color:"var(--accent)",fontStyle:"italic",lineHeight:1}}>{recommended.conc}</span>
                <span className="mono" style={{fontSize:11.5,color:"var(--t-3)"}}>mg/mL</span>
              </div>
              <div className="mono" style={{fontSize:11,color:"var(--t-2)",marginBottom:4}}>{recommended.vial}mg vial + {recommended.bac}mL BAC water</div></>):null}
              <div style={{fontSize:12,color:"var(--t-3)",lineHeight:1.45}}>{recommended.note}</div>
            </div>)}

            {/* Other options */}
            {others.length>0&&!r.preformulated&&(<>
              <div className="mono" style={{fontSize:10,color:"var(--t-3)",letterSpacing:".12em",textTransform:"uppercase",fontWeight:600,marginBottom:8,marginTop:14}}>Other options</div>
              {others.map((o,i)=>(<div key={i} style={{background:"var(--elev-1)",borderRadius:"var(--r-sm)",padding:"10px 14px",marginBottom:6}}>
                {o.vial?(<><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginBottom:3}}>
                  <span className="mono" style={{fontSize:11,color:"var(--t-2)"}}>{o.vial}mg vial + {o.bac}mL BAC</span>
                  <span className="serif tabular" style={{fontSize:16,color:"var(--t-2)",fontStyle:"italic"}}>{o.conc}<span className="mono" style={{fontSize:10,color:"var(--t-4)"}}> mg/mL</span></span>
                </div></>):null}
                <div style={{fontSize:11,color:"var(--t-4)",lineHeight:1.45}}>{o.note}</div>
              </div>))}
            </>)}

            {/* Stability warning if peptide has a notable short window */}
            {r.stabilityWarning&&<div style={{marginTop:14,padding:"10px 14px",background:"color-mix(in oklch, var(--c-warn) 10%, transparent)",borderLeft:"3px solid var(--c-warn)",borderRadius:"var(--r-sm)",fontSize:11.5,color:"var(--t-2)",lineHeight:1.5}}>⚠ {r.stabilityWarning}</div>}

            {/* Technique */}
            <div className="mono" style={{fontSize:10,color:"var(--t-3)",letterSpacing:".12em",textTransform:"uppercase",fontWeight:600,marginBottom:8,marginTop:16}}>{r.topical?"Application":r.preformulated?"Usage":"Technique"}</div>
            <ol style={{margin:0,paddingLeft:20,fontSize:12.5,color:"var(--t-2)",lineHeight:1.6}}>{r.technique.map((t,i)=>(<li key={i} style={{marginBottom:4}}>{t}</li>))}</ol>

            {/* Storage + stability */}
            <div style={{marginTop:14,padding:"10px 14px",background:"var(--elev-1)",borderRadius:"var(--r-sm)"}}>
              <div className="mono" style={{fontSize:9.5,color:"var(--t-3)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:600,marginBottom:4}}>Storage</div>
              <div style={{fontSize:12,color:"var(--t-2)",lineHeight:1.45,marginBottom:r.stabilityDays?6:0}}>{r.storage}</div>
              {r.stabilityDays&&<>
                <div className="mono" style={{fontSize:9.5,color:"var(--t-3)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:600,marginBottom:4,marginTop:8}}>Stability window</div>
                <div style={{fontSize:12,color:"var(--t-2)",lineHeight:1.45}}>{r.stabilityDays} day{r.stabilityDays!==1?"s":""} after reconstitution</div>
              </>}
            </div>

            {/* Sources */}
            <div className="mono" style={{fontSize:9,color:"var(--t-5)",letterSpacing:".08em",marginTop:14,textAlign:"center"}}>Sources: {r.sources.join(" · ")}</div>
          </div>
        </div>
      );})()}

      {/* Edit peptide sheet — adjust schedule, dose, status, dates per-user */}
      {editPepModal&&(()=>{
        const p=editPepModal;
        /* userPeps already contains merged stack values, so p.dose/schedule/etc.
           ARE the current saved values. No separate override lookup needed. */
        const eff={
          dose:p.dose,
          schedule:p.schedule,
          time:p.time,
          status:p.status,
          startDate:p.startDate,
          totalWeeks:p.totalWeeks,
          note:p.note,
        };
        const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        const STATUSES=[["active","Active"],["starting","Starting"],["break","On break"],["prn","PRN"]];
        const TIMES=["AM","PM","Bedtime","AM+PM","AM+Lunch"];
        const hasDefaults=!!DEFAULT_STACK[p.id];
        return(<div onClick={()=>setEditPepModal(null)} style={{position:"fixed",inset:0,zIndex:150,background:"oklch(0.05 0 0 / 0.78)",backdropFilter:"blur(10px)",display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"20px"}}>
          <div onClick={e=>e.stopPropagation()} className="sheet" style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:"var(--r-lg)",padding:18,maxWidth:480,width:"100%",maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{width:34,height:4,background:"var(--elev-3)",borderRadius:2,margin:"0 auto 14px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
              <h3 className="serif" style={{fontSize:26,fontWeight:400,color:p.color,margin:0,fontStyle:"italic",letterSpacing:"-0.015em"}}>Edit {p.name}</h3>
              <button onClick={()=>setEditPepModal(null)} className="touch" style={{background:"none",border:"none",color:"var(--t-3)",cursor:"pointer",padding:4}}><Icon n="x" s={18}/></button>
            </div>
            <div className="mono" style={{fontSize:10.5,color:"var(--t-3)",letterSpacing:".06em",marginBottom:14}}>Your edits stay private to {profile?.name||"this profile"} — they don't affect the other household member</div>

            {/* Dose */}
            <div style={{marginBottom:14}}>
              <label className="mono" style={{display:"block",fontSize:10,color:"var(--t-3)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:600,marginBottom:5}}>Dose</label>
              <input value={eff.dose} onChange={e=>setEditPepModal({...editPepModal,_dose:e.target.value})} className="bcq-input mono" placeholder="e.g. 2.5mg (25u)" style={{fontSize:13,padding:"10px 12px",width:"100%"}}/>
            </div>

            {/* Schedule (day toggles) */}
            <div style={{marginBottom:14}}>
              <label className="mono" style={{display:"block",fontSize:10,color:"var(--t-3)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:600,marginBottom:5}}>Schedule</label>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{DAYS.map((d,idx)=>{const sched=editPepModal._schedule??eff.schedule;const on=sched.includes(idx);return(<button key={idx} onClick={()=>{const cur=editPepModal._schedule??eff.schedule;const next=on?cur.filter(x=>x!==idx):[...cur,idx].sort();setEditPepModal({...editPepModal,_schedule:next});}} className="touch" style={{flex:"1 0 auto",minWidth:42,padding:"9px 8px",borderRadius:"var(--r-sm)",border:`1px solid ${on?p.color:"var(--line-soft)"}`,background:on?`color-mix(in oklch, ${p.color} 18%, transparent)`:"var(--elev-1)",color:on?p.color:"var(--t-3)",fontSize:11.5,fontWeight:on?600:500,cursor:"pointer"}}>{d}</button>);})}</div>
              <div className="mono" style={{fontSize:10,color:"var(--t-4)",marginTop:5,letterSpacing:".02em"}}>{(editPepModal._schedule??eff.schedule).length||"No"} day{(editPepModal._schedule??eff.schedule).length===1?"":"s"} per week</div>
            </div>

            {/* Time */}
            <div style={{marginBottom:14}}>
              <label className="mono" style={{display:"block",fontSize:10,color:"var(--t-3)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:600,marginBottom:5}}>Time</label>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{TIMES.map(t=>{const on=(editPepModal._time??eff.time)===t;return(<button key={t} onClick={()=>setEditPepModal({...editPepModal,_time:t})} className="touch" style={{padding:"7px 12px",borderRadius:999,border:`1px solid ${on?p.color:"var(--line-soft)"}`,background:on?`color-mix(in oklch, ${p.color} 15%, transparent)`:"var(--elev-1)",color:on?p.color:"var(--t-3)",fontSize:11.5,fontWeight:on?600:500,cursor:"pointer"}}>{t}</button>);})}</div>
            </div>

            {/* Status */}
            <div style={{marginBottom:14}}>
              <label className="mono" style={{display:"block",fontSize:10,color:"var(--t-3)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:600,marginBottom:5}}>Status</label>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{STATUSES.map(([v,l])=>{const on=(editPepModal._status??eff.status)===v;return(<button key={v} onClick={()=>setEditPepModal({...editPepModal,_status:v})} className="touch" style={{padding:"7px 12px",borderRadius:999,border:`1px solid ${on?p.color:"var(--line-soft)"}`,background:on?`color-mix(in oklch, ${p.color} 15%, transparent)`:"var(--elev-1)",color:on?p.color:"var(--t-3)",fontSize:11.5,fontWeight:on?600:500,cursor:"pointer"}}>{l}</button>);})}</div>
            </div>

            {/* Start date + total weeks */}
            <div style={{display:"flex",gap:10,marginBottom:14}}>
              <div style={{flex:1}}>
                <label className="mono" style={{display:"block",fontSize:10,color:"var(--t-3)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:600,marginBottom:5}}>Start date</label>
                <input type="date" value={editPepModal._startDate??eff.startDate??""} onChange={e=>setEditPepModal({...editPepModal,_startDate:e.target.value})} className="bcq-input" style={{fontSize:13,padding:"10px 12px",width:"100%"}}/>
              </div>
              <div style={{flex:1}}>
                <label className="mono" style={{display:"block",fontSize:10,color:"var(--t-3)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:600,marginBottom:5}}>Total weeks</label>
                <input type="number" value={editPepModal._totalWeeks??eff.totalWeeks??0} onChange={e=>setEditPepModal({...editPepModal,_totalWeeks:+e.target.value||0})} className="bcq-input mono" style={{fontSize:13,padding:"10px 12px",width:"100%"}}/>
              </div>
            </div>

            {/* Note */}
            <div style={{marginBottom:16}}>
              <label className="mono" style={{display:"block",fontSize:10,color:"var(--t-3)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:600,marginBottom:5}}>Note</label>
              <input value={editPepModal._note??eff.note??""} onChange={e=>setEditPepModal({...editPepModal,_note:e.target.value})} className="bcq-input" placeholder="e.g. Mon/Wed/Fri" style={{fontSize:13,padding:"10px 12px",width:"100%"}}/>
            </div>

            {/* Save / Reset buttons */}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{
                /* Send ALL editable fields — DB is source of truth, no diffing needed */
                const patch={
                  dose:editPepModal._dose??eff.dose,
                  schedule:editPepModal._schedule??eff.schedule,
                  time:editPepModal._time??eff.time,
                  status:editPepModal._status??eff.status,
                  startDate:editPepModal._startDate??eff.startDate,
                  totalWeeks:editPepModal._totalWeeks??eff.totalWeeks,
                  note:editPepModal._note??eff.note,
                };
                savePepOverride(p.id,patch);
              }} className="touch" style={{flex:1,padding:"13px",borderRadius:"var(--r-md)",border:"none",background:p.color,color:"var(--bg)",fontSize:14,fontWeight:600,cursor:"pointer"}}>Save changes</button>
              {hasDefaults&&<button onClick={()=>resetPepOverride(p.id)} className="touch" style={{padding:"13px 16px",borderRadius:"var(--r-md)",border:"1px solid var(--line-soft)",background:"transparent",color:"var(--t-3)",fontSize:12.5,fontWeight:600,cursor:"pointer"}}>Reset</button>}
            </div>
            {hasDefaults&&<div style={{fontSize:10.5,color:"var(--t-4)",marginTop:8,fontStyle:"italic",textAlign:"center"}}>Reset returns this peptide to its built-in defaults.</div>}
          </div>
        </div>);
      })()}

      {/* Reorder sheet — best-price options for a low-supply peptide */}
      {reorderModal&&(()=>{const ro=reorderOptionsFor(reorderModal.id);return(
        <div onClick={()=>setReorderModal(null)} style={{position:"fixed",inset:0,zIndex:145,background:"oklch(0.05 0 0 / 0.78)",backdropFilter:"blur(10px)",display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"20px"}}>
          <div onClick={e=>e.stopPropagation()} className="sheet" style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:"var(--r-lg)",padding:18,maxWidth:480,width:"100%",maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{width:34,height:4,background:"var(--elev-3)",borderRadius:2,margin:"0 auto 14px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
              <h3 className="serif" style={{fontSize:26,fontWeight:400,color:"var(--t-1)",margin:0,fontStyle:"italic",letterSpacing:"-0.015em"}}>Reorder {reorderModal.name}</h3>
              <button onClick={()=>setReorderModal(null)} className="touch" style={{background:"none",border:"none",color:"var(--t-3)",cursor:"pointer",padding:4}}><Icon n="x" s={18}/></button>
            </div>
            <div className="mono" style={{fontSize:11,color:"var(--t-3)",letterSpacing:".04em",marginBottom:4}}>{ro?.productLabel||"Product not catalogued"}</div>
            {reorderModal.daysSupply!=null&&<div style={{fontSize:12,color:"var(--t-3)",marginBottom:10,fontStyle:"italic"}}>{reorderModal.supplyNote||""}{reorderModal.supplyNote?" · ":""}{reorderModal.daysSupply} day{reorderModal.daysSupply!==1?"s":""} of supply</div>}
            {(()=>{const partnerName=Object.entries(PROFILES).filter(([id])=>id!==userId).map(([,p])=>p.name)[0];return(<div style={{display:"flex",alignItems:"center",gap:7,padding:"7px 11px",background:"var(--accent-soft)",borderRadius:"var(--r-sm)",marginBottom:14}}>
              <Icon n="users" s={13} c="var(--accent)"/>
              <span className="mono" style={{fontSize:10.5,color:"var(--accent)",letterSpacing:".04em",fontWeight:600}}>Shared inventory{partnerName?` with ${partnerName}`:""} — reordered vials show up for both profiles</span>
            </div>);})()}

            {ro&&ro.savings>0&&(<div style={{background:"color-mix(in oklch, var(--c-success) 10%, transparent)",border:"1px solid color-mix(in oklch, var(--c-success) 30%, transparent)",borderRadius:"var(--r-sm)",padding:"10px 14px",marginBottom:14}}>
              <div className="mono" style={{fontSize:10,color:"var(--c-success)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:600,marginBottom:3}}>Cheapest saves</div>
              <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                <span className="serif tabular" style={{fontSize:30,color:"var(--c-success)",fontStyle:"italic",lineHeight:1}}>₱{ro.savings.toLocaleString()}</span>
                <span className="mono" style={{fontSize:11,color:"var(--t-3)"}}>vs most expensive seller</span>
              </div>
            </div>)}

            {!ro&&(<div style={{padding:"24px 18px",background:"var(--elev-1)",borderRadius:"var(--r-md)",textAlign:"center",fontSize:12.5,color:"var(--t-3)",fontStyle:"italic",marginBottom:14}}>No price data catalogued for this peptide yet. Tap any seller below to browse their store.</div>)}

            {ro?.productNotes&&<div style={{fontSize:11.5,color:"var(--t-3)",marginBottom:14,padding:"8px 12px",background:"var(--elev-1)",borderLeft:"2px solid var(--t-4)",borderRadius:"4px",fontStyle:"italic"}}>{ro.productNotes}</div>}

            {/* Seller list */}
            <div>{(ro?.options||Object.keys(SELLERS).map(sid=>({sellerId:sid,seller:SELLERS[sid],price:null}))).map((o,i)=>(<div key={o.sellerId} className="rise" style={{animationDelay:`${i*0.04}s`,background:"var(--elev-1)",borderRadius:"var(--r-sm)",padding:"12px 14px",marginBottom:8,border:o.isBest?"1px solid var(--c-success)":"1px solid transparent"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                    <span style={{fontSize:14,fontWeight:600,color:"var(--t-1)"}}>{o.seller.name}</span>
                    {o.seller.verified&&<span title="Vetted by PeptideGuidesPH" style={{fontSize:9.5,fontWeight:700,color:"var(--accent)",background:"var(--accent-soft)",padding:"2px 7px",borderRadius:999,letterSpacing:".08em",textTransform:"uppercase",display:"inline-flex",alignItems:"center",gap:3}}><Icon n="check" s={10} c="var(--accent)" sw={2.5}/>PG vetted</span>}
                    {o.isBest&&<span style={{fontSize:9.5,fontWeight:700,color:"var(--c-success)",background:"color-mix(in oklch, var(--c-success) 14%, transparent)",padding:"2px 7px",borderRadius:999,letterSpacing:".08em",textTransform:"uppercase"}}>Best price</span>}
                    {o.knownStockist&&!o.isBest&&<span style={{fontSize:9.5,fontWeight:600,color:"var(--t-3)",background:"var(--elev-2)",padding:"2px 7px",borderRadius:999,letterSpacing:".06em",textTransform:"uppercase"}}>Stockist</span>}
                  </div>
                  <div style={{fontSize:11,color:"var(--t-4)",marginTop:3,lineHeight:1.4}}>{o.seller.notes}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  {o.price!=null?(<>
                    <div className="serif tabular" style={{fontSize:22,color:o.isBest?"var(--c-success)":"var(--t-2)",fontStyle:"italic",lineHeight:1}}>₱{o.price.toLocaleString()}</div>
                    <div className="mono" style={{fontSize:9.5,color:"var(--t-4)",marginTop:2,letterSpacing:".04em"}}>per vial</div>
                  </>):(<div className="mono" style={{fontSize:10.5,color:"var(--t-4)",letterSpacing:".04em"}}>price n/a</div>)}
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {o.seller.shopee&&<a href={o.seller.shopee} target="_blank" rel="noopener noreferrer" className="touch" style={{padding:"7px 12px",borderRadius:"var(--r-sm)",border:"1px solid var(--accent-line)",background:"var(--accent-soft)",color:"var(--accent)",fontSize:11.5,fontWeight:600,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}>Shopee →</a>}
                {o.seller.instagram&&<a href={o.seller.instagram} target="_blank" rel="noopener noreferrer" className="touch" style={{padding:"7px 12px",borderRadius:"var(--r-sm)",border:"1px solid var(--line-soft)",background:"var(--elev-2)",color:"var(--t-2)",fontSize:11.5,fontWeight:600,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}>{o.seller.instagram.includes("tiktok")?"TikTok →":"Instagram →"}</a>}
                {o.seller.whatsapp&&<a href={`https://wa.me/${o.seller.whatsapp.replace(/[^0-9]/g,"")}`} target="_blank" rel="noopener noreferrer" className="touch" style={{padding:"7px 12px",borderRadius:"var(--r-sm)",border:"1px solid var(--line-soft)",background:"var(--elev-2)",color:"var(--t-2)",fontSize:11.5,fontWeight:600,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}>WhatsApp →</a>}
                {o.seller.website&&<a href={o.seller.website} target="_blank" rel="noopener noreferrer" className="touch" style={{padding:"7px 12px",borderRadius:"var(--r-sm)",border:"1px solid var(--line-soft)",background:"var(--elev-2)",color:"var(--t-2)",fontSize:11.5,fontWeight:600,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}>{o.seller.website.includes("facebook")?"Facebook →":o.seller.website.includes("lazada")?"Lazada →":"Website →"}</a>}
              </div>
            </div>))}</div>

            {/* PeptideGuidesPH directory link */}
            <a href={PG_DIRECTORY} target="_blank" rel="noopener noreferrer" className="touch" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:12,padding:"10px 14px",borderRadius:"var(--r-sm)",border:"1px dashed var(--line)",background:"transparent",color:"var(--t-3)",fontSize:11.5,textDecoration:"none"}}><Icon n="image" s={13} c="var(--t-3)" sw={1.6}/> Browse the live PeptideGuidesPH directory →</a>

            <div className="mono" style={{fontSize:9.5,color:"var(--t-5)",letterSpacing:".08em",textTransform:"uppercase",marginTop:10,textAlign:"center"}}>Always verify before paying · prices change weekly</div>
          </div>
        </div>
      );})()}

      {/* Photo upload preview sheet — confirm metadata before upload */}
      {photoUploadPreview&&<div style={{position:"fixed",inset:0,zIndex:140,background:"oklch(0.08 0 0 / 0.75)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"20px"}} onClick={()=>{if(!photoUploading){URL.revokeObjectURL(photoUploadPreview.previewUrl);setPhotoUploadPreview(null);}}}>
        <div onClick={e=>e.stopPropagation()} className="sheet" style={{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:"var(--r-lg)",padding:18,maxWidth:480,width:"100%",maxHeight:"90vh",overflowY:"auto"}}>
          <div style={{width:34,height:4,background:"var(--elev-3)",borderRadius:2,margin:"0 auto 14px"}}/>
          <h3 className="serif" style={{fontSize:24,fontWeight:400,color:"var(--t-1)",margin:"0 0 12px",fontStyle:"italic",letterSpacing:"-0.015em",textAlign:"center"}}>New photo</h3>
          <div style={{borderRadius:"var(--r-md)",overflow:"hidden",marginBottom:14,maxHeight:"40vh",background:"var(--elev-2)"}}>
            <img src={photoUploadPreview.previewUrl} alt="preview" style={{width:"100%",maxHeight:"40vh",objectFit:"contain",display:"block"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div>
              <div style={{fontSize:10,color:"var(--t-3)",marginBottom:5,fontWeight:600,letterSpacing:".10em",textTransform:"uppercase"}}>Date</div>
              <input type="date" value={photoUploadMeta.date} onChange={e=>setPhotoUploadMeta({...photoUploadMeta,date:e.target.value})} className="bcq-input" style={{colorScheme:"dark"}}/>
            </div>
            <div>
              <div style={{fontSize:10,color:"var(--t-3)",marginBottom:5,fontWeight:600,letterSpacing:".10em",textTransform:"uppercase"}}>Pose</div>
              <div style={{display:"flex",gap:4}}>{["front","side","back"].map(p=>(<button key={p} onClick={()=>setPhotoUploadMeta({...photoUploadMeta,pose:p})} className="touch" style={{flex:1,padding:"10px 4px",borderRadius:"var(--r-sm)",border:`1px solid ${photoUploadMeta.pose===p?"var(--accent-line)":"var(--line-soft)"}`,background:photoUploadMeta.pose===p?"var(--accent-soft)":"transparent",color:photoUploadMeta.pose===p?"var(--accent)":"var(--t-3)",fontSize:11.5,fontWeight:600,cursor:"pointer"}}>{p}</button>))}</div>
            </div>
          </div>
          <input value={photoUploadMeta.notes} onChange={e=>setPhotoUploadMeta({...photoUploadMeta,notes:e.target.value})} placeholder="Notes (optional)" className="bcq-input" style={{marginBottom:14}}/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{URL.revokeObjectURL(photoUploadPreview.previewUrl);setPhotoUploadPreview(null);}} disabled={photoUploading} className="touch" style={{flex:1,padding:"14px",borderRadius:"var(--r-md)",border:"1px solid var(--line-soft)",background:"var(--elev-1)",color:"var(--t-2)",fontSize:14,fontWeight:600,cursor:"pointer"}}>Cancel</button>
            <button onClick={uploadPhoto} disabled={photoUploading} className="touch" style={{flex:2,padding:"14px",borderRadius:"var(--r-md)",border:"none",background:"var(--t-1)",color:"var(--bg)",fontSize:14,fontWeight:600,cursor:"pointer",opacity:photoUploading?0.6:1}}>{photoUploading?"Uploading…":"Save photo"}</button>
          </div>
        </div>
      </div>}

      {/* Photo viewer modal — full image with metadata + delete */}
      {photoModal&&<div onClick={()=>setPhotoModal(null)} style={{position:"fixed",inset:0,zIndex:150,background:"oklch(0.05 0 0 / 0.94)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
        <div onClick={e=>e.stopPropagation()} className="sheet" style={{maxWidth:520,width:"100%",maxHeight:"94vh",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div className="serif" style={{fontSize:22,color:"var(--t-1)",fontStyle:"italic",lineHeight:1.1}}>{new Date(photoModal.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
              {photoModal.pose&&<div className="mono" style={{fontSize:11,color:"var(--t-3)",letterSpacing:".06em",marginTop:2,textTransform:"uppercase"}}>{photoModal.pose}</div>}
            </div>
            <button onClick={()=>setPhotoModal(null)} className="touch" style={{width:38,height:38,borderRadius:12,border:"1px solid var(--line-soft)",background:"var(--elev-1)",color:"var(--t-2)",cursor:"pointer"}}><Icon n="x" s={18}/></button>
          </div>
          <img src={photoModal.url} alt={photoModal.date} style={{maxWidth:"100%",maxHeight:"70vh",objectFit:"contain",borderRadius:"var(--r-md)",background:"var(--elev-2)"}}/>
          {photoModal.notes&&<div style={{fontSize:13,color:"var(--t-2)",lineHeight:1.5,fontStyle:"italic"}}>{photoModal.notes}</div>}
          <button onClick={()=>deletePhoto(photoModal)} className="touch" style={{padding:"11px 14px",borderRadius:"var(--r-sm)",border:"1px solid color-mix(in oklch, var(--c-danger) 30%, transparent)",background:"color-mix(in oklch, var(--c-danger) 8%, transparent)",color:"var(--c-danger)",fontSize:12.5,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,alignSelf:"flex-start"}}><Icon n="trash" s={14}/> Delete photo</button>
        </div>
      </div>}

      {/* Save error / success toast — floats above everything */}
      <Toast toast={toast}/>
    </div>
  );
}

/* Default export wraps the dashboard in an ErrorBoundary so runtime errors
   render a useful diagnostic instead of a black screen. */
export default function Dashboard(){
  return <ErrorBoundary><DashboardInner/></ErrorBoundary>;
}
