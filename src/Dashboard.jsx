import { useState, useEffect, useMemo, useCallback, Component } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine, Legend, Cell } from "recharts";

/* ═══ SUPABASE ═══ */
const SB="https://xstinpgwhpjwoohpkjgn.supabase.co/rest/v1";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdGlucGd3aHBqd29vaHBramduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MTI4MzksImV4cCI6MjA5NDQ4ODgzOX0.XVrnWxg4MXOB9iBxkq9rP9T8XBsBjS8Ff85jC4MhLPc";
const hdr={apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`,"Content-Type":"application/json"};
const makeDb=(uid,onErr=()=>{})=>({
  async get(table,dateVal){try{const r=await fetch(`${SB}/${table}?user_id=eq.${uid}&date=eq.${dateVal}&select=*`,{headers:hdr});if(!r.ok)throw new Error(`${table}: ${r.status}`);const d=await r.json();return d[0]||null;}catch(e){onErr(`Couldn't load ${table}`);return null;}},
  async upsert(table,row){try{const r=await fetch(`${SB}/${table}`,{method:"POST",headers:{...hdr,Prefer:"resolution=merge-duplicates"},body:JSON.stringify({...row,user_id:uid})});if(!r.ok)throw new Error(`${table}: ${r.status}`);return true;}catch(e){console.error("db upsert:",e);onErr(`Couldn't save ${table}`);return false;}},
  async list(table,limit=14){try{const r=await fetch(`${SB}/${table}?user_id=eq.${uid}&select=*&order=date.desc&limit=${limit}`,{headers:hdr});if(!r.ok)throw new Error(`${table}: ${r.status}`);return await r.json();}catch(e){onErr(`Couldn't load ${table}`);return[];}},
  async del(table,dateVal){try{const r=await fetch(`${SB}/${table}?user_id=eq.${uid}&date=eq.${dateVal}`,{method:"DELETE",headers:hdr});if(!r.ok)throw new Error(`${table}: ${r.status}`);return true;}catch(e){onErr(`Couldn't delete ${table}`);return false;}},
  async getConfig(key){try{const r=await fetch(`${SB}/config?user_id=eq.${uid}&key=eq.${key}&select=*`,{headers:hdr});if(!r.ok)throw new Error(`config: ${r.status}`);const d=await r.json();return d[0]?.value||null;}catch(e){return null;}},
  async setConfig(key,value){try{const r=await fetch(`${SB}/config`,{method:"POST",headers:{...hdr,Prefer:"resolution=merge-duplicates"},body:JSON.stringify({user_id:uid,key,value,updated_at:new Date().toISOString()})});if(!r.ok)throw new Error(`config: ${r.status}`);return true;}catch(e){onErr(`Couldn't save settings`);return false;}},
});

const PROFILES={
  kim:{name:"Kim",emoji:"👑",targets:{cal:1440,protein:150,fat:45,carbs:109},showPeptides:true,showScans:true},
  bernadette:{name:"Bernadette",emoji:"💜",targets:{cal:1600,protein:120,fat:50,carbs:150},showPeptides:true,showScans:false},
};

/* ═══ SCAN DATA ═══ */
const SCANS = [
  {date:"2023-05-06",weight:56.4,muscle:16.2,fatPct:45.3,height:152},
  {date:"2025-03-09",weight:57.6,muscle:18.9,fatPct:38.5,height:155},
  {date:"2025-03-23",weight:56.8,muscle:17.9,fatPct:40.8,height:155},
  {date:"2025-04-04",weight:56.7,muscle:18.3,fatPct:39.7,height:155},
  {date:"2025-04-13",weight:57.5,muscle:18.7,fatPct:39.1,height:155},
  {date:"2025-04-25",weight:57.8,muscle:18.4,fatPct:40.2,height:155},
  {date:"2025-05-22",weight:57.1,muscle:17.4,fatPct:42.9,height:155},
  {date:"2026-02-07",weight:56.9,muscle:18.5,fatPct:39.5,height:155},
  {date:"2026-02-14",weight:57.5,muscle:18.5,fatPct:40.2,height:155},
  {date:"2026-02-21",weight:56.2,muscle:18.5,fatPct:38.4,height:155},
  {date:"2026-02-28",weight:55.7,muscle:18.4,fatPct:38.2,height:155},
  {date:"2026-03-07",weight:56.7,muscle:19.0,fatPct:37.7,height:155},
  {date:"2026-03-14",weight:56.3,muscle:18.6,fatPct:38.3,height:155},
  {date:"2026-04-18",weight:55.4,muscle:19.0,fatPct:36.1,height:155},
  {date:"2026-05-16",weight:54.1,muscle:18.0,fatPct:37.6,height:155},
];
const WHEY = {name:"Whey Isolate x2",protein:50,fat:1,carbs:4};
const COL = {cal:"var(--c-cal)",protein:"var(--c-protein)",fat:"var(--c-fat)",carbs:"var(--c-carbs)"};
const calcCal = (p,f,c) => Math.round((p||0)*4+(f||0)*9+(c||0)*4);

/* ═══ PEPTIDE CONFIG ═══ */
const PEPTIDES = [
  {id:"reta",users:["kim"],name:"Retatrutide",dose:"2.5mg (25u)",schedule:[2],time:"AM",status:"active",startDate:"2026-03-10",week:10,totalWeeks:12,cycleEnd:"2026-06-01",note:"Bump to 4mg May 19",color:"oklch(0.70 0.18 25)",dosesLeft:5,daysSupply:35,supplyNote:"Pen 2 + RTA backup",purpose:"Triple agonist (GLP-1/GIP/Glucagon). Suppresses appetite, accelerates fat loss, improves insulin sensitivity. Your primary weight-loss peptide."},
  {id:"klow",users:["kim","bernadette"],name:"Klow",dose:"40u (10.7mg)",schedule:[0,1,2,3,4,5,6],time:"PM",status:"active",startDate:"2026-05-01",week:3,totalWeeks:4,cycleEnd:"2026-05-28",note:"Daily · Cycle ends May 28",color:"oklch(0.76 0.17 160)",dosesLeft:7,daysSupply:7,supplyNote:"~1 week left",purpose:"4-in-1 blend: BPC-157 (gut healing) + TB-500 (tissue repair) + GHK-Cu (skin/collagen) + KPV (anti-inflammatory). Recovery, healing, skin quality."},
  {id:"nad",users:["kim","bernadette"],name:"NAD+",dose:"50mg (30u)",schedule:[1,3],time:"AM",status:"active",startDate:"2026-04-06",week:6,totalWeeks:12,cycleEnd:"2026-06-29",note:"Mon/Wed",color:"oklch(0.74 0.14 240)",dosesLeft:40,daysSupply:140,supplyNote:"5 vials · well stocked",purpose:"Cellular energy currency. Activates sirtuins (longevity genes), supports DNA repair, boosts mitochondrial function. Anti-aging and metabolic support."},
  {id:"ta1",users:["kim","bernadette"],name:"Thymosin Alpha-1",dose:"1.5mg (15u)",schedule:[1,4],time:"AM",status:"active",startDate:"2026-05-16",week:1,totalWeeks:8,cycleEnd:"2026-07-11",note:"Mon/Thu · Just started",color:"oklch(0.74 0.16 305)",dosesLeft:6,daysSupply:21,supplyNote:"2 vials × 3 doses",purpose:"Immune modulator from the thymus. Boosts T-cell function, enhances immune surveillance, anti-viral/anti-tumor activity. Strengthens immune system."},
  {id:"amino",users:["kim","bernadette"],name:"5-Amino-1MQ",dose:"2.5mg (25u) BID",schedule:[0,1,2,3,4,5,6],time:"AM+PM",status:"active",startDate:"2026-05-16",week:1,totalWeeks:4,cycleEnd:"2026-06-13",note:"Daily BID · Just started",color:"oklch(0.78 0.16 50)",dosesLeft:4,daysSupply:4,supplyNote:"4 days only — reorder now",purpose:"NNMT enzyme inhibitor. Blocks fat storage pathway, increases metabolic rate, promotes fat cell energy expenditure. Direct fat-loss mechanism separate from Reta."},
  {id:"snap8",users:["kim","bernadette"],name:"Snap-8",dose:"Topical AM+PM",schedule:[0,1,2,3,4,5,6],time:"AM+PM",status:"active",startDate:"2026-05-16",week:1,totalWeeks:12,cycleEnd:"2026-08-08",note:"Topical",color:"oklch(0.76 0.18 335)",dosesLeft:28,daysSupply:28,supplyNote:"1 vial ~4 weeks",purpose:"Acetyl octapeptide-3 (topical). Relaxes facial muscles like mild Botox — reduces fine lines and wrinkles. Applied to skin, not injected."},
  {id:"cjcipa",users:["kim","bernadette"],name:"CJC+Ipamorelin",dose:"100mcg ea (3u)",schedule:[1,2,3,4,5],time:"Bedtime",status:"starting",startDate:"2026-05-17",week:0,totalWeeks:12,cycleEnd:"2026-08-09",note:"Starts May 17 · 5on/2off",color:"oklch(0.78 0.14 180)",dosesLeft:60,daysSupply:84,supplyNote:"2 vials · 12+ weeks",purpose:"Dual GH secretagogue. CJC amplifies natural growth hormone pulses, Ipamorelin triggers them. Together: deeper sleep, fat loss, recovery, skin, anti-aging. Tesamorelin replacement without nightmares."},
  {id:"semax",users:["kim","bernadette"],name:"Semax+Selank",dose:"200mcg x2 daily",schedule:[1,2,3,4,5],time:"AM+Lunch",status:"prn",startDate:"2026-04-20",week:0,totalWeeks:0,note:"PRN for focus",color:"oklch(0.84 0.14 90)",dosesLeft:60,daysSupply:60,supplyNote:"~60 doses per bottle",purpose:"Nootropic nasal sprays. Semax: boosts BDNF, sharpens focus and memory. Selank: anxiolytic, calms without sedation. Together: calm clarity for demanding work."},
  {id:"motsc",users:["kim","bernadette"],name:"MOTS-c",dose:"1.5mg (30u)",schedule:[],time:"—",status:"break",startDate:"2026-04-14",week:0,totalWeeks:5,cycleEnd:null,note:"Break until ~Jun 10 · 2 vials ready for Cycle 2",color:"oklch(0.66 0.02 285)",dosesLeft:12,daysSupply:42,supplyNote:"2 Pepmuse vials for C2",purpose:"Mitochondrial peptide. Enhances exercise capacity, improves insulin sensitivity, activates AMPK (the exercise-mimetic pathway). Makes workouts more effective."},
  {id:"glow",users:["kim","bernadette"],name:"Glow",dose:"30u (7mg)",schedule:[],time:"—",status:"break",startDate:"2026-03-12",week:0,totalWeeks:8,cycleEnd:null,note:"Break until ~May 21",color:"oklch(0.66 0.02 285)",dosesLeft:10,daysSupply:21,supplyNote:"Vials available",purpose:"3-in-1 blend: BPC-157 + TB-500 + GHK-Cu. Same as Klow minus KPV. Healing, recovery, skin/collagen. Original version before switching to Klow."},
];

/* ═══ HELPERS ═══ */
const enrich = d => {const fm=+(d.weight*d.fatPct/100).toFixed(1);return{...d,fatMass:fm,leanMass:+(d.weight-fm).toFixed(1),label:new Date(d.date).toLocaleDateString("en-US",{month:"short",day:"numeric"}),labelYr:new Date(d.date).toLocaleDateString("en-US",{month:"short",year:"2-digit"})};};
const todayKey = () => new Date().toISOString().slice(0,10);
const buildProj = last => {
  const sc=[{name:"Conservative",rate:0.6,color:"oklch(0.80 0.15 75)"},{name:"On Track",rate:1.0,color:"oklch(0.76 0.16 295)"},{name:"Aggressive",rate:1.4,color:"oklch(0.76 0.18 155)"}];
  const p=[];for(let m=0;m<=12;m++){const dt=new Date(last.date);dt.setMonth(dt.getMonth()+m);const e={month:m,label:dt.toLocaleDateString("en-US",{month:"short",year:"2-digit"})};sc.forEach(s=>{const fm=Math.max(last.fatMass-s.rate*m,8);const tw=last.leanMass+fm;e[s.name]=+((fm/tw)*100).toFixed(1);});p.push(e);}
  return{scenarios:sc,projections:p};
};
const calcMonthly = data => {
  const m={};data.forEach(d=>{const k=d.date.substring(0,7);if(!m[k])m[k]=[];m[k].push(d);});
  return Object.keys(m).sort().map(k=>{const s=m[k];return{label:new Date(k+"-15").toLocaleDateString("en-US",{month:"short",year:"2-digit"}),avgFat:+(s.reduce((a,d)=>a+d.fatMass,0)/s.length).toFixed(1),avgPct:+(s.reduce((a,d)=>a+d.fatPct,0)/s.length).toFixed(1),avgMuscle:+(s.reduce((a,d)=>a+d.muscle,0)/s.length).toFixed(1),count:s.length};});
};

/* ═══ ICON SET — thin-line custom SVGs, no emoji at structural level ═══ */
const Icon = ({n,s=20,c="currentColor",sw=1.5}) => {
  const p = {width:s,height:s,viewBox:"0 0 24 24",fill:"none",stroke:c,strokeWidth:sw,strokeLinecap:"round",strokeLinejoin:"round",style:{flexShrink:0}};
  switch(n){
    case "macros": return <svg {...p}><path d="M3 12h18M5 12a7 7 0 0 0 14 0M8 8V5M12 8V5M16 8V5"/></svg>;
    case "peps": return <svg {...p}><path d="M9 3h6M10 3v6.5L7 14a4 4 0 0 0 6.7 4M14 3v6.5l3 4.5M8 13h8"/></svg>;
    case "body": return <svg {...p}><circle cx="12" cy="5.5" r="2.3"/><path d="M12 8v4M8 12h8M9 12l-1 9M15 12l1 9M10 16h4"/></svg>;
    case "whoop": return <svg {...p}><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 6.5 12.6"/></svg>;
    case "more": return <svg {...p}><circle cx="5.5" cy="12" r="1.2" fill={c} stroke="none"/><circle cx="12" cy="12" r="1.2" fill={c} stroke="none"/><circle cx="18.5" cy="12" r="1.2" fill={c} stroke="none"/></svg>;
    case "fat": return <svg {...p}><path d="M12 3c1.5 3 5 5 5 9a5 5 0 0 1-10 0c0-4 3.5-6 5-9z"/></svg>;
    case "muscle": return <svg {...p}><path d="M4 9c0-2 2-3 4-3h4l4 4-2 3-4-2-2 2v6c0 1.5-1 2.5-2.5 2.5S3 20.5 3 19v-2"/></svg>;
    case "scale": return <svg {...p}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 11h.01M16 11h.01M12 11v4"/></svg>;
    case "target": return <svg {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill={c}/></svg>;
    case "flame": return <svg {...p}><path d="M12 2c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4-1 4 2 5 2 5"/></svg>;
    case "star": return <svg {...p}><path d="M12 3l2.7 5.5 6 .9-4.4 4.3 1 6L12 17l-5.4 2.8 1-6-4.3-4.3 6-.9L12 3z"/></svg>;
    case "starFilled": return <svg {...p} fill={c}><path d="M12 3l2.7 5.5 6 .9-4.4 4.3 1 6L12 17l-5.4 2.8 1-6-4.3-4.3 6-.9L12 3z"/></svg>;
    case "edit": return <svg {...p}><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>;
    case "x": return <svg {...p}><path d="M5 5l14 14M19 5L5 19"/></svg>;
    case "plus": return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case "check": return <svg {...p}><path d="M4 12l5 5L20 6"/></svg>;
    case "warn": return <svg {...p}><path d="M12 3l10 17H2L12 3zM12 10v4M12 17v.5"/></svg>;
    case "moon": return <svg {...p}><path d="M21 13a8 8 0 0 1-10-10 8 8 0 1 0 10 10z"/></svg>;
    case "sun": return <svg {...p}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>;
    case "arrowUp": return <svg {...p}><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
    case "arrowDown": return <svg {...p}><path d="M12 5v14M19 12l-7 7-7-7"/></svg>;
    case "back": return <svg {...p}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>;
    case "chevDown": return <svg {...p}><path d="M6 9l6 6 6-6"/></svg>;
    case "chevUp": return <svg {...p}><path d="M18 15l-6-6-6 6"/></svg>;
    case "pause": return <svg {...p}><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>;
    case "calendar": return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>;
    case "heart": return <svg {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>;
    case "sleep": return <svg {...p}><path d="M14 4a8 8 0 1 0 6 14 8 8 0 0 1-6-14z"/><path d="M16 5h4l-4 4h4"/></svg>;
    case "strain": return <svg {...p}><path d="M3 12h3l3-7 4 14 3-9 2 5h3"/></svg>;
    case "gear": return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>;
    default: return null;
  }
};

/* ═══ TYPOGRAPHY + DESIGN TOKENS + ANIMATIONS ═══ */
const FONT_URL="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap";
const STYLE=`@import url('${FONT_URL}');
:root{
  --bg: oklch(0.16 0.014 285);
  --bg-rad-1: oklch(0.22 0.06 295);
  --bg-rad-2: oklch(0.20 0.05 30);
  --elev-1: oklch(0.21 0.018 285);
  --elev-2: oklch(0.25 0.020 285);
  --elev-3: oklch(0.29 0.022 285);
  --line: oklch(0.30 0.020 285 / 0.55);
  --line-soft: oklch(0.30 0.020 285 / 0.30);
  --t-1: oklch(0.97 0.008 80);
  --t-2: oklch(0.72 0.018 80);
  --t-3: oklch(0.55 0.022 285);
  --t-4: oklch(0.42 0.020 285);
  --t-5: oklch(0.34 0.018 285);
  --accent: oklch(0.78 0.17 158);
  --accent-soft: oklch(0.78 0.17 158 / 0.14);
  --accent-line: oklch(0.78 0.17 158 / 0.30);
  --c-protein: oklch(0.74 0.17 25);
  --c-fat: oklch(0.83 0.14 80);
  --c-carbs: oklch(0.77 0.14 215);
  --c-cal: oklch(0.78 0.16 295);
  --c-muscle: oklch(0.78 0.17 150);
  --c-bodyfat: oklch(0.72 0.18 10);
  --c-weight: oklch(0.76 0.16 295);
  --c-warn: oklch(0.80 0.16 75);
  --c-danger: oklch(0.68 0.20 25);
  --c-success: oklch(0.76 0.18 158);
  --c-streak: oklch(0.78 0.18 55);
  --r-xs: 8px; --r-sm: 12px; --r-md: 16px; --r-lg: 20px; --r-xl: 28px;
  --shadow-1: 0 1px 0 oklch(1 0 0 / 0.04) inset, 0 8px 24px oklch(0.05 0.01 285 / 0.40);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-ios: cubic-bezier(0.32, 0.72, 0, 1);
}
@keyframes riseIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes sheetUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes pulseRing{0%,100%{box-shadow:0 0 0 0 var(--accent-soft)}50%{box-shadow:0 0 0 6px transparent}}
.rise{animation:riseIn 0.55s var(--ease-out) both}
.r1{animation-delay:.04s}.r2{animation-delay:.10s}.r3{animation-delay:.16s}.r4{animation-delay:.22s}.r5{animation-delay:.28s}.r6{animation-delay:.34s}
.fade{animation:fadeIn 0.5s var(--ease-out) both}
.sheet{animation:sheetUp 0.45s var(--ease-ios) both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0;background:var(--bg);color:var(--t-1)}
body{font-family:"Geist",-apple-system,BlinkMacSystemFont,sans-serif;font-feature-settings:"ss01","cv11";-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
input,button,select,textarea{font-family:inherit;font-feature-settings:inherit}
input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
input[type=number]{-moz-appearance:textfield}
.serif{font-family:"Instrument Serif",serif;font-weight:400;letter-spacing:-0.02em}
.mono{font-family:"Geist Mono",ui-monospace,monospace;font-feature-settings:"tnum"}
.tabular{font-variant-numeric:tabular-nums}
::selection{background:var(--accent-soft);color:var(--t-1)}
.bcq-app{min-height:100vh;background:radial-gradient(120% 60% at 50% -10%,var(--bg-rad-1) 0%,transparent 55%),radial-gradient(80% 40% at 80% 0%,var(--bg-rad-2) 0%,transparent 60%),var(--bg);padding:18px 16px calc(96px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;font-family:"Geist",sans-serif}
.bcq-nav{position:fixed;bottom:0;left:0;right:0;z-index:99;background:oklch(0.16 0.014 285 / 0.78);backdrop-filter:blur(28px) saturate(180%);-webkit-backdrop-filter:blur(28px) saturate(180%);border-top:1px solid var(--line);padding:8px 0 calc(8px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto}
.bcq-input{width:100%;padding:12px 14px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--elev-2);color:var(--t-1);font-size:15px;font-family:"Geist",sans-serif;outline:none;transition:border-color .2s var(--ease-out),background .2s var(--ease-out)}
.bcq-input:focus{border-color:var(--accent-line);background:var(--elev-3)}
.bcq-input::placeholder{color:var(--t-4)}
.touch{min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center}
button{font-family:inherit;color:inherit}
.ring-pulse{animation:pulseRing 2.5s var(--ease-out) infinite}
.hbar{height:6px;border-radius:3px;background:var(--elev-2);overflow:hidden;position:relative}
.hbar > i{display:block;height:100%;border-radius:3px;transition:width 0.8s var(--ease-out)}
`;

/* ═══ SHARED UI ═══ */
const Tip=({active,payload,label})=>!active||!payload?.length?null:(<div style={{background:"oklch(0.18 0.018 285 / 0.96)",backdropFilter:"blur(20px)",border:"1px solid var(--line)",borderRadius:14,padding:"10px 14px",fontSize:12,color:"var(--t-1)",boxShadow:"var(--shadow-1)"}}><div className="mono" style={{fontWeight:600,marginBottom:6,fontSize:11,color:"var(--t-2)",textTransform:"uppercase",letterSpacing:".08em"}}>{label}</div>{payload.map((p,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}><span style={{width:7,height:7,borderRadius:"50%",background:p.color,display:"inline-block"}}/><span style={{color:"var(--t-3)",fontSize:11}}>{p.name}</span><span className="mono" style={{fontWeight:600,color:p.color,marginLeft:"auto",fontSize:12}}>{p.value}</span></div>))}</div>);

const Card=({title,value,unit,sub,color,icon,delay=0})=>(
  <div className="rise" style={{animationDelay:`${delay}s`,background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:"16px 16px 14px",flex:"1 1 calc(50% - 6px)",minWidth:0,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${color},transparent)`,opacity:.5}}/>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
      <span style={{display:"flex",alignItems:"center",gap:6,color}}>
        <Icon n={icon} s={14} c={color} sw={1.7}/>
        <span style={{fontSize:10,textTransform:"uppercase",letterSpacing:".10em",fontWeight:600,color:"var(--t-3)"}}>{title}</span>
      </span>
    </div>
    <div style={{display:"flex",alignItems:"baseline",gap:3}}>
      <span className="serif" style={{fontSize:38,color:"var(--t-1)",lineHeight:1,fontStyle:"italic"}}>{value}</span>
      <span style={{fontSize:13,color:"var(--t-3)"}}>{unit}</span>
    </div>
    {sub&&<div className="mono" style={{fontSize:10.5,marginTop:8,color:"var(--t-3)",letterSpacing:".01em"}}>{sub}</div>}
  </div>
);

const H2=({children,sub,delay=0})=>(<div className="rise" style={{animationDelay:`${delay}s`,marginBottom:12,marginTop:28}}>
  <h2 className="serif" style={{fontSize:26,fontWeight:400,color:"var(--t-1)",margin:0,letterSpacing:"-0.015em",fontStyle:"italic"}}>{children}</h2>
  {sub&&<p style={{fontSize:11.5,color:"var(--t-3)",margin:"2px 0 0",letterSpacing:".01em"}}>{sub}</p>}
</div>);

const TabBtn=({active,onClick,children})=>(<button onClick={onClick} style={{padding:"8px 14px",borderRadius:999,border:"1px solid "+(active?"var(--accent-line)":"transparent"),cursor:"pointer",fontSize:12,fontWeight:active?600:500,background:active?"var(--accent-soft)":"transparent",color:active?"var(--accent)":"var(--t-3)",whiteSpace:"nowrap",transition:"all .2s var(--ease-out)"}}>{children}</button>);

const Insight=({icon,title,text,color,delay=0})=>(<div className="rise" style={{animationDelay:`${delay}s`,background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:"14px 16px",marginBottom:10,borderLeft:`3px solid ${color}`}}>
  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
    <Icon n={icon} s={15} c={color} sw={1.7}/>
    <span style={{fontSize:13,fontWeight:600,color}}>{title}</span>
  </div>
  <div style={{fontSize:12.5,lineHeight:1.6,color:"var(--t-2)"}}>{text}</div>
</div>);

const cBox={background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:"14px 6px 6px 0",border:"none"};

/* Skeleton loader — shimmering placeholder bars while data fetches */
const Skel=({h=14,w="100%",mb=8,r=6,style={}})=>(<div style={{height:h,width:w,marginBottom:mb,borderRadius:r,background:"linear-gradient(90deg, var(--elev-1) 0%, var(--elev-2) 50%, var(--elev-1) 100%)",backgroundSize:"200% 100%",animation:"shimmer 1.6s var(--ease-out) infinite",...style}}/>);
const SkelTab=()=>(<div className="fade">
  <Skel h={140} mb={14} r={20}/>
  <Skel h={64} mb={12} r={14}/>
  <div style={{display:"flex",gap:8,marginBottom:14}}>{[1,2,3].map(i=>(<Skel key={i} h={68} mb={0} r={12}/>))}</div>
  <Skel h={54} mb={18} r={12}/>
  <Skel h={18} w="40%" mb={12}/>
  {[1,2,3].map(i=>(<Skel key={i} h={48} mb={6} r={8}/>))}
</div>);

/* Toast — bottom-center brief notification, used for save failures */
const Toast=({toast})=>!toast?null:(<div className="sheet" style={{position:"fixed",bottom:"calc(96px + env(safe-area-inset-bottom,0px))",left:"50%",transform:"translateX(-50%)",zIndex:200,background:toast.type==="error"?"color-mix(in oklch, var(--c-danger) 18%, var(--elev-2))":"color-mix(in oklch, var(--c-success) 18%, var(--elev-2))",border:`1px solid ${toast.type==="error"?"var(--c-danger)":"var(--c-success)"}`,borderRadius:"var(--r-md)",padding:"11px 18px",color:"var(--t-1)",fontSize:13,fontWeight:500,boxShadow:"var(--shadow-1)",maxWidth:"min(90vw, 360px)",display:"flex",alignItems:"center",gap:8}}>
  <Icon n={toast.type==="error"?"warn":"check"} s={16} c={toast.type==="error"?"var(--c-danger)":"var(--c-success)"} sw={2}/>
  <span>{toast.msg}</span>
</div>);

/* ═══ ONBOARDING ═══ */
const AVAILABLE_PEPS=[
  {id:"klow",name:"Klow",sub:"BPC + TB + GHK + KPV",color:"oklch(0.76 0.17 160)"},
  {id:"nad",name:"NAD+",sub:"Cellular energy",color:"oklch(0.74 0.14 240)"},
  {id:"ta1",name:"Thymosin Alpha-1",sub:"Immune modulator",color:"oklch(0.74 0.16 305)"},
  {id:"amino",name:"5-Amino-1MQ",sub:"NNMT inhibitor",color:"oklch(0.78 0.16 50)"},
  {id:"snap8",name:"Snap-8",sub:"Topical · anti-aging",color:"oklch(0.76 0.18 335)"},
  {id:"cjcipa",name:"CJC+Ipamorelin",sub:"GH secretagogue",color:"oklch(0.78 0.14 180)"},
  {id:"semax",name:"Semax + Selank",sub:"Nootropic",color:"oklch(0.84 0.14 90)"},
  {id:"motsc",name:"MOTS-c",sub:"Mitochondrial",color:"oklch(0.76 0.17 150)"},
  {id:"glow",name:"Glow",sub:"BPC + TB + GHK",color:"oklch(0.78 0.16 140)"},
  {id:"reta",name:"Retatrutide",sub:"Triple agonist",color:"oklch(0.70 0.18 25)"},
];

function Onboarding({db,onComplete}){
  const [step,setStep]=useState(0);
  const [d,setD]=useState({name:"",height:"",weight:"",age:"",gender:"female",activity:"light",targetBf:"30",targetCal:"",targetProtein:"",targetFat:"",targetCarbs:"",wheyProtein:"",wheyScoops:"",peptides:[],scanWeight:"",scanMuscle:"",scanFat:"",scanDate:new Date().toISOString().slice(0,10)});
  const up=(k,v)=>setD({...d,[k]:v});
  const togglePep=(id)=>{const p=[...d.peptides];const i=p.indexOf(id);if(i>=0)p.splice(i,1);else p.push(id);setD({...d,peptides:p});};
  const finish=async()=>{
    const targets={cal:+(d.targetCal||1600),protein:+(d.targetProtein||120),fat:+(d.targetFat||50),carbs:+(d.targetCarbs||150)};
    await db.setConfig("profile",{name:d.name,height:+(d.height||155),weight:+(d.weight||0),age:+(d.age||30),gender:d.gender,activity:d.activity,targets,goalBf:+(d.targetBf||30),peptides:d.peptides,wheyProtein:+(d.wheyProtein||0),wheyScoops:+(d.wheyScoops||0)});
    if(d.scanWeight&&d.scanFat){db.upsert("inbody_scans",{date:d.scanDate,weight:+d.scanWeight,muscle:+(d.scanMuscle||0),fat_pct:+d.scanFat});}
    await db.setConfig("onboarded",true);
    onComplete({name:d.name,targets,goalBf:+(d.targetBf||30),peptides:d.peptides,wheyProtein:+(d.wheyProtein||0),wheyScoops:+(d.wheyScoops||0)});
  };
  const lbl={fontSize:11,color:"var(--t-3)",marginBottom:6,display:"block",fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"};
  const btn=(active)=>({width:"100%",padding:"16px",borderRadius:"var(--r-md)",border:"none",background:active?"var(--t-1)":"var(--elev-2)",color:active?"var(--bg)":"var(--t-4)",fontSize:15,fontWeight:600,cursor:active?"pointer":"default",letterSpacing:"-0.005em",transition:"all .2s var(--ease-out)"});

  const steps=[
    <div key={0} className="sheet" style={{textAlign:"center",padding:"50px 0 20px"}}>
      <div style={{width:60,height:60,margin:"0 auto 26px",borderRadius:18,background:"var(--accent-soft)",border:"1px solid var(--accent-line)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--accent)"}}>
        <Icon n="body" s={28} c="var(--accent)" sw={1.6}/>
      </div>
      <div style={{color:"var(--t-3)",fontSize:11,letterSpacing:".18em",textTransform:"uppercase",marginBottom:14}}>Welcome to</div>
      <h1 className="serif" style={{fontSize:54,color:"var(--t-1)",margin:"0 0 18px",fontStyle:"italic",letterSpacing:"-0.025em",lineHeight:1.02}}>Body Comp HQ</h1>
      <p style={{fontSize:15,color:"var(--t-2)",margin:"0 auto 46px",lineHeight:1.55,maxWidth:340}}>Body composition. Nutrition. Peptides. Recovery. All in one place.</p>
      <button onClick={()=>setStep(1)} style={btn(true)}>Begin Setup</button>
    </div>,
    <div key={1} className="sheet">
      <h2 className="serif" style={{fontSize:32,color:"var(--t-1)",margin:"0 0 6px",fontStyle:"italic",letterSpacing:"-0.02em"}}>About you</h2>
      <p style={{fontSize:13,color:"var(--t-3)",margin:"0 0 26px"}}>We'll calculate your BMR, TDEE, and recommended deficit.</p>
      <label style={lbl}>Your name</label>
      <input value={d.name} onChange={e=>up("name",e.target.value)} placeholder="Bernadette" className="bcq-input" style={{marginBottom:14}}/>
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        <div style={{flex:1}}><label style={lbl}>Age</label><input type="number" value={d.age} onChange={e=>up("age",e.target.value)} placeholder="30" className="bcq-input"/></div>
        <div style={{flex:1.4}}><label style={lbl}>Gender</label><div style={{display:"flex",gap:6}}>{[["female","Female"],["male","Male"]].map(([v,l])=>(<button key={v} onClick={()=>up("gender",v)} className="touch" style={{flex:1,padding:"10px 8px",borderRadius:"var(--r-sm)",border:`1px solid ${d.gender===v?"var(--accent-line)":"var(--line-soft)"}`,background:d.gender===v?"var(--accent-soft)":"transparent",color:d.gender===v?"var(--accent)":"var(--t-3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>{l}</button>))}</div></div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:18}}>
        <div style={{flex:1}}><label style={lbl}>Height · cm</label><input type="number" value={d.height} onChange={e=>up("height",e.target.value)} placeholder="155" className="bcq-input"/></div>
        <div style={{flex:1}}><label style={lbl}>Weight · kg</label><input type="number" value={d.weight} onChange={e=>up("weight",e.target.value)} placeholder="54" className="bcq-input"/></div>
      </div>
      <label style={{...lbl,marginBottom:8}}>Activity level</label>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:18}}>
        {[["sedentary","Sedentary","Little or no exercise"],["light","Lightly Active","Light exercise 1–3 days"],["moderate","Moderately Active","Moderate exercise 3–5 days"],["active","Very Active","Hard exercise 6–7 days"]].map(([v,l,desc])=>(<button key={v} onClick={()=>up("activity",v)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderRadius:"var(--r-sm)",border:`1px solid ${d.activity===v?"var(--accent-line)":"var(--line-soft)"}`,background:d.activity===v?"var(--accent-soft)":"transparent",cursor:"pointer",textAlign:"left",minHeight:48}}>
          <div><div style={{fontSize:13.5,color:d.activity===v?"var(--t-1)":"var(--t-2)",fontWeight:600}}>{l}</div><div style={{fontSize:11,color:"var(--t-4)",marginTop:1}}>{desc}</div></div>
          {d.activity===v&&<Icon n="check" s={16} c="var(--accent)" sw={2}/>}
        </button>))}
      </div>
      {d.weight&&d.height&&d.age&&(()=>{
        const bmr=d.gender==="male"?10*(+d.weight)+6.25*(+d.height)-5*(+d.age)+5:10*(+d.weight)+6.25*(+d.height)-5*(+d.age)-161;
        const mult={sedentary:1.2,light:1.375,moderate:1.55,active:1.725}[d.activity]||1.375;
        const tdee=Math.round(bmr*mult);
        return(<div className="rise" style={{background:"var(--elev-1)",borderLeft:"3px solid var(--accent)",borderRadius:"var(--r-md)",padding:"14px 16px",marginBottom:18}}>
          <div style={{fontSize:10,color:"var(--t-3)",marginBottom:10,letterSpacing:".10em",fontWeight:600,textTransform:"uppercase"}}>Your numbers</div>
          <div style={{display:"flex",justifyContent:"space-around",textAlign:"center"}}>
            <div><div className="serif mono" style={{fontSize:26,color:"var(--c-carbs)",fontStyle:"italic"}}>{Math.round(bmr)}</div><div style={{fontSize:10,color:"var(--t-3)",marginTop:2,letterSpacing:".06em"}}>BMR</div></div>
            <div><div className="serif mono" style={{fontSize:26,color:"var(--c-weight)",fontStyle:"italic"}}>{tdee}</div><div style={{fontSize:10,color:"var(--t-3)",marginTop:2,letterSpacing:".06em"}}>TDEE</div></div>
            <div><div className="serif mono" style={{fontSize:26,color:"var(--c-success)",fontStyle:"italic"}}>{Math.round(tdee*0.8)}</div><div style={{fontSize:10,color:"var(--t-3)",marginTop:2,letterSpacing:".06em"}}>−20%</div></div>
          </div>
        </div>);
      })()}
      <button onClick={()=>setStep(2)} style={btn(d.name&&d.weight&&d.height)}>Continue</button>
    </div>,
    <div key={2} className="sheet">
      <h2 className="serif" style={{fontSize:32,color:"var(--t-1)",margin:"0 0 6px",fontStyle:"italic",letterSpacing:"-0.02em"}}>Goals & nutrition</h2>
      <p style={{fontSize:13,color:"var(--t-3)",margin:"0 0 26px"}}>Set your targets — we track these daily.</p>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:11,color:"var(--c-bodyfat)",letterSpacing:".10em",fontWeight:600,marginBottom:6,textTransform:"uppercase"}}>Target body fat</div>
        <div style={{display:"flex",alignItems:"baseline",justifyContent:"center",gap:6}}>
          <input type="number" value={d.targetBf} onChange={e=>up("targetBf",e.target.value)} placeholder="30" className="serif" style={{background:"transparent",border:"none",outline:"none",fontSize:74,fontStyle:"italic",color:"var(--t-1)",textAlign:"right",width:140,letterSpacing:"-0.04em",fontWeight:400}}/>
          <span className="serif" style={{fontSize:42,fontStyle:"italic",color:"var(--t-3)"}}>%</span>
        </div>
      </div>
      <div style={{background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:16,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:600,color:"var(--t-1)",marginBottom:2}}>Daily meal plan</div>
        <p style={{fontSize:11,color:"var(--t-3)",margin:"0 0 14px"}}>Macros from your nutritionist or app.</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["targetCal","Calories","var(--c-cal)","kcal","1600"],["targetProtein","Protein","var(--c-protein)","g","120"],["targetFat","Fat","var(--c-fat)","g","50"],["targetCarbs","Carbs","var(--c-carbs)","g","150"]].map(([k,l,c,u,ph])=>(<div key={k}><label style={{fontSize:10,color:c,fontWeight:600,letterSpacing:".06em",display:"block",marginBottom:4,textTransform:"uppercase"}}>{l} <span style={{color:"var(--t-4)"}}>· {u}</span></label><input type="number" value={d[k]} onChange={e=>up(k,e.target.value)} placeholder={ph} className="bcq-input mono" style={{textAlign:"center",fontWeight:600}}/></div>))}
        </div>
      </div>
      <div style={{background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:16,marginBottom:22}}>
        <div style={{fontSize:13,fontWeight:600,color:"var(--t-1)",marginBottom:2}}>Whey protein</div>
        <p style={{fontSize:11,color:"var(--t-3)",margin:"0 0 14px"}}>Optional. Per-scoop protein and daily scoops.</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={{fontSize:10,color:"var(--c-protein)",fontWeight:600,letterSpacing:".06em",display:"block",marginBottom:4,textTransform:"uppercase"}}>Protein / scoop</label><input type="number" value={d.wheyProtein} onChange={e=>up("wheyProtein",e.target.value)} placeholder="25" className="bcq-input mono" style={{textAlign:"center",fontWeight:600}}/></div>
          <div><label style={{fontSize:10,color:"var(--t-3)",fontWeight:600,letterSpacing:".06em",display:"block",marginBottom:4,textTransform:"uppercase"}}>Scoops / day</label><input type="number" value={d.wheyScoops} onChange={e=>up("wheyScoops",e.target.value)} placeholder="2" className="bcq-input mono" style={{textAlign:"center",fontWeight:600}}/></div>
        </div>
      </div>
      <button onClick={()=>setStep(3)} style={btn(true)}>Continue</button>
    </div>,
    <div key={3} className="sheet">
      <h2 className="serif" style={{fontSize:32,color:"var(--t-1)",margin:"0 0 6px",fontStyle:"italic",letterSpacing:"-0.02em"}}>Your peptides</h2>
      <p style={{fontSize:13,color:"var(--t-3)",margin:"0 0 22px"}}>Select what you're currently running.</p>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:22}}>
        {AVAILABLE_PEPS.map(p=>{const on=d.peptides.includes(p.id);return(
          <button key={p.id} onClick={()=>togglePep(p.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:"var(--r-sm)",border:`1px solid ${on?p.color:"var(--line-soft)"}`,background:on?`color-mix(in oklch, ${p.color} 8%, transparent)`:"transparent",cursor:"pointer",textAlign:"left",minHeight:54,transition:"all .2s var(--ease-out)"}}>
            <div style={{width:22,height:22,borderRadius:6,border:`1.5px solid ${on?p.color:"var(--t-4)"}`,background:on?p.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{on&&<Icon n="check" s={14} c="var(--bg)" sw={2.5}/>}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,color:on?"var(--t-1)":"var(--t-2)",fontWeight:600}}>{p.name}</div>
              <div style={{fontSize:11,color:"var(--t-4)",marginTop:1}}>{p.sub}</div>
            </div>
          </button>
        );})}
      </div>
      <button onClick={()=>setStep(4)} style={btn(true)}>{d.peptides.length>0?`Continue with ${d.peptides.length} peptide${d.peptides.length>1?"s":""}`:"Skip — no peptides"}</button>
    </div>,
    <div key={4} className="sheet">
      <h2 className="serif" style={{fontSize:32,color:"var(--t-1)",margin:"0 0 6px",fontStyle:"italic",letterSpacing:"-0.02em"}}>First scan</h2>
      <p style={{fontSize:13,color:"var(--t-3)",margin:"0 0 26px"}}>Your latest InBody — or skip and add later.</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        {[["scanWeight","Weight","var(--c-weight)","kg","54.1"],["scanMuscle","Muscle","var(--c-muscle)","kg","18.0"],["scanFat","Fat","var(--c-bodyfat)","%","37.6"]].map(([k,l,c,u,ph])=>(<div key={k}>
          <label style={{fontSize:10,color:c,fontWeight:600,letterSpacing:".06em",display:"block",marginBottom:4,textTransform:"uppercase"}}>{l} · {u}</label>
          <input type="number" step="0.1" value={d[k]} onChange={e=>up(k,e.target.value)} placeholder={ph} className="bcq-input serif" style={{textAlign:"center",fontSize:22,fontStyle:"italic",padding:"12px 6px"}}/>
        </div>))}
      </div>
      <label style={lbl}>Scan date</label>
      <input type="date" value={d.scanDate} onChange={e=>up("scanDate",e.target.value)} className="bcq-input" style={{colorScheme:"dark",marginBottom:26}}/>
      <button onClick={finish} style={btn(true)}>{d.scanWeight?"Save & Launch":"Skip — Launch"}</button>
    </div>,
  ];

  return(
    <div style={{minHeight:"100vh",background:"radial-gradient(120% 60% at 50% -10%,var(--bg-rad-1) 0%,transparent 55%),var(--bg)",color:"var(--t-1)",display:"flex",flexDirection:"column"}}>
      <style>{STYLE}</style>
      <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:step===0?"center":"flex-start",padding:"28px 22px 40px",maxWidth:520,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>
        {step>0&&<div style={{display:"flex",gap:5,marginBottom:24}}>{[1,2,3,4].map(i=>(<div key={i} style={{flex:1,height:3,borderRadius:2,background:i<=step?"var(--accent)":"var(--elev-2)",transition:"background .3s var(--ease-out)"}}/>))}</div>}
        {step>0&&<button onClick={()=>setStep(step-1)} className="touch" style={{background:"none",border:"none",color:"var(--t-3)",fontSize:13,cursor:"pointer",padding:"4px 0",marginBottom:8,display:"inline-flex",alignItems:"center",gap:6,alignSelf:"flex-start"}}><Icon n="back" s={16}/> Back</button>}
        {steps[step]}
      </div>
    </div>
  );
}

/* ═══ ERROR BOUNDARY — surfaces real crashes instead of black screen ═══ */
class ErrorBoundary extends Component {
  constructor(p){super(p);this.state={err:null,info:null};}
  static getDerivedStateFromError(err){return{err};}
  componentDidCatch(err,info){this.setState({err,info});try{console.error("[BCQ ErrorBoundary]",err,info);}catch{}}
  render(){
    if(this.state.err){
      const msg=this.state.err?.message||String(this.state.err);
      const stack=this.state.err?.stack||"";
      const comp=this.state.info?.componentStack||"";
      return(<div style={{minHeight:"100vh",background:"var(--bg)",color:"var(--t-1)",padding:"40px 22px",maxWidth:680,margin:"0 auto",fontFamily:"'Geist',sans-serif"}}>
        <style>{STYLE}</style>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,color:"var(--c-danger)"}}>
          <Icon n="warn" s={24} c="var(--c-danger)" sw={2}/>
          <h1 className="serif" style={{fontSize:32,margin:0,fontStyle:"italic",letterSpacing:"-0.02em"}}>Something broke</h1>
        </div>
        <p style={{fontSize:14,color:"var(--t-2)",lineHeight:1.55,marginBottom:18}}>The dashboard hit a runtime error. Send Claude the message and stack below — it'll patch it.</p>
        <div style={{background:"var(--elev-1)",borderLeft:"3px solid var(--c-danger)",borderRadius:"var(--r-sm)",padding:"14px 16px",marginBottom:14}}>
          <div style={{fontSize:10.5,color:"var(--t-3)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:600,marginBottom:6}}>Error</div>
          <div className="mono" style={{fontSize:13,color:"var(--c-danger)",wordBreak:"break-word"}}>{msg}</div>
        </div>
        {stack&&<details style={{background:"var(--elev-1)",borderRadius:"var(--r-sm)",padding:"14px 16px",marginBottom:14}}>
          <summary style={{fontSize:11,color:"var(--t-3)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:600,cursor:"pointer"}}>Stack trace</summary>
          <pre className="mono" style={{fontSize:11,color:"var(--t-2)",whiteSpace:"pre-wrap",wordBreak:"break-word",marginTop:10}}>{stack}</pre>
        </details>}
        {comp&&<details style={{background:"var(--elev-1)",borderRadius:"var(--r-sm)",padding:"14px 16px",marginBottom:14}}>
          <summary style={{fontSize:11,color:"var(--t-3)",letterSpacing:".10em",textTransform:"uppercase",fontWeight:600,cursor:"pointer"}}>Component stack</summary>
          <pre className="mono" style={{fontSize:11,color:"var(--t-2)",whiteSpace:"pre-wrap",wordBreak:"break-word",marginTop:10}}>{comp}</pre>
        </details>}
        <button onClick={()=>{try{window.location.reload();}catch{}}} className="touch" style={{padding:"12px 18px",borderRadius:"var(--r-sm)",border:"1px solid var(--line-soft)",background:"var(--elev-1)",color:"var(--t-1)",fontSize:13,fontWeight:600,cursor:"pointer",marginRight:8}}>Reload</button>
        <a href="?user=bernadette" style={{display:"inline-block",padding:"12px 18px",borderRadius:"var(--r-sm)",border:"1px solid var(--accent-line)",background:"var(--accent-soft)",color:"var(--accent)",fontSize:13,fontWeight:600,textDecoration:"none"}}>Open Bernadette profile</a>
      </div>);
    }
    return this.props.children;
  }
}

/* ═══ SETTINGS SHEET — editable profile, goals, macros, whey, peptides ═══ */
function Settings({db,userId,userConfig,defaultProfile,onClose,onSave}){
  // Initialize form state from existing userConfig, falling back to PROFILES defaults
  const init = {
    name: userConfig?.name || defaultProfile?.name || "",
    age: userConfig?.age || "",
    gender: userConfig?.gender || "female",
    height: userConfig?.height || "",
    weight: userConfig?.weight || "",
    activity: userConfig?.activity || "light",
    goalBf: userConfig?.goalBf || 30,
    targetCal: userConfig?.targets?.cal ?? defaultProfile?.targets?.cal ?? "",
    targetProtein: userConfig?.targets?.protein ?? defaultProfile?.targets?.protein ?? "",
    targetFat: userConfig?.targets?.fat ?? defaultProfile?.targets?.fat ?? "",
    targetCarbs: userConfig?.targets?.carbs ?? defaultProfile?.targets?.carbs ?? "",
    wheyProtein: userConfig?.wheyProtein || "",
    wheyScoops: userConfig?.wheyScoops || "",
    peptides: Array.isArray(userConfig?.peptides) ? userConfig.peptides : [],
  };
  const [d,setD]=useState(init);
  const [saving,setSaving]=useState(false);
  const up=(k,v)=>setD(prev=>({...prev,[k]:v}));
  const togglePep=(id)=>{const p=[...d.peptides];const i=p.indexOf(id);if(i>=0)p.splice(i,1);else p.push(id);setD({...d,peptides:p});};
  // Only show peptides this user is allowed to track (matches PEPTIDES.users filter)
  const availablePeps = AVAILABLE_PEPS.filter(p=>{
    const meta = PEPTIDES.find(x=>x.id===p.id);
    return !meta?.users || meta.users.includes(userId);
  });
  const save = async () => {
    setSaving(true);
    const payload = {
      name: d.name||defaultProfile?.name||"",
      age: +(d.age||0),
      gender: d.gender,
      height: +(d.height||0),
      weight: +(d.weight||0),
      activity: d.activity,
      goalBf: +(d.goalBf||30),
      targets: {
        cal: +(d.targetCal||defaultProfile?.targets?.cal||1600),
        protein: +(d.targetProtein||defaultProfile?.targets?.protein||120),
        fat: +(d.targetFat||defaultProfile?.targets?.fat||50),
        carbs: +(d.targetCarbs||defaultProfile?.targets?.carbs||150),
      },
      wheyProtein: +(d.wheyProtein||0),
      wheyScoops: +(d.wheyScoops||0),
      peptides: d.peptides,
    };
    try{await db.setConfig("profile",payload);onSave(payload);}finally{setSaving(false);}
  };
  const lbl={fontSize:10.5,color:"var(--t-3)",marginBottom:5,display:"block",fontWeight:600,letterSpacing:".08em",textTransform:"uppercase"};
  const section={background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:"16px 18px",marginBottom:14};
  const showPep = defaultProfile?.showPeptides;
  return(
    <div style={{position:"fixed",inset:0,zIndex:120,background:"var(--bg)",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
      <style>{STYLE}</style>
      <div style={{maxWidth:520,margin:"0 auto",padding:"22px 22px calc(48px + env(safe-area-inset-bottom,0px))"}}>
        {/* Header */}
        <div className="rise" style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <h1 className="serif" style={{fontSize:34,margin:0,fontStyle:"italic",letterSpacing:"-0.025em",color:"var(--t-1)",fontWeight:400}}>Settings</h1>
          <button onClick={onClose} className="touch" style={{width:40,height:40,borderRadius:12,border:"1px solid var(--line-soft)",background:"var(--elev-1)",color:"var(--t-2)",cursor:"pointer"}}><Icon n="x" s={18}/></button>
        </div>

        {/* Profile */}
        <div className="rise r1" style={section}>
          <h2 className="serif" style={{fontSize:20,margin:"0 0 14px",fontStyle:"italic",color:"var(--t-1)",fontWeight:400,letterSpacing:"-0.015em"}}>Profile</h2>
          <label style={lbl}>Name</label>
          <input value={d.name} onChange={e=>up("name",e.target.value)} className="bcq-input" style={{marginBottom:12}}/>
          <div style={{display:"flex",gap:10,marginBottom:12}}>
            <div style={{flex:1}}><label style={lbl}>Age</label><input type="number" value={d.age} onChange={e=>up("age",e.target.value)} className="bcq-input mono" style={{textAlign:"center"}}/></div>
            <div style={{flex:1.4}}><label style={lbl}>Gender</label><div style={{display:"flex",gap:6}}>{[["female","Female"],["male","Male"]].map(([v,l])=>(<button key={v} onClick={()=>up("gender",v)} className="touch" style={{flex:1,padding:"10px 8px",borderRadius:"var(--r-sm)",border:`1px solid ${d.gender===v?"var(--accent-line)":"var(--line-soft)"}`,background:d.gender===v?"var(--accent-soft)":"transparent",color:d.gender===v?"var(--accent)":"var(--t-3)",fontSize:13,fontWeight:600,cursor:"pointer"}}>{l}</button>))}</div></div>
          </div>
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            <div style={{flex:1}}><label style={lbl}>Height · cm</label><input type="number" value={d.height} onChange={e=>up("height",e.target.value)} className="bcq-input mono" style={{textAlign:"center"}}/></div>
            <div style={{flex:1}}><label style={lbl}>Weight · kg</label><input type="number" value={d.weight} onChange={e=>up("weight",e.target.value)} className="bcq-input mono" style={{textAlign:"center"}}/></div>
          </div>
          <label style={lbl}>Activity level</label>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[["sedentary","Sedentary","Little or no exercise"],["light","Lightly Active","Light exercise 1–3 days"],["moderate","Moderately Active","Moderate exercise 3–5 days"],["active","Very Active","Hard exercise 6–7 days"]].map(([v,l,desc])=>(<button key={v} onClick={()=>up("activity",v)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 14px",borderRadius:"var(--r-sm)",border:`1px solid ${d.activity===v?"var(--accent-line)":"var(--line-soft)"}`,background:d.activity===v?"var(--accent-soft)":"transparent",cursor:"pointer",textAlign:"left",minHeight:46}}>
              <div><div style={{fontSize:13,color:d.activity===v?"var(--t-1)":"var(--t-2)",fontWeight:600}}>{l}</div><div style={{fontSize:11,color:"var(--t-4)",marginTop:1}}>{desc}</div></div>
              {d.activity===v&&<Icon n="check" s={16} c="var(--accent)" sw={2}/>}
            </button>))}
          </div>
        </div>

        {/* Goal */}
        <div className="rise r2" style={section}>
          <h2 className="serif" style={{fontSize:20,margin:"0 0 14px",fontStyle:"italic",color:"var(--t-1)",fontWeight:400,letterSpacing:"-0.015em"}}>Body fat goal</h2>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"center",gap:6}}>
            <input type="number" value={d.goalBf} onChange={e=>up("goalBf",e.target.value)} className="serif" style={{background:"transparent",border:"none",outline:"none",fontSize:58,fontStyle:"italic",color:"var(--t-1)",textAlign:"right",width:120,letterSpacing:"-0.04em",fontWeight:400}}/>
            <span className="serif" style={{fontSize:32,fontStyle:"italic",color:"var(--t-3)"}}>%</span>
          </div>
        </div>

        {/* Macro plan */}
        <div className="rise r3" style={section}>
          <h2 className="serif" style={{fontSize:20,margin:"0 0 4px",fontStyle:"italic",color:"var(--t-1)",fontWeight:400,letterSpacing:"-0.015em"}}>Daily plan</h2>
          <p style={{fontSize:11.5,color:"var(--t-3)",margin:"0 0 14px"}}>From your nutritionist or meal-plan app.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[["targetCal","Calories","var(--c-cal)","kcal"],["targetProtein","Protein","var(--c-protein)","g"],["targetFat","Fat","var(--c-fat)","g"],["targetCarbs","Carbs","var(--c-carbs)","g"]].map(([k,l,c,u])=>(<div key={k}><label style={{fontSize:10,color:c,fontWeight:600,letterSpacing:".06em",display:"block",marginBottom:4,textTransform:"uppercase"}}>{l} · {u}</label><input type="number" value={d[k]} onChange={e=>up(k,e.target.value)} className="bcq-input mono" style={{textAlign:"center",fontWeight:600}}/></div>))}
          </div>
        </div>

        {/* Whey */}
        <div className="rise r4" style={section}>
          <h2 className="serif" style={{fontSize:20,margin:"0 0 4px",fontStyle:"italic",color:"var(--t-1)",fontWeight:400,letterSpacing:"-0.015em"}}>Whey protein</h2>
          <p style={{fontSize:11.5,color:"var(--t-3)",margin:"0 0 14px"}}>Leave blank if you don't take whey.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={{fontSize:10,color:"var(--c-protein)",fontWeight:600,letterSpacing:".06em",display:"block",marginBottom:4,textTransform:"uppercase"}}>Protein / scoop</label><input type="number" value={d.wheyProtein} onChange={e=>up("wheyProtein",e.target.value)} className="bcq-input mono" style={{textAlign:"center",fontWeight:600}}/></div>
            <div><label style={{fontSize:10,color:"var(--t-3)",fontWeight:600,letterSpacing:".06em",display:"block",marginBottom:4,textTransform:"uppercase"}}>Scoops / day</label><input type="number" value={d.wheyScoops} onChange={e=>up("wheyScoops",e.target.value)} className="bcq-input mono" style={{textAlign:"center",fontWeight:600}}/></div>
          </div>
        </div>

        {/* Peptides */}
        {showPep && <div className="rise r5" style={section}>
          <h2 className="serif" style={{fontSize:20,margin:"0 0 4px",fontStyle:"italic",color:"var(--t-1)",fontWeight:400,letterSpacing:"-0.015em"}}>Peptide stack</h2>
          <p style={{fontSize:11.5,color:"var(--t-3)",margin:"0 0 14px"}}>Toggle which peptides you're currently running. Leave all unchecked to show every available peptide.</p>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {availablePeps.map(p=>{const on=d.peptides.includes(p.id);return(
              <button key={p.id} onClick={()=>togglePep(p.id)} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 13px",borderRadius:"var(--r-sm)",border:`1px solid ${on?p.color:"var(--line-soft)"}`,background:on?`color-mix(in oklch, ${p.color} 8%, transparent)`:"transparent",cursor:"pointer",textAlign:"left",minHeight:50,transition:"all .2s var(--ease-out)"}}>
                <div style={{width:20,height:20,borderRadius:5,border:`1.5px solid ${on?p.color:"var(--t-4)"}`,background:on?p.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{on&&<Icon n="check" s={13} c="var(--bg)" sw={2.5}/>}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13.5,color:on?"var(--t-1)":"var(--t-2)",fontWeight:600}}>{p.name}</div>
                  <div style={{fontSize:11,color:"var(--t-4)",marginTop:1}}>{p.sub}</div>
                </div>
              </button>
            );})}
          </div>
        </div>}

        {/* Actions */}
        <div className="rise r6" style={{display:"flex",gap:10,marginTop:6}}>
          <button onClick={onClose} className="touch" style={{flex:1,padding:"14px",borderRadius:"var(--r-md)",border:"1px solid var(--line-soft)",background:"var(--elev-1)",color:"var(--t-2)",fontSize:14,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={save} disabled={saving} className="touch" style={{flex:2,padding:"14px",borderRadius:"var(--r-md)",border:"none",background:"var(--t-1)",color:"var(--bg)",fontSize:14,fontWeight:600,cursor:saving?"default":"pointer",opacity:saving?0.6:1}}>{saving?"Saving…":"Save changes"}</button>
        </div>

        {/* Danger zone */}
        <div className="rise" style={{animationDelay:".40s",marginTop:32,padding:"16px 18px",border:"1px dashed var(--line-soft)",borderRadius:"var(--r-md)"}}>
          <div style={{fontSize:10.5,color:"var(--t-3)",letterSpacing:".12em",textTransform:"uppercase",fontWeight:600,marginBottom:6}}>Reset</div>
          <p style={{fontSize:12,color:"var(--t-3)",margin:"0 0 12px",lineHeight:1.5}}>Re-run the onboarding wizard. Your saved scans, meals, peptide logs, and Whoop entries stay intact — only profile setup is replayed.</p>
          <button onClick={async()=>{if(!window.confirm("Re-run onboarding? Your data stays — only profile setup is replayed."))return;await db.setConfig("onboarded",false);window.location.reload();}} className="touch" style={{padding:"11px 16px",borderRadius:"var(--r-sm)",border:"1px solid var(--line-soft)",background:"transparent",color:"var(--t-2)",fontSize:12.5,fontWeight:600,cursor:"pointer"}}>Re-run onboarding</button>
        </div>
      </div>
    </div>
  );
}

/* ═══ MAIN ═══ */
function DashboardInner(){
  const [tab,setTab]=useState("macros");
  const urlUser=useMemo(()=>{try{const p=new URLSearchParams(window.location.search);return p.get("user");}catch{return null;}},[]);
  const [userId,setUserId]=useState(urlUser||"kim");
  const locked=!!urlUser;
  const [userConfig,setUserConfig]=useState(null);
  const [toast,setToast]=useState(null);
  const showToast=useCallback((msg,type="error")=>{const id=Date.now()+Math.random();setToast({msg,type,id});setTimeout(()=>setToast(t=>t&&t.id===id?null:t),3800);},[]);
  const defaultProfile=PROFILES[userId]||PROFILES.kim;
  const profile=userConfig?{...defaultProfile,name:userConfig.name||defaultProfile.name,targets:userConfig.targets||defaultProfile.targets}:defaultProfile;
  const db=useMemo(()=>makeDb(userId,msg=>showToast(msg,"error")),[userId,showToast]);
  const TARGETS=profile.targets;

  const [onboarded,setOnboarded]=useState(null);
  useEffect(()=>{(async()=>{const ob=await db.getConfig("onboarded");const cfg=await db.getConfig("profile");if(cfg)setUserConfig(cfg);setOnboarded(!!ob);})();},[db]);
  const handleOnboardComplete=(cfg)=>{setUserConfig(cfg);setOnboarded(true);};

  const [dark,setDark]=useState(true);
  useEffect(()=>{(async()=>{const t=await db.getConfig("theme");if(t==="light")setDark(false);})();},[db]);
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
  const etaMonths=scenarios.map(s=>{const h=projections.find(p=>p[s.name]<=30);return{...s,months:h?h.month:">12"};});

  /* ═══ MACRO STATE ═══ */
  const MEAL_TAGS=["Lunch","Snack","Dinner","Breakfast","Other"];
  const [meals,setMeals]=useState([]);const [wheyOn,setWheyOn]=useState(true);const [macroSub,setMacroSub]=useState("log");const [mLoading,setMLoading]=useState(true);const [histDays,setHistDays]=useState([]);const [adding,setAdding]=useState(false);const [newMeal,setNewMeal]=useState({name:"",protein:"",fat:"",carbs:"",tag:"Lunch"});
  const [favs,setFavs]=useState([]);const [showFavs,setShowFavs]=useState(false);
  const [editId,setEditId]=useState(null);const [editMeal,setEditMeal]=useState({name:"",protein:"",fat:"",carbs:"",tag:""});
  const day=todayKey();
  /* Whey config derived from userConfig (Settings). Sensible defaults match the original constant (25g protein/scoop × 2 scoops). */
  const whey=useMemo(()=>{const perScoop=+(userConfig?.wheyProtein||25);const scoops=+(userConfig?.wheyScoops||2);return{protein:perScoop*scoops,fat:+(scoops*0.5).toFixed(1),carbs:scoops*2,scoops,perScoop,enabled:perScoop>0&&scoops>0,label:scoops>0?`Whey · ${scoops} scoop${scoops!==1?"s":""}`:"Whey"};},[userConfig]);

  useEffect(()=>{setMeals([]);setWheyOn(true);setMLoading(true);(async()=>{
    const row=await db.get("daily_macros",day);
    if(row){setMeals(row.meals||[]);setWheyOn(row.whey!==false);}
    const cfg=await db.getConfig("favs");
    if(cfg)setFavs(cfg);
    setMLoading(false);
  })();},[day,db]);

  const saveMacro=useCallback((m,w)=>{
    setMeals(m);setWheyOn(w);
    db.upsert("daily_macros",{date:day,meals:m,whey:w});
  },[day]);

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

  const todayDow=new Date().getDay();
  const userPeps=PEPTIDES.filter(p=>{
    if(p.users&&!p.users.includes(userId))return false;
    const userPepIds=userConfig?.peptides;
    if(Array.isArray(userPepIds)&&userPepIds.length>0)return userPepIds.includes(p.id);
    return true;
  });
  const duePeptides=userPeps.filter(p=>(p.status==="active"||p.status==="prn")&&p.schedule.includes(todayDow));
  const notDue=userPeps.filter(p=>!duePeptides.includes(p));
  const checkedCount=duePeptides.filter(p=>pepData.checks[p.id]).length;

  const streak=useMemo(()=>{let s=0;const sorted=[...pepHist].sort((a,b)=>b.date.localeCompare(a.date));for(const d of sorted){const chks=d.checks||{};const ids=typeof Object.values(chks)[0]==="string"?Object.keys(chks):Object.keys(chks);if(ids.length>0)s++;else break;}return s;},[pepHist]);

  const prev=data.length>=2?data[data.length-2]:null;
  const deltaFat=prev?+(last.fatPct-prev.fatPct).toFixed(1):null;
  const deltaMuscle=prev?+(last.muscle-prev.muscle).toFixed(1):null;
  const deltaWeight=prev?+(last.weight-prev.weight).toFixed(1):null;

  const [whoopData,setWhoopData]=useState(null);const [whoopLoading,setWhoopLoading]=useState(true);const [whoopHist,setWhoopHist]=useState([]);
  const [showPlan,setShowPlan]=useState(false);
  useEffect(()=>{setWhoopData(null);setWhoopLoading(true);(async()=>{const row=await db.get("daily_whoop",day);if(row)setWhoopData({recovery:row.recovery,sleep:row.sleep,strain:row.strain});const hist=await db.list("daily_whoop",14);setWhoopHist(hist.map(r=>({date:r.date,recovery:r.recovery,sleep:r.sleep,strain:r.strain})));setWhoopLoading(false);})();},[day,db]);
  const saveWhoop=async(d)=>{setWhoopData(d);db.upsert("daily_whoop",{date:day,...d});};
  const [whoopInput,setWhoopInput]=useState({recovery:"",sleep:"",strain:""});

  const navItems=[{id:"macros",icon:"macros",label:"Macros"},profile.showPeptides&&{id:"peptides",icon:"peps",label:"Peps"},{id:"overview",icon:"body",label:"Body"},{id:"whoop",icon:"whoop",label:"Whoop"},{id:"more",icon:"more",label:"More"}].filter(Boolean);
  const [showMore,setShowMore]=useState(false);
  const [showSettings,setShowSettings]=useState(false);

  const todayLabel=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});

  /* All hooks above — early returns safe below */
  if(onboarded===null)return(<div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center"}}><style>{STYLE}</style><div className="fade" style={{color:"var(--t-3)",fontSize:13,letterSpacing:".06em"}}>Loading…</div></div>);
  if(!onboarded)return <Onboarding db={db} onComplete={handleOnboardComplete}/>;

  return(
    <div className="bcq-app" style={{filter:dark?"none":"invert(0.94) hue-rotate(180deg)"}}>
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
          {!locked&&Object.entries(PROFILES).map(([id])=>(
            <button key={id} onClick={()=>setUserId(id)} className="touch" style={{width:38,height:38,borderRadius:12,border:`1px solid ${userId===id?"var(--accent-line)":"var(--line-soft)"}`,background:userId===id?"var(--accent-soft)":"var(--elev-1)",color:userId===id?"var(--accent)":"var(--t-3)",fontSize:11,fontWeight:600,cursor:"pointer",transition:"all .2s var(--ease-out)"}}>{PROFILES[id].name.charAt(0)}</button>
          ))}
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
      {showSettings&&<Settings db={db} userId={userId} userConfig={userConfig} defaultProfile={defaultProfile} onClose={()=>setShowSettings(false)} onSave={(cfg)=>{setUserConfig(cfg);setShowSettings(false);}}/>}

      {/* ═══ OVERVIEW (BODY) ═══ */}
      {tab==="overview"&&(<>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:8}}>
          <Card title="Body Fat" value={last.fatPct} unit="%" sub={`Best ${best.fatPct}%${deltaFat!==null?` · ${deltaFat>0?"▲":"▼"}${Math.abs(deltaFat)} from last`:""}`} color="var(--c-bodyfat)" icon="fat" delay={0.04}/>
          <Card title="Muscle" value={last.muscle} unit="kg" sub={`Peak 19.0${deltaMuscle!==null?` · ${deltaMuscle>0?"▲":"▼"}${Math.abs(deltaMuscle)}kg`:""}`} color="var(--c-muscle)" icon="muscle" delay={0.10}/>
          <Card title="Weight" value={last.weight} unit="kg" sub={deltaWeight!==null?`${deltaWeight>0?"▲":"▼"}${Math.abs(deltaWeight)}kg from last`:"Latest"} color="var(--c-weight)" icon="scale" delay={0.16}/>
          <Card title="To Lose" value={fatToLose} unit="kg" sub={`fat mass to reach ${goalPct}%`} color="var(--c-fat)" icon="target" delay={0.22}/>
        </div>

        <H2 sub={`${goalPct}% goal line`} delay={0.28}>Body fat</H2>
        <div className="rise r5" style={cBox}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data} margin={{top:10,right:14,left:-6,bottom:0}}>
              <defs><linearGradient id="bfArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--c-bodyfat)" stopOpacity={0.32}/><stop offset="100%" stopColor="var(--c-bodyfat)" stopOpacity={0.02}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--line-soft)" vertical={false}/>
              <XAxis dataKey="labelYr" tick={{fill:"var(--t-3)",fontSize:9,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false} interval={1}/>
              <YAxis domain={[28,48]} tick={{fill:"var(--t-3)",fontSize:10,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false} width={28}/>
              <Tooltip content={<Tip/>}/>
              <ReferenceLine y={30} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth={1.5} strokeOpacity={0.6}/>
              <Area type="monotone" dataKey="fatPct" stroke="var(--c-bodyfat)" strokeWidth={2.2} fill="url(#bfArea)" name="Body Fat" dot={{r:3,fill:"var(--c-bodyfat)",stroke:"var(--bg)",strokeWidth:1.5}} activeDot={{r:5,fill:"var(--c-bodyfat)",stroke:"var(--bg)",strokeWidth:2}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <H2 delay={0.32}>Weight & muscle</H2>
        <div className="rise r6" style={cBox}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{top:10,right:14,left:-6,bottom:0}}>
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
        <div style={{display:"flex",gap:6,marginBottom:16}}>{[["today","Today"],["all","Stack"],["history","History"]].map(([k,l])=>(<TabBtn key={k} active={pepSub===k} onClick={()=>setPepSub(k)}>{l}</TabBtn>))}</div>

        {pepSub==="today"&&(<>
          {/* Supply alerts */}
          {userPeps.filter(p=>p.daysSupply<=7&&p.status==="active").length>0&&(
            <div style={{marginBottom:16}}>
              {userPeps.filter(p=>p.daysSupply<=7&&p.status==="active").map(p=>(<div key={p.id} className="rise" style={{background:"color-mix(in oklch, var(--c-danger) 10%, var(--elev-1))",borderLeft:"3px solid var(--c-danger)",borderRadius:"var(--r-sm)",padding:"10px 14px",marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{display:"flex",alignItems:"center",gap:7,fontSize:13,fontWeight:600,color:"var(--c-danger)"}}><Icon n="warn" s={15} c="var(--c-danger)" sw={2}/> {p.name}</span>
                  <span className="mono" style={{fontSize:11.5,fontWeight:600,color:"var(--c-danger)"}}>{p.daysSupply}d left</span>
                </div>
                <div style={{fontSize:11,color:"var(--t-3)",marginTop:4}}>{p.supplyNote}</div>
              </div>))}
            </div>
          )}

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
          {duePeptides.map((p,i)=>{const check=pepData.checks[p.id];const checked=!!check;const time=check?.time||"";const dose=check?.dose||"";const isEditing=editingDose===p.id;return(
            <div key={p.id} className="rise" style={{animationDelay:`${i*0.04}s`,background:"var(--elev-1)",borderLeft:`3px solid ${checked?"var(--c-success)":p.color}`,borderRadius:"var(--r-sm)",padding:"12px 14px",marginBottom:8,opacity:checked?0.78:1,transition:"opacity .25s var(--ease-out)"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <button onClick={()=>togglePep(p.id,p.dose)} className="touch" style={{width:28,height:28,borderRadius:8,border:`1.5px solid ${checked?"var(--c-success)":p.color}`,background:checked?"var(--c-success)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",padding:0,transition:"all .2s var(--ease-out)"}}>{checked&&<Icon n="check" s={16} c="var(--bg)" sw={2.5}/>}</button>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
                    <span style={{fontSize:14,fontWeight:600,color:checked?"var(--t-3)":"var(--t-1)",textDecoration:checked?"line-through":"none"}}>{p.name}</span>
                    <span className="mono" style={{fontSize:9.5,color:p.color,background:`color-mix(in oklch, ${p.color} 14%, transparent)`,padding:"2px 8px",borderRadius:999,letterSpacing:".04em",fontWeight:600,flexShrink:0}}>{p.time}</span>
                  </div>
                  <div className="mono" style={{fontSize:11.5,color:"var(--t-3)",marginTop:3,letterSpacing:".01em"}}>
                    {checked?(<span>✓ {time}{dose?` · ${dose}`:` · ${p.dose}`}</span>):p.dose}
                  </div>
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
                const key=dt.toISOString().slice(0,10);
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
                      let icon=null,bg="transparent",iconColor="var(--t-5)";
                      if(isFuture){icon="";}
                      else if(!scheduled){icon=<span style={{color:"var(--t-5)"}}>–</span>;}
                      else if(taken){icon=<Icon n="check" s={12} c="var(--c-success)" sw={2.5}/>;bg="color-mix(in oklch, var(--c-success) 14%, transparent)";}
                      else{icon=<Icon n="x" s={11} c="var(--c-danger)" sw={2.5}/>;bg="color-mix(in oklch, var(--c-danger) 10%, transparent)";}
                      return(<div key={d.key} style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"7px 0",background:bg,borderBottom:"1px solid var(--line-soft)"}}>{icon}</div>);
                    })}
                  </div>))}
                </div>
                <div style={{display:"flex",gap:14,justifyContent:"center",marginTop:10}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,color:"var(--t-3)"}}><Icon n="check" s={11} c="var(--c-success)" sw={2.5}/> taken</span>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,color:"var(--t-3)"}}><Icon n="x" s={10} c="var(--c-danger)" sw={2.5}/> missed</span>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,color:"var(--t-3)"}}><span style={{color:"var(--t-5)"}}>–</span> not due</span>
                </div>
              </div>);
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
            const cyclePct=p.totalWeeks>0?Math.min(100,(p.week/p.totalWeeks)*100):0;
            const supplyColor=p.daysSupply<=4?"var(--c-danger)":p.daysSupply<=14?"var(--c-warn)":"var(--c-success)";
            const daysToEnd=p.cycleEnd?Math.max(0,Math.round((new Date(p.cycleEnd)-new Date())/(1000*60*60*24))):null;
            return(<div key={p.id} className="rise" style={{animationDelay:`${i*0.04}s`,background:"var(--elev-1)",borderLeft:`3px solid ${p.color}`,borderRadius:"var(--r-sm)",padding:"14px 16px",marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:15,fontWeight:600,color:p.color}}>{p.name}</span>
                <div style={{display:"flex",gap:5}}>
                  {p.totalWeeks>0&&<span className="mono" style={{fontSize:10,color:"var(--t-3)",background:"var(--elev-2)",padding:"3px 9px",borderRadius:999,letterSpacing:".02em"}}>Wk {p.week}/{p.totalWeeks}</span>}
                  {p.status==="prn"&&<span style={{fontSize:10,color:"var(--c-warn)",background:"color-mix(in oklch, var(--c-warn) 14%, transparent)",padding:"3px 9px",borderRadius:999,fontWeight:600,letterSpacing:".06em"}}>PRN</span>}
                </div>
              </div>
              <div className="mono" style={{fontSize:12,color:"var(--t-2)",letterSpacing:".01em"}}>{p.dose}</div>
              <div style={{fontSize:11.5,color:"var(--t-3)",marginTop:3}}>{p.time} · {p.note}</div>
              <div style={{fontSize:11,color:"var(--t-4)",marginTop:6,lineHeight:1.5,paddingLeft:10,borderLeft:`1.5px solid color-mix(in oklch, ${p.color} 30%, transparent)`,fontStyle:"italic"}}>{p.purpose}</div>
              {p.totalWeeks>0&&(<div style={{marginTop:10}}>
                <div className="mono" style={{display:"flex",justifyContent:"space-between",fontSize:9.5,color:"var(--t-3)",marginBottom:4,letterSpacing:".06em",textTransform:"uppercase"}}><span>Cycle</span><span>{daysToEnd!==null?`${daysToEnd}d left`:""}</span></div>
                <div className="hbar" style={{height:3}}><i style={{width:`${cyclePct}%`,background:p.color,opacity:.6}}/></div>
              </div>)}
              <div style={{marginTop:8}}>
                <div className="mono" style={{display:"flex",justifyContent:"space-between",fontSize:9.5,color:"var(--t-3)",marginBottom:4,letterSpacing:".06em",textTransform:"uppercase"}}><span>Supply</span><span style={{color:supplyColor,fontWeight:600}}>{p.dosesLeft} doses · {p.daysSupply}d</span></div>
                <div className="hbar" style={{height:3}}><i style={{width:`${Math.min(100,p.daysSupply/30*100)}%`,background:supplyColor,opacity:.55}}/></div>
              </div>
              <div style={{fontSize:10.5,color:"var(--t-4)",marginTop:5,fontStyle:"italic"}}>{p.supplyNote}</div>
            </div>);
          })}

          {userPeps.filter(p=>p.status==="starting").length>0&&<>
            <H2>Starting soon</H2>
            {userPeps.filter(p=>p.status==="starting").map(p=>(<div key={p.id} className="rise" style={{background:"var(--elev-1)",borderLeft:`3px solid ${p.color}`,borderRadius:"var(--r-sm)",padding:"13px 16px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:14,fontWeight:600,color:p.color}}>{p.name}</span>
                <span className="mono" style={{fontSize:10.5,color:"var(--t-3)"}}>{p.dosesLeft} doses ready</span>
              </div>
              <div className="mono" style={{fontSize:12,color:"var(--t-2)",marginTop:3}}>{p.dose}</div>
              <div style={{fontSize:11,color:"var(--t-3)",marginTop:2}}>{p.note}</div>
              <div style={{fontSize:11,color:"var(--t-4)",marginTop:5,lineHeight:1.5,fontStyle:"italic"}}>{p.purpose}</div>
            </div>))}
          </>}

          {userPeps.filter(p=>p.status==="break").length>0&&<>
            <H2>On break</H2>
            {userPeps.filter(p=>p.status==="break").map(p=>(<div key={p.id} className="rise" style={{background:"var(--elev-1)",borderRadius:"var(--r-sm)",padding:"11px 16px",marginBottom:6,opacity:.6}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,color:"var(--t-2)",display:"inline-flex",alignItems:"center",gap:6}}><Icon n="pause" s={12} c="var(--t-4)"/> {p.name}</span>
                <span className="mono" style={{fontSize:10,color:"var(--t-4)"}}>{p.dosesLeft} for C2</span>
              </div>
              <div style={{fontSize:11.5,color:"var(--t-4)",marginTop:3}}>{p.note}</div>
            </div>))}
          </>}
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
        <H2 sub="3 scenarios from your current scan">Timeline to 30%</H2>
        <div style={{display:"flex",gap:8,marginBottom:22,flexWrap:"wrap"}}>{etaMonths.map((s,i)=>(<div key={i} className="rise" style={{animationDelay:`${i*0.06}s`,flex:"1 1 92px",background:"var(--elev-1)",borderLeft:`3px solid ${s.color}`,borderRadius:"var(--r-sm)",padding:"14px 12px",textAlign:"center"}}>
          <div style={{fontSize:9.5,color:"var(--t-3)",textTransform:"uppercase",letterSpacing:".10em",marginBottom:6,fontWeight:600}}>{s.name}</div>
          <div className="serif tabular" style={{fontSize:38,color:s.color,fontStyle:"italic",lineHeight:.95}}>{s.months}<span style={{fontSize:14,color:"var(--t-3)",marginLeft:1}}>mo</span></div>
          <div className="mono" style={{fontSize:10,color:"var(--t-4)",marginTop:4,letterSpacing:".01em"}}>{s.rate} kg / mo</div>
        </div>))}</div>
        <div className="rise r4" style={cBox}><ResponsiveContainer width="100%" height={260}>
          <LineChart data={projections} margin={{top:10,right:14,left:-6,bottom:0}}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--line-soft)" vertical={false}/>
            <XAxis dataKey="label" tick={{fill:"var(--t-3)",fontSize:9,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false}/>
            <YAxis domain={[26,40]} tick={{fill:"var(--t-3)",fontSize:10,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false} width={28}/>
            <Tooltip content={<Tip/>}/>
            <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:11,color:"var(--t-3)",fontFamily:"Geist Mono",paddingTop:4}}/>
            <ReferenceLine y={30} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth={1.5} strokeOpacity={0.6}/>
            {scenarios.map(s=>(<Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} name={s.name} dot={false} strokeDasharray={s.name==="On Track"?"0":"5 4"}/>))}
          </LineChart>
        </ResponsiveContainer></div>
      </>)}

      {/* ═══ MONTHLY ═══ */}
      {tab==="monthly"&&(<>
        <H2 sub="Average body fat by month">Monthly trend</H2>
        <div className="rise r2" style={cBox}><ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthly} margin={{top:10,right:14,left:-6,bottom:0}}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--line-soft)" vertical={false}/>
            <XAxis dataKey="label" tick={{fill:"var(--t-3)",fontSize:9,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false}/>
            <YAxis domain={[30,48]} tick={{fill:"var(--t-3)",fontSize:10,fontFamily:"Geist Mono"}} axisLine={false} tickLine={false} width={28}/>
            <Tooltip content={<Tip/>}/>
            <ReferenceLine y={30} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth={1.5} strokeOpacity={0.6}/>
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
        <H2 sub="Log your daily Whoop metrics">Today's recovery</H2>

        {whoopData?(<>
          <div style={{display:"flex",gap:8,marginBottom:18}}>
            {[
              {k:"recovery",l:"Recovery",v:whoopData.recovery,u:"%",color:whoopData.recovery>=67?"var(--c-success)":whoopData.recovery>=34?"var(--c-warn)":"var(--c-danger)",icon:"heart"},
              {k:"sleep",l:"Sleep",v:whoopData.sleep,u:"%",color:whoopData.sleep>=85?"var(--c-success)":whoopData.sleep>=70?"var(--c-warn)":"var(--c-danger)",icon:"sleep"},
              {k:"strain",l:"Strain",v:whoopData.strain,u:"",color:whoopData.strain>=14?"var(--c-danger)":whoopData.strain>=8?"var(--c-warn)":"var(--c-carbs)",icon:"strain"},
            ].map((m,i)=>(<div key={m.k} className="rise" style={{animationDelay:`${i*0.06}s`,flex:1,background:"var(--elev-1)",borderLeft:`3px solid ${m.color}`,borderRadius:"var(--r-sm)",padding:"14px 8px",textAlign:"center"}}>
              <Icon n={m.icon} s={18} c={m.color} sw={1.7}/>
              <div className="serif tabular" style={{fontSize:32,color:m.color,marginTop:6,fontStyle:"italic",lineHeight:1}}>{m.v}<span style={{fontSize:13,color:"var(--t-3)"}}>{m.u}</span></div>
              <div style={{fontSize:10,color:"var(--t-3)",marginTop:4,letterSpacing:".08em",textTransform:"uppercase",fontWeight:600}}>{m.l}</div>
            </div>))}
          </div>
          <button onClick={()=>{setWhoopData(null);setWhoopInput({recovery:"",sleep:"",strain:""});}} className="touch" style={{width:"100%",padding:"11px",borderRadius:"var(--r-sm)",border:"1px solid var(--line-soft)",background:"transparent",color:"var(--t-3)",fontSize:12,cursor:"pointer"}}>Edit today's entry</button>
        </>):(
          <div className="rise" style={{background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:18,marginBottom:18}}>
            <div style={{fontSize:12,color:"var(--t-3)",marginBottom:14}}>From your Whoop app this morning:</div>
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
            <LineChart data={whoopHist.slice(0,7).reverse()} margin={{top:10,right:14,left:-6,bottom:0}}>
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

      {/* ═══ DATA ═══ */}
      {tab==="data"&&(<>
        <div className="rise" style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14,marginTop:24}}>
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
