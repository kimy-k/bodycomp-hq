import { useState, useEffect, useMemo, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine, Legend, Cell } from "recharts";

/* ═══ SUPABASE ═══ */
const SB="https://xstinpgwhpjwoohpkjgn.supabase.co/rest/v1";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdGlucGd3aHBqd29vaHBramduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MTI4MzksImV4cCI6MjA5NDQ4ODgzOX0.XVrnWxg4MXOB9iBxkq9rP9T8XBsBjS8Ff85jC4MhLPc";
const hdr={apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`,"Content-Type":"application/json"};
const makeDb=(uid)=>({
  async get(table,dateVal){try{const r=await fetch(`${SB}/${table}?user_id=eq.${uid}&date=eq.${dateVal}&select=*`,{headers:hdr});const d=await r.json();return d[0]||null;}catch{return null;}},
  async upsert(table,row){try{await fetch(`${SB}/${table}`,{method:"POST",headers:{...hdr,Prefer:"resolution=merge-duplicates"},body:JSON.stringify({...row,user_id:uid})});}catch(e){console.error("db upsert:",e);}},
  async list(table,limit=14){try{const r=await fetch(`${SB}/${table}?user_id=eq.${uid}&select=*&order=date.desc&limit=${limit}`,{headers:hdr});return await r.json();}catch{return[];}},
  async del(table,dateVal){try{await fetch(`${SB}/${table}?user_id=eq.${uid}&date=eq.${dateVal}`,{method:"DELETE",headers:hdr});}catch{}},
  async getConfig(key){try{const r=await fetch(`${SB}/config?user_id=eq.${uid}&key=eq.${key}&select=*`,{headers:hdr});const d=await r.json();return d[0]?.value||null;}catch{return null;}},
  async setConfig(key,value){try{await fetch(`${SB}/config`,{method:"POST",headers:{...hdr,Prefer:"resolution=merge-duplicates"},body:JSON.stringify({user_id:uid,key,value,updated_at:new Date().toISOString()})});}catch{}},
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
// TARGETS defined per profile inside component
const COL = {cal:"#a78bfa",protein:"#f472b6",fat:"#fbbf24",carbs:"#60a5fa"};
const calcCal = (p,f,c) => Math.round((p||0)*4+(f||0)*9+(c||0)*4);

/* ═══ PEPTIDE CONFIG ═══ */
const PEPTIDES = [
  {id:"reta",users:["kim"],name:"Retatrutide",dose:"2.5mg (25u)",schedule:[2],time:"AM",status:"active",startDate:"2026-03-10",week:10,totalWeeks:12,cycleEnd:"2026-06-01",note:"Bump to 4mg May 19",color:"#f87171",dosesLeft:5,daysSupply:35,supplyNote:"Pen 2 + RTA backup",purpose:"Triple agonist (GLP-1/GIP/Glucagon). Suppresses appetite, accelerates fat loss, improves insulin sensitivity. Your primary weight-loss peptide."},
  {id:"klow",users:["kim","bernadette"],name:"Klow",dose:"40u (10.7mg)",schedule:[0,1,2,3,4,5,6],time:"PM",status:"active",startDate:"2026-05-01",week:3,totalWeeks:4,cycleEnd:"2026-05-28",note:"Daily · Cycle ends May 28",color:"#34d399",dosesLeft:7,daysSupply:7,supplyNote:"⚠️ ~1 week left",purpose:"4-in-1 blend: BPC-157 (gut healing) + TB-500 (tissue repair) + GHK-Cu (skin/collagen) + KPV (anti-inflammatory). Recovery, healing, skin quality."},
  {id:"nad",users:["kim","bernadette"],name:"NAD+",dose:"50mg (30u)",schedule:[1,3],time:"AM",status:"active",startDate:"2026-04-06",week:6,totalWeeks:12,cycleEnd:"2026-06-29",note:"Mon/Wed",color:"#60a5fa",dosesLeft:40,daysSupply:140,supplyNote:"5 vials · well stocked",purpose:"Cellular energy currency. Activates sirtuins (longevity genes), supports DNA repair, boosts mitochondrial function. Anti-aging and metabolic support."},
  {id:"ta1",users:["kim","bernadette"],name:"Thymosin Alpha-1",dose:"1.5mg (15u)",schedule:[1,4],time:"AM",status:"active",startDate:"2026-05-16",week:1,totalWeeks:8,cycleEnd:"2026-07-11",note:"Mon/Thu · Just started",color:"#c084fc",dosesLeft:6,daysSupply:21,supplyNote:"2 vials × 3 doses",purpose:"Immune modulator from the thymus. Boosts T-cell function, enhances immune surveillance, anti-viral/anti-tumor activity. Strengthens immune system."},
  {id:"amino",users:["kim","bernadette"],name:"5-Amino-1MQ",dose:"2.5mg (25u) BID",schedule:[0,1,2,3,4,5,6],time:"AM+PM",status:"active",startDate:"2026-05-16",week:1,totalWeeks:4,cycleEnd:"2026-06-13",note:"Daily BID · Just started",color:"#fb923c",dosesLeft:4,daysSupply:4,supplyNote:"🔴 4 days only! Reorder now",purpose:"NNMT enzyme inhibitor. Blocks fat storage pathway, increases metabolic rate, promotes fat cell energy expenditure. Direct fat-loss mechanism separate from Reta."},
  {id:"snap8",users:["kim","bernadette"],name:"Snap-8",dose:"Topical AM+PM",schedule:[0,1,2,3,4,5,6],time:"AM+PM",status:"active",startDate:"2026-05-16",week:1,totalWeeks:12,cycleEnd:"2026-08-08",note:"Topical",color:"#e879f9",dosesLeft:28,daysSupply:28,supplyNote:"1 vial ~4 weeks",purpose:"Acetyl octapeptide-3 (topical). Relaxes facial muscles like mild Botox — reduces fine lines and wrinkles. Applied to skin, not injected."},
  {id:"cjcipa",users:["kim","bernadette"],name:"CJC+Ipamorelin",dose:"100mcg ea (3u)",schedule:[1,2,3,4,5],time:"Bedtime",status:"starting",startDate:"2026-05-17",week:0,totalWeeks:12,cycleEnd:"2026-08-09",note:"Starts May 17 · 5on/2off",color:"#2dd4bf",dosesLeft:60,daysSupply:84,supplyNote:"2 vials · 12+ weeks",purpose:"Dual GH secretagogue. CJC amplifies natural growth hormone pulses, Ipamorelin triggers them. Together: deeper sleep, fat loss, recovery, skin, anti-aging. Tesamorelin replacement without nightmares."},
  {id:"semax",users:["kim","bernadette"],name:"Semax+Selank",dose:"200mcg x2 daily",schedule:[1,2,3,4,5],time:"AM+Lunch",status:"prn",startDate:"2026-04-20",week:0,totalWeeks:0,note:"PRN for focus",color:"#fcd34d",dosesLeft:60,daysSupply:60,supplyNote:"~60 doses per bottle",purpose:"Nootropic nasal sprays. Semax: boosts BDNF, sharpens focus and memory. Selank: anxiolytic, calms without sedation. Together: calm clarity for demanding work."},
  {id:"motsc",users:["kim","bernadette"],name:"MOTS-c",dose:"1.5mg (30u)",schedule:[],time:"—",status:"break",startDate:"2026-04-14",week:0,totalWeeks:5,cycleEnd:null,note:"Break until ~Jun 10 · 2 vials ready for Cycle 2",color:"#94a3b8",dosesLeft:12,daysSupply:42,supplyNote:"2 Pepmuse vials for C2",purpose:"Mitochondrial peptide. Enhances exercise capacity, improves insulin sensitivity, activates AMPK (the exercise-mimetic pathway). Makes workouts more effective."},
  {id:"glow",users:["kim","bernadette"],name:"Glow",dose:"30u (7mg)",schedule:[],time:"—",status:"break",startDate:"2026-03-12",week:0,totalWeeks:8,cycleEnd:null,note:"Break until ~May 21",color:"#94a3b8",dosesLeft:10,daysSupply:21,supplyNote:"Vials available",purpose:"3-in-1 blend: BPC-157 + TB-500 + GHK-Cu. Same as Klow minus KPV. Healing, recovery, skin/collagen. Original version before switching to Klow."},
];

/* ═══ HELPERS ═══ */
const enrich = d => {const fm=+(d.weight*d.fatPct/100).toFixed(1);return{...d,fatMass:fm,leanMass:+(d.weight-fm).toFixed(1),label:new Date(d.date).toLocaleDateString("en-US",{month:"short",day:"numeric"}),labelYr:new Date(d.date).toLocaleDateString("en-US",{month:"short",year:"2-digit"})};};
const todayKey = () => new Date().toISOString().slice(0,10);
const buildProj = last => {
  const sc=[{name:"Conservative",rate:0.6,color:"#fbbf24"},{name:"On Track",rate:1.0,color:"#a78bfa"},{name:"Aggressive",rate:1.4,color:"#4ade80"}];
  const p=[];for(let m=0;m<=12;m++){const dt=new Date(last.date);dt.setMonth(dt.getMonth()+m);const e={month:m,label:dt.toLocaleDateString("en-US",{month:"short",year:"2-digit"})};sc.forEach(s=>{const fm=Math.max(last.fatMass-s.rate*m,8);const tw=last.leanMass+fm;e[s.name]=+((fm/tw)*100).toFixed(1);});p.push(e);}
  return{scenarios:sc,projections:p};
};
const calcMonthly = data => {
  const m={};data.forEach(d=>{const k=d.date.substring(0,7);if(!m[k])m[k]=[];m[k].push(d);});
  return Object.keys(m).sort().map(k=>{const s=m[k];return{label:new Date(k+"-15").toLocaleDateString("en-US",{month:"short",year:"2-digit"}),avgFat:+(s.reduce((a,d)=>a+d.fatMass,0)/s.length).toFixed(1),avgPct:+(s.reduce((a,d)=>a+d.fatPct,0)/s.length).toFixed(1),avgMuscle:+(s.reduce((a,d)=>a+d.muscle,0)/s.length).toFixed(1),count:s.length};});
};

/* ═══ SHARED UI ═══ */
const Tip=({active,payload,label})=>!active||!payload?.length?null:(<div style={{background:"#1a1a2e",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#e0e0e0"}}><div style={{fontWeight:700,marginBottom:4,color:"#fff"}}>{label}</div>{payload.map((p,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}><span style={{width:8,height:8,borderRadius:"50%",background:p.color,display:"inline-block"}}/><span style={{opacity:0.7}}>{p.name}:</span><span style={{fontWeight:600,color:p.color}}>{p.value}</span></div>))}</div>);
const Card=({title,value,unit,sub,color,icon})=>(<div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:"14px 16px",flex:"1 1 140px",minWidth:140}}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,fontWeight:600}}>{icon} {title}</div><div style={{fontSize:24,fontWeight:800,color,letterSpacing:-1}}>{value}<span style={{fontSize:12,fontWeight:400,opacity:0.6,marginLeft:2}}>{unit}</span></div>{sub&&<div style={{fontSize:10,marginTop:3,color:"rgba(255,255,255,0.3)"}}>{sub}</div>}</div>);
const H2=({children,sub})=>(<div style={{marginBottom:12,marginTop:28}}><h2 style={{fontSize:16,fontWeight:700,color:"#fff",margin:0}}>{children}</h2>{sub&&<p style={{fontSize:11,color:"rgba(255,255,255,0.3)",margin:"2px 0 0"}}>{sub}</p>}</div>);
const TabBtn=({active,onClick,children})=>(<button onClick={onClick} style={{padding:"6px 10px",borderRadius:18,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:active?"rgba(167,139,250,0.2)":"transparent",color:active?"#a78bfa":"rgba(255,255,255,0.35)",outline:active?"1px solid rgba(167,139,250,0.3)":"none",whiteSpace:"nowrap"}}>{children}</button>);
const Ring=({pct,color,size=64,stroke=6,children})=>{const r=(size-stroke)/2;const ci=2*Math.PI*r;return(<div style={{position:"relative",width:size,height:size}}><svg width={size} height={size} style={{transform:"rotate(-90deg)"}}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={pct>100?"#f87171":color} strokeWidth={stroke} strokeDasharray={`${ci*Math.min(pct,100)/100} ${ci}`} strokeLinecap="round"/></svg><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{children}</div></div>);};
const Insight=({icon,title,text,color})=>(<div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:14,padding:"13px 15px",marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><span style={{fontSize:14}}>{icon}</span><span style={{fontSize:13,fontWeight:700,color}}>{title}</span></div><div style={{fontSize:12,lineHeight:1.6,color:"rgba(255,255,255,0.5)"}}>{text}</div></div>);
const cBox={background:"rgba(255,255,255,0.02)",borderRadius:16,padding:"14px 6px 6px",border:"1px solid rgba(255,255,255,0.04)"};
const inp={width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"};

/* ═══ MAIN ═══ */
/* ═══ STYLES ═══ */
const FONT_URL="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap";
const STYLE=`@import url('${FONT_URL}');
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes fillBar{from{width:0}to{width:var(--fill)}}
@keyframes pop{0%{transform:scale(0.8)}50%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.fade-in{animation:fadeIn 0.4s ease both}
.pop{animation:pop 0.3s ease both}
.slide-up{animation:slideUp 0.35s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{font-family:'Outfit',sans-serif;margin:0}
input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}`;

/* ═══ ONBOARDING WIZARD ═══ */
const AVAILABLE_PEPS=[
  {id:"klow",name:"Klow (BPC+TB+GHK+KPV)",color:"#34d399"},
  {id:"nad",name:"NAD+",color:"#60a5fa"},
  {id:"ta1",name:"Thymosin Alpha-1",color:"#c084fc"},
  {id:"amino",name:"5-Amino-1MQ",color:"#fb923c"},
  {id:"snap8",name:"Snap-8 (topical)",color:"#e879f9"},
  {id:"cjcipa",name:"CJC+Ipamorelin",color:"#2dd4bf"},
  {id:"semax",name:"Semax+Selank",color:"#fcd34d"},
  {id:"motsc",name:"MOTS-c",color:"#94a3b8"},
  {id:"glow",name:"Glow (BPC+TB+GHK)",color:"#6ee7b7"},
  {id:"reta",name:"Retatrutide",color:"#f87171"},
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
  const bg="linear-gradient(135deg,#0f0f1a 0%,#1a1025 50%,#0f0f1a 100%)";
  const inp={width:"100%",padding:"14px 16px",borderRadius:14,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",color:"#fff",fontSize:16,fontFamily:"Outfit",outline:"none"};
  const btn=(active)=>({width:"100%",padding:"16px",borderRadius:16,border:"none",background:active?"linear-gradient(135deg,#a78bfa,#7c3aed)":"rgba(255,255,255,0.06)",color:active?"#fff":"rgba(255,255,255,0.2)",fontSize:16,fontWeight:700,fontFamily:"Outfit",cursor:active?"pointer":"default"});

  const steps=[
    // Step 0: Welcome
    <div key={0} className="slide-up" style={{textAlign:"center",padding:"60px 0"}}>
      <div style={{fontSize:64,marginBottom:20}}>📊</div>
      <h1 style={{fontSize:28,fontWeight:800,color:"#fff",margin:"0 0 8px",letterSpacing:"-0.5px"}}>Body Comp HQ</h1>
      <p style={{fontSize:15,color:"rgba(255,255,255,0.4)",margin:"0 0 40px",lineHeight:1.6}}>Track your body composition, nutrition, peptides, and recovery — all in one place.</p>
      <button onClick={()=>setStep(1)} style={btn(true)}>Let's Get Started</button>
    </div>,
    // Step 1: Profile
    <div key={1} className="slide-up">
      <h2 style={{fontSize:22,fontWeight:800,color:"#fff",margin:"0 0 4px"}}>About You</h2>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.35)",margin:"0 0 24px"}}>We'll calculate your BMR, TDEE, and recommended deficit</p>
      <label style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:6,display:"block",fontWeight:600}}>YOUR NAME</label>
      <input value={d.name} onChange={e=>up("name",e.target.value)} placeholder="e.g. Bernadette" style={{...inp,marginBottom:16}}/>
      <div style={{display:"flex",gap:12,marginBottom:16}}>
        <div style={{flex:1}}><label style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:6,display:"block",fontWeight:600}}>AGE</label><input type="number" value={d.age} onChange={e=>up("age",e.target.value)} placeholder="30" style={inp}/></div>
        <div style={{flex:1}}><label style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:6,display:"block",fontWeight:600}}>GENDER</label><div style={{display:"flex",gap:6}}>{[["female","♀ Female"],["male","♂ Male"]].map(([v,l])=>(<button key={v} onClick={()=>up("gender",v)} style={{flex:1,padding:"12px 8px",borderRadius:12,border:`1px solid ${d.gender===v?"#a78bfa44":"rgba(255,255,255,0.06)"}`,background:d.gender===v?"rgba(167,139,250,0.1)":"transparent",color:d.gender===v?"#a78bfa":"rgba(255,255,255,0.3)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"Outfit"}}>{l}</button>))}</div></div>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:16}}>
        <div style={{flex:1}}><label style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:6,display:"block",fontWeight:600}}>HEIGHT (cm)</label><input type="number" value={d.height} onChange={e=>up("height",e.target.value)} placeholder="155" style={inp}/></div>
        <div style={{flex:1}}><label style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:6,display:"block",fontWeight:600}}>WEIGHT (kg)</label><input type="number" value={d.weight} onChange={e=>up("weight",e.target.value)} placeholder="54" style={inp}/></div>
      </div>
      <label style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:8,display:"block",fontWeight:600}}>ACTIVITY LEVEL</label>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:20}}>
        {[["sedentary","Sedentary","Office job, little exercise"],["light","Lightly Active","Light exercise 1-3 days/week"],["moderate","Moderately Active","Moderate exercise 3-5 days/week"],["active","Very Active","Hard exercise 6-7 days/week"]].map(([v,l,desc])=>(<button key={v} onClick={()=>up("activity",v)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderRadius:12,border:`1px solid ${d.activity===v?"#a78bfa44":"rgba(255,255,255,0.06)"}`,background:d.activity===v?"rgba(167,139,250,0.08)":"transparent",cursor:"pointer",textAlign:"left"}}>
          <div><div style={{fontSize:13,color:d.activity===v?"#a78bfa":"rgba(255,255,255,0.5)",fontWeight:600,fontFamily:"Outfit"}}>{l}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.2)",fontFamily:"Outfit"}}>{desc}</div></div>
          {d.activity===v&&<span style={{color:"#a78bfa",fontSize:16}}>✓</span>}
        </button>))}
      </div>
      {/* Live BMR/TDEE preview */}
      {d.weight&&d.height&&d.age&&(()=>{
        const bmr=d.gender==="male"?10*(+d.weight)+6.25*(+d.height)-5*(+d.age)+5:10*(+d.weight)+6.25*(+d.height)-5*(+d.age)-161;
        const mult={sedentary:1.2,light:1.375,moderate:1.55,active:1.725}[d.activity]||1.375;
        const tdee=Math.round(bmr*mult);
        return(<div style={{background:"rgba(167,139,250,0.06)",border:"1px solid rgba(167,139,250,0.15)",borderRadius:14,padding:14,marginBottom:20}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:8}}>YOUR ESTIMATED NUMBERS</div>
          <div style={{display:"flex",justifyContent:"space-around",textAlign:"center"}}>
            <div><div style={{fontSize:22,fontWeight:800,color:"#60a5fa"}}>{Math.round(bmr)}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>BMR</div></div>
            <div><div style={{fontSize:22,fontWeight:800,color:"#a78bfa"}}>{tdee}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>TDEE</div></div>
            <div><div style={{fontSize:22,fontWeight:800,color:"#4ade80"}}>{Math.round(tdee*0.8)}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>20% deficit</div></div>
          </div>
        </div>);
      })()}
      <button onClick={()=>setStep(2)} style={btn(d.name&&d.weight&&d.height)}>Continue</button>
    </div>,
    // Step 2: Goals & Nutrition
    <div key={2} className="slide-up">
      <h2 style={{fontSize:22,fontWeight:800,color:"#fff",margin:"0 0 4px"}}>Goals & Nutrition</h2>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.35)",margin:"0 0 24px"}}>Set your targets — we'll track your progress daily</p>
      <label style={{fontSize:12,color:"#f472b6",marginBottom:6,display:"block",fontWeight:700}}>TARGET BODY FAT %</label>
      <p style={{fontSize:11,color:"rgba(255,255,255,0.2)",margin:"-2px 0 8px"}}>What body fat percentage are you working toward?</p>
      <input type="number" value={d.targetBf} onChange={e=>up("targetBf",e.target.value)} placeholder="30" style={{...inp,fontSize:28,fontWeight:800,textAlign:"center",marginBottom:24}}/>
      <div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,padding:16,marginBottom:20,border:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:4}}>Daily Meal Plan</div>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.25)",margin:"0 0 12px"}}>Enter your meal plan targets (from your nutritionist or app)</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={{fontSize:10,color:"#a78bfa",fontWeight:700,display:"block",marginBottom:4}}>CALORIES (kcal)</label><input type="number" value={d.targetCal} onChange={e=>up("targetCal",e.target.value)} placeholder="1600" style={inp}/></div>
          <div><label style={{fontSize:10,color:"#f472b6",fontWeight:700,display:"block",marginBottom:4}}>PROTEIN (g)</label><input type="number" value={d.targetProtein} onChange={e=>up("targetProtein",e.target.value)} placeholder="120" style={inp}/></div>
          <div><label style={{fontSize:10,color:"#fbbf24",fontWeight:700,display:"block",marginBottom:4}}>FAT (g)</label><input type="number" value={d.targetFat} onChange={e=>up("targetFat",e.target.value)} placeholder="50" style={inp}/></div>
          <div><label style={{fontSize:10,color:"#60a5fa",fontWeight:700,display:"block",marginBottom:4}}>CARBS (g)</label><input type="number" value={d.targetCarbs} onChange={e=>up("targetCarbs",e.target.value)} placeholder="150" style={inp}/></div>
        </div>
      </div>
      <div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,padding:16,marginBottom:24,border:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:4}}>Whey Protein</div>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.25)",margin:"0 0 12px"}}>Do you take whey protein? Enter per-scoop protein (g) and daily scoops</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={{fontSize:10,color:"#f472b6",fontWeight:700,display:"block",marginBottom:4}}>PROTEIN/SCOOP (g)</label><input type="number" value={d.wheyProtein} onChange={e=>up("wheyProtein",e.target.value)} placeholder="25" style={inp}/></div>
          <div><label style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontWeight:700,display:"block",marginBottom:4}}>SCOOPS/DAY</label><input type="number" value={d.wheyScoops} onChange={e=>up("wheyScoops",e.target.value)} placeholder="2" style={inp}/></div>
        </div>
      </div>
      <button onClick={()=>setStep(3)} style={btn(true)}>Continue</button>
    </div>,
    // Step 3: Peptides
    <div key={3} className="slide-up">
      <h2 style={{fontSize:22,fontWeight:800,color:"#fff",margin:"0 0 4px"}}>Your Peptides</h2>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.35)",margin:"0 0 20px"}}>Select which peptides you're currently taking</p>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>
        {AVAILABLE_PEPS.map(p=>{const on=d.peptides.includes(p.id);return(
          <button key={p.id} onClick={()=>togglePep(p.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:12,border:`1px solid ${on?p.color+"44":"rgba(255,255,255,0.06)"}`,background:on?p.color+"12":"transparent",cursor:"pointer",textAlign:"left"}}>
            <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${on?p.color:"rgba(255,255,255,0.15)"}`,background:on?p.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#0a0a14",flexShrink:0}}>{on?"✓":""}</div>
            <span style={{fontSize:14,color:on?"#fff":"rgba(255,255,255,0.4)",fontWeight:on?600:400,fontFamily:"Outfit"}}>{p.name}</span>
          </button>
        );})}
      </div>
      <button onClick={()=>setStep(4)} style={btn(true)}>{d.peptides.length>0?`Continue with ${d.peptides.length} peptides`:"Skip — no peptides"}</button>
    </div>,
    // Step 4: First InBody scan
    <div key={4} className="slide-up">
      <h2 style={{fontSize:22,fontWeight:800,color:"#fff",margin:"0 0 4px"}}>Your Latest InBody Scan</h2>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.35)",margin:"0 0 24px"}}>Add your most recent scan — or skip and add later</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
        <div><label style={{fontSize:10,color:"#a78bfa",fontWeight:700,display:"block",marginBottom:4}}>WEIGHT (kg)</label><input type="number" step="0.1" value={d.scanWeight} onChange={e=>up("scanWeight",e.target.value)} placeholder="54.1" style={{...inp,textAlign:"center",fontSize:18,fontWeight:700}}/></div>
        <div><label style={{fontSize:10,color:"#34d399",fontWeight:700,display:"block",marginBottom:4}}>MUSCLE (kg)</label><input type="number" step="0.1" value={d.scanMuscle} onChange={e=>up("scanMuscle",e.target.value)} placeholder="18.0" style={{...inp,textAlign:"center",fontSize:18,fontWeight:700}}/></div>
        <div><label style={{fontSize:10,color:"#f472b6",fontWeight:700,display:"block",marginBottom:4}}>BODY FAT %</label><input type="number" step="0.1" value={d.scanFat} onChange={e=>up("scanFat",e.target.value)} placeholder="37.6" style={{...inp,textAlign:"center",fontSize:18,fontWeight:700}}/></div>
      </div>
      <label style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontWeight:600,display:"block",marginBottom:4}}>SCAN DATE</label>
      <input type="date" value={d.scanDate} onChange={e=>up("scanDate",e.target.value)} style={{...inp,colorScheme:"dark",marginBottom:24}}/>
      <button onClick={finish} style={btn(true)}>{d.scanWeight?"Save & Launch":"Skip — I'll add later"}</button>
    </div>,
  ];

  return(
    <div style={{minHeight:"100vh",background:bg,padding:"24px 20px",maxWidth:480,margin:"0 auto",fontFamily:"Outfit"}}>
      <style>{STYLE}</style>
      {step>0&&<div style={{display:"flex",gap:4,marginBottom:28}}>{[1,2,3,4].map(i=>(<div key={i} style={{flex:1,height:3,borderRadius:2,background:i<=step?"#a78bfa":"rgba(255,255,255,0.06)"}}/>))}</div>}
      {step>0&&<button onClick={()=>setStep(step-1)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",fontSize:13,cursor:"pointer",padding:0,marginBottom:16,fontFamily:"Outfit"}}>← Back</button>}
      {steps[step]}
    </div>
  );
}

export default function Dashboard(){
  const [tab,setTab]=useState("macros");
  const urlUser=useMemo(()=>{try{const p=new URLSearchParams(window.location.search);return p.get("user");}catch{return null;}},[]);
  const [userId,setUserId]=useState(urlUser||"kim");
  const locked=!!urlUser;
  const [userConfig,setUserConfig]=useState(null);
  const defaultProfile=PROFILES[userId]||PROFILES.kim;
  const profile=userConfig?{...defaultProfile,name:userConfig.name||defaultProfile.name,targets:userConfig.targets||defaultProfile.targets}:defaultProfile;
  const db=useMemo(()=>makeDb(userId),[userId]);
  const TARGETS=profile.targets;

  // Onboarding check
  const [onboarded,setOnboarded]=useState(null); // null=loading, true/false
  useEffect(()=>{(async()=>{const ob=await db.getConfig("onboarded");const cfg=await db.getConfig("profile");if(cfg)setUserConfig(cfg);setOnboarded(!!ob);})();},[db]);

  const handleOnboardComplete=(cfg)=>{setUserConfig(cfg);setOnboarded(true);};

  // Show loading
  if(onboarded===null)return(<div style={{minHeight:"100vh",background:"#0f0f1a",display:"flex",alignItems:"center",justifyContent:"center"}}><style>{STYLE}</style><div style={{color:"rgba(255,255,255,0.3)",fontSize:14,fontFamily:"Outfit"}}>Loading...</div></div>);
  // Show onboarding
  if(!onboarded)return <Onboarding db={db} onComplete={handleOnboardComplete}/>;

  const [dark,setDark]=useState(true);
  useEffect(()=>{(async()=>{const t=await db.getConfig("theme");if(t==="light")setDark(false);})();},[db]);
  const toggleTheme=()=>{const next=!dark;setDark(next);db.setConfig("theme",next?"dark":"light");};

  // Scans: hardcoded + user-added from storage
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
  const pctDone=data.length>0?Math.min(100,+(((first.fatPct-last.fatPct)/(first.fatPct-goalPct))*100).toFixed(0)):0;
  const {scenarios,projections}=useMemo(()=>buildProj(last),[last]);
  const etaMonths=scenarios.map(s=>{const h=projections.find(p=>p[s.name]<=30);return{...s,months:h?h.month:">12"};});

  /* ═══ MACRO STATE ═══ */
  const MEAL_TAGS=["Lunch","Snack","Dinner","Breakfast","Other"];
  const [meals,setMeals]=useState([]);const [wheyOn,setWheyOn]=useState(true);const [macroSub,setMacroSub]=useState("log");const [mLoading,setMLoading]=useState(true);const [histDays,setHistDays]=useState([]);const [adding,setAdding]=useState(false);const [newMeal,setNewMeal]=useState({name:"",protein:"",fat:"",carbs:"",tag:"Lunch"});
  const [favs,setFavs]=useState([]);const [showFavs,setShowFavs]=useState(false);
  const [editId,setEditId]=useState(null);const [editMeal,setEditMeal]=useState({name:"",protein:"",fat:"",carbs:"",tag:""});
  const day=todayKey();

  // Load from Supabase
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

  // Load history from Supabase
  useEffect(()=>{if(macroSub!=="history"||tab!=="macros")return;(async()=>{
    const rows=await db.list("daily_macros",14);
    const res=rows.map(md=>{let t={cal:0,protein:0,fat:0,carbs:0};(md.meals||[]).forEach(m=>{t.protein+=m.protein||0;t.fat+=m.fat||0;t.carbs+=m.carbs||0;});t.cal=calcCal(t.protein,t.fat,t.carbs);if(md.whey!==false){t.protein+=WHEY.protein;t.fat+=WHEY.fat;t.carbs+=WHEY.carbs;t.cal+=calcCal(WHEY.protein,WHEY.fat,WHEY.carbs);}return{date:md.date,...t};});
    setHistDays(res);
  })();},[macroSub,tab]);
  const totals=useMemo(()=>{let t={protein:0,fat:0,carbs:0};meals.forEach(m=>{t.protein+=m.protein||0;t.fat+=m.fat||0;t.carbs+=m.carbs||0;});if(wheyOn){t.protein+=WHEY.protein;t.fat+=WHEY.fat;t.carbs+=WHEY.carbs;}t.cal=calcCal(t.protein,t.fat,t.carbs);return t;},[meals,wheyOn]);
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

  // Load pep history from Supabase
  useEffect(()=>{if(tab!=="peptides")return;(async()=>{
    const rows=await db.list("daily_peptides",21);
    setPepHist(rows.map(r=>({date:r.date,checks:r.checks||{},sideEffects:r.side_effects||[]})));
  })();},[tab]);

  const todayDow=new Date().getDay();
  const userPeps=PEPTIDES.filter(p=>!p.users||p.users.includes(userId));
  const duePeptides=userPeps.filter(p=>(p.status==="active"||p.status==="prn")&&p.schedule.includes(todayDow));
  const notDue=userPeps.filter(p=>!duePeptides.includes(p));
  const checkedCount=duePeptides.filter(p=>pepData.checks[p.id]).length;

  // Streak calculation
  const streak=useMemo(()=>{let s=0;const sorted=[...pepHist].sort((a,b)=>b.date.localeCompare(a.date));for(const d of sorted){const chks=d.checks||{};const ids=typeof Object.values(chks)[0]==="string"?Object.keys(chks):Object.keys(chks);if(ids.length>0)s++;else break;}return s;},[pepHist]);

  // Delta from last scan vs previous
  const prev=data.length>=2?data[data.length-2]:null;
  const deltaFat=prev?+(last.fatPct-prev.fatPct).toFixed(1):null;
  const deltaMuscle=prev?+(last.muscle-prev.muscle).toFixed(1):null;
  const deltaWeight=prev?+(last.weight-prev.weight).toFixed(1):null;

  // Whoop state
  const [whoopData,setWhoopData]=useState(null);const [whoopLoading,setWhoopLoading]=useState(true);const [whoopHist,setWhoopHist]=useState([]);
  const [showPlan,setShowPlan]=useState(false);
  useEffect(()=>{setWhoopData(null);setWhoopLoading(true);(async()=>{const row=await db.get("daily_whoop",day);if(row)setWhoopData({recovery:row.recovery,sleep:row.sleep,strain:row.strain});const hist=await db.list("daily_whoop",14);setWhoopHist(hist.map(r=>({date:r.date,recovery:r.recovery,sleep:r.sleep,strain:r.strain})));setWhoopLoading(false);})();},[day,db]);
  const saveWhoop=async(d)=>{setWhoopData(d);db.upsert("daily_whoop",{date:day,...d});};
  const [whoopInput,setWhoopInput]=useState({recovery:"",sleep:"",strain:""});

  const navItems=[{id:"macros",icon:"🍽️",label:"Macros"},profile.showPeptides&&{id:"peptides",icon:"🧬",label:"Peps"},{id:"overview",icon:"📊",label:"Body"},{id:"whoop",icon:"💚",label:"Whoop"},{id:"more",icon:"⋯",label:"More"}].filter(Boolean);
  const [showMore,setShowMore]=useState(false);

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0f0f1a 0%,#1a1025 50%,#0f0f1a 100%)",fontFamily:"Outfit",padding:"16px 16px 90px",maxWidth:480,margin:"0 auto"}}>
      <style>{STYLE}</style>
      <div style={{filter:dark?"none":"invert(0.93) hue-rotate(180deg)",color:"#e0e0e0"}}>
      {/* Header */}
      <div className="fade-in" style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,margin:0,color:"#fff",letterSpacing:"-0.5px"}}>Body Comp HQ</h1>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.3)",margin:"2px 0 0"}}>{profile.name}{data.length>0?` · ${pctDone}% to goal`:""}</p>
        </div>
        <div style={{display:"flex",gap:6}}>
          {!locked&&Object.entries(PROFILES).map(([id,p])=>(<button key={id} onClick={()=>setUserId(id)} style={{width:32,height:32,borderRadius:10,border:userId===id?"2px solid #a78bfa":"1px solid rgba(255,255,255,0.06)",background:userId===id?"rgba(167,139,250,0.12)":"transparent",fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{p.emoji}</button>))}
          <button onClick={toggleTheme} style={{width:32,height:32,borderRadius:10,border:"1px solid rgba(255,255,255,0.06)",background:"transparent",color:"#fff",fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{dark?"☀️":"🌙"}</button>
        </div>
      </div>
      {/* Goal bar */}
      {data.length>0&&<div className="fade-in" style={{background:"rgba(255,255,255,0.03)",borderRadius:14,padding:"12px 14px",marginBottom:20,border:"1px solid rgba(255,255,255,0.04)"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.5)"}}>Goal: {goalPct}% body fat</span><span style={{fontSize:12,fontWeight:800,color:"#a78bfa"}}>{pctDone}%</span></div>
        <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}><div className="fade-in" style={{height:"100%",width:`${pctDone}%`,background:"linear-gradient(90deg,#a78bfa,#4ade80)",borderRadius:3,transition:"width 0.8s ease"}}/></div>
      </div>}

      {/* More menu overlay */}
      {showMore&&(<div style={{position:"fixed",bottom:72,left:0,right:0,zIndex:100,padding:"0 16px",maxWidth:480,margin:"0 auto"}}>
        <div className="slide-up" style={{background:"rgba(20,15,30,0.95)",backdropFilter:"blur(20px)",borderRadius:16,border:"1px solid rgba(255,255,255,0.08)",padding:8,display:"flex",flexDirection:"column",gap:2}}>
          {[["data","📋","Data"],["projection","🎯","Projection"],["monthly","📅","Monthly"]].map(([id,icon,label])=>(
            <button key={id} onClick={()=>{setTab(id);setShowMore(false);}} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:12,border:"none",background:tab===id?"rgba(167,139,250,0.1)":"transparent",cursor:"pointer",width:"100%",textAlign:"left"}}>
              <span style={{fontSize:18}}>{icon}</span><span style={{fontSize:14,color:tab===id?"#a78bfa":"rgba(255,255,255,0.5)",fontWeight:tab===id?700:400,fontFamily:"Outfit"}}>{label}</span>
            </button>
          ))}
        </div>
      </div>)}

      {/* ═══ OVERVIEW ═══ */}
      {tab==="overview"&&(<>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:8}}>
          <Card title="Body Fat" value={last.fatPct} unit="%" sub={`Best: ${best.fatPct}%${deltaFat!==null?` · ${deltaFat>0?"▲":"▼"}${Math.abs(deltaFat)}% last`:""}`} color="#f472b6" icon="🔥"/>
          <Card title="Muscle" value={last.muscle} unit="kg" sub={`Peak: 19.0${deltaMuscle!==null?` · ${deltaMuscle>0?"▲":"▼"}${Math.abs(deltaMuscle)}kg`:""}`} color="#34d399" icon="💪"/>
          <Card title="Weight" value={last.weight} unit="kg" sub={`${deltaWeight!==null?`${deltaWeight>0?"▲":"▼"}${Math.abs(deltaWeight)}kg from last`:"Lightest"}`} color="#a78bfa" icon="⚖️"/>
          <Card title="Fat to Lose" value={fatToLose} unit="kg" sub="to 30%" color="#fbbf24" icon="🎯"/>
        </div>
        <H2 sub="30% goal line">Body Fat %</H2>
        <div style={cBox}><ResponsiveContainer width="100%" height={230}><AreaChart data={data} margin={{top:10,right:12,left:-14,bottom:0}}><defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f472b6" stopOpacity={0.3}/><stop offset="100%" stopColor="#f472b6" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/><XAxis dataKey="labelYr" tick={{fill:"rgba(255,255,255,0.3)",fontSize:9}} axisLine={false} tickLine={false} interval={1}/><YAxis domain={[28,48]} tick={{fill:"rgba(255,255,255,0.3)",fontSize:10}} axisLine={false} tickLine={false}/><Tooltip content={<Tip/>}/><ReferenceLine y={30} stroke="rgba(74,222,128,0.4)" strokeDasharray="6 3" strokeWidth={2}/><Area type="monotone" dataKey="fatPct" stroke="#f472b6" strokeWidth={2.5} fill="url(#fg)" name="Body Fat %" dot={{r:4,fill:"#f472b6",stroke:"#0a0a14",strokeWidth:2}}/></AreaChart></ResponsiveContainer></div>
        <H2>Weight & Muscle</H2>
        <div style={cBox}><ResponsiveContainer width="100%" height={190}><LineChart data={data} margin={{top:10,right:12,left:-14,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/><XAxis dataKey="labelYr" tick={{fill:"rgba(255,255,255,0.3)",fontSize:9}} axisLine={false} tickLine={false} interval={1}/><YAxis yAxisId="w" domain={[53,59]} tick={{fill:"rgba(255,255,255,0.3)",fontSize:10}} axisLine={false} tickLine={false}/><YAxis yAxisId="m" orientation="right" domain={[15,20]} tick={{fill:"rgba(255,255,255,0.3)",fontSize:10}} axisLine={false} tickLine={false}/><Tooltip content={<Tip/>}/><Legend iconType="circle" wrapperStyle={{fontSize:10}}/><Line yAxisId="w" type="monotone" dataKey="weight" stroke="#a78bfa" strokeWidth={2} name="Weight" dot={{r:3}}/><Line yAxisId="m" type="monotone" dataKey="muscle" stroke="#34d399" strokeWidth={2} name="Muscle" dot={{r:3}}/></LineChart></ResponsiveContainer></div>

        {/* Collapsible Plan */}
        <div style={{marginTop:24}}>
          <button onClick={()=>setShowPlan(!showPlan)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,0.06)",background:"rgba(255,255,255,0.02)",cursor:"pointer",color:"rgba(255,255,255,0.4)",fontSize:12,fontWeight:600}}>
            <span>📋 Plan & Recommendations</span><span>{showPlan?"▲":"▼"}</span>
          </button>
          {showPlan&&(<div style={{marginTop:8}}>
            <Insight icon="🍽️" title="Nutrition" color="#fb923c" text={`${TARGETS.cal} cal target. Protein target: ${TARGETS.protein}g/day.`}/>
            <Insight icon="🏋️" title="Protect Muscle" color="#34d399" text="Resistance training 3-4x/week. If muscle drops on your scan, increase food by 100 cal."/>
            {profile.showPeptides&&<Insight icon="🧬" title="Peptide Stack" color="#c084fc" text="Reta (appetite), 5-Amino (fat metabolism), MOTS-c (mitochondria), CJC+Ipa (GH/recovery) — all synergize with your deficit."/>}
            <Insight icon="📊" title="Scan Saturdays" color="#a78bfa" text="Weekly scans at BGC. Add results in the Data tab."/>
          </div>)}
        </div>
      </>)}

      {/* ═══ MACROS ═══ */}
      {tab==="macros"&&!mLoading&&(<>
        <div style={{display:"flex",gap:4,marginBottom:14}}>{[["log","Today"],["history","History"]].map(([k,l])=>(<TabBtn key={k} active={macroSub===k} onClick={()=>setMacroSub(k)}>{l}</TabBtn>))}</div>
        {macroSub==="log"&&(<>
          {/* PROTEIN HERO */}
          <div style={{background:"rgba(244,114,182,0.06)",border:"1px solid rgba(244,114,182,0.15)",borderRadius:16,padding:"16px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:700,color:COL.protein}}>💪 PROTEIN</span>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{weekAvgProtein?`7d avg: ${weekAvgProtein}g`:""}</span>
            </div>
            <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:6}}>
              <span style={{fontSize:36,fontWeight:800,color:totals.protein>=TARGETS.protein?"#4ade80":COL.protein}}>{Math.round(totals.protein)}</span>
              <span style={{fontSize:16,color:"rgba(255,255,255,0.3)"}}>/ {TARGETS.protein}g</span>
            </div>
            <div style={{height:8,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden",marginBottom:6}}>
              <div style={{height:"100%",width:`${Math.min(100,totals.protein/TARGETS.protein*100)}%`,background:totals.protein>=TARGETS.protein?"#4ade80":COL.protein,borderRadius:4,transition:"width 0.3s"}}/>
            </div>
            <div style={{fontSize:11,color:rem.protein>0?"rgba(255,255,255,0.35)":"#4ade80",fontWeight:600}}>{rem.protein>0?`${Math.round(rem.protein)}g to go`:"✓ Target hit!"}</div>
          </div>

          {/* TDEE / Deficit card */}
          {userConfig?.weight&&userConfig?.height&&userConfig?.age&&(<div className="fade-in" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:14,padding:"12px 14px",marginBottom:12}}>
            {(()=>{
              const w=userConfig.weight,h=userConfig.height,a=userConfig.age;
              const bmr=userConfig.gender==="male"?10*w+6.25*h-5*a+5:10*w+6.25*h-5*a-161;
              const mult={sedentary:1.2,light:1.375,moderate:1.55,active:1.725}[userConfig.activity]||1.375;
              const tdee=Math.round(bmr*mult);
              const deficit=tdee-TARGETS.cal;
              const defPct=Math.round(deficit/tdee*100);
              return(<div style={{display:"flex",justifyContent:"space-around",textAlign:"center"}}>
                <div><div style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>BMR</div><div style={{fontSize:18,fontWeight:800,color:"#60a5fa"}}>{Math.round(bmr)}</div></div>
                <div><div style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>TDEE</div><div style={{fontSize:18,fontWeight:800,color:"#a78bfa"}}>{tdee}</div></div>
                <div><div style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>Target</div><div style={{fontSize:18,fontWeight:800,color:"#fff"}}>{TARGETS.cal}</div></div>
                <div><div style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>Deficit</div><div style={{fontSize:18,fontWeight:800,color:deficit>0?"#4ade80":"#f87171"}}>{deficit>0?`-${deficit}`:"+"+Math.abs(deficit)}</div><div style={{fontSize:9,color:"rgba(255,255,255,0.15)"}}>{defPct}%</div></div>
              </div>);
            })()}
          </div>)}

          {/* Secondary macros row */}
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {[{k:"cal",l:"Calories",v:totals.cal,t:TARGETS.cal,u:""},{k:"fat",l:"Fat",v:Math.round(totals.fat),t:TARGETS.fat,u:"g"},{k:"carbs",l:"Carbs",v:Math.round(totals.carbs),t:TARGETS.carbs,u:"g"}].map(m=>(
              <div key={m.k} style={{flex:1,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:12,padding:"10px",textAlign:"center"}}>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.25)"}}>{m.l}</div>
                <div style={{fontSize:16,fontWeight:700,color:COL[m.k],marginTop:2}}>{m.v}<span style={{fontSize:10,opacity:0.5}}>{m.u}</span></div>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.15)",marginTop:1}}>/ {m.t}{m.u}</div>
              </div>
            ))}
          </div>

          {/* Whey toggle */}
          <div onClick={toggleWhey} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:wheyOn?"rgba(167,139,250,0.08)":"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"10px 14px",marginBottom:16,cursor:"pointer"}}><div><div style={{fontSize:13,fontWeight:600,color:"#fff"}}>Whey Isolate x2 scoops</div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1}}>{calcCal(WHEY.protein,WHEY.fat,WHEY.carbs)} cal · {WHEY.protein}g P</div></div><div style={{width:40,height:22,borderRadius:11,background:wheyOn?"#a78bfa":"rgba(255,255,255,0.1)",display:"flex",alignItems:"center",padding:"0 2px"}}><div style={{width:18,height:18,borderRadius:9,background:"#fff",transform:wheyOn?"translateX(18px)":"translateX(0)",transition:"transform 0.2s"}}/></div></div>

          {/* Meals list */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <h3 style={{fontSize:14,fontWeight:700,margin:0,color:"#fff"}}>Meals</h3>
            <span style={{fontSize:10,color:"rgba(255,255,255,0.2)"}}>{meals.length} logged</span>
          </div>
          {meals.length===0&&!adding&&!showFavs&&<div style={{textAlign:"center",padding:"20px 0",color:"rgba(255,255,255,0.12)",fontSize:12}}>No meals yet</div>}

          {meals.map((m,i)=>editId===m.id?(
            /* Edit mode */
            <div key={m.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:12,marginBottom:8}}>
              <input value={editMeal.name} onChange={e=>setEditMeal({...editMeal,name:e.target.value})} style={{...inp,marginBottom:6}}/>
              <div style={{display:"flex",gap:4,marginBottom:6}}>{MEAL_TAGS.map(t=>(<button key={t} onClick={()=>setEditMeal({...editMeal,tag:t})} style={{padding:"3px 8px",borderRadius:8,border:"none",fontSize:10,cursor:"pointer",background:editMeal.tag===t?"rgba(167,139,250,0.2)":"transparent",color:editMeal.tag===t?"#a78bfa":"rgba(255,255,255,0.2)"}}>{t}</button>))}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
                {[{k:"protein",l:"P",c:COL.protein},{k:"fat",l:"F",c:COL.fat},{k:"carbs",l:"C",c:COL.carbs}].map(f=>(<div key={f.k}><div style={{fontSize:8,color:f.c,fontWeight:700}}>{f.l}</div><input type="number" value={editMeal[f.k]} onChange={e=>setEditMeal({...editMeal,[f.k]:e.target.value})} style={{...inp,textAlign:"center",fontSize:14,padding:"6px 4px"}}/></div>))}
              </div>
              <div style={{display:"flex",gap:6}}><button onClick={saveEdit} style={{flex:1,padding:"8px",borderRadius:8,border:"none",background:"#a78bfa",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Save</button><button onClick={()=>setEditId(null)} style={{padding:"8px 12px",borderRadius:8,border:"none",background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.3)",fontSize:12,cursor:"pointer"}}>Cancel</button></div>
            </div>
          ):(
            /* Display mode */
            <div key={m.id} style={{display:"flex",alignItems:"center",padding:"10px 0",borderBottom:i<meals.length-1?"1px solid rgba(255,255,255,0.04)":"none",gap:8}}>
              <div style={{flex:1}} onClick={()=>startEdit(m)}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {m.tag&&<span style={{fontSize:9,color:"rgba(255,255,255,0.25)",background:"rgba(255,255,255,0.04)",padding:"1px 6px",borderRadius:6}}>{m.tag}</span>}
                  <span style={{fontSize:13,color:"rgba(255,255,255,0.75)",fontWeight:600}}>{m.name}</span>
                </div>
                <div style={{display:"flex",gap:8,marginTop:3,fontSize:11}}>
                  <span style={{color:COL.cal}}>{calcCal(m.protein,m.fat,m.carbs)}</span>
                  <span style={{color:COL.protein,fontWeight:700}}>{m.protein}g P</span>
                  <span style={{color:COL.fat}}>{m.fat}g F</span>
                  <span style={{color:COL.carbs}}>{m.carbs}g C</span>
                </div>
              </div>
              {!favs.find(f=>f.name===m.name)&&<button onClick={()=>addFav(m)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.1)",fontSize:14,cursor:"pointer",padding:"4px"}}>⭐</button>}
              <button onClick={()=>removeMeal(m.id)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.1)",fontSize:14,cursor:"pointer",padding:"4px"}}>✕</button>
            </div>
          ))}

          {/* Action buttons */}
          {!adding&&!showFavs&&(<div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={()=>setAdding(true)} style={{flex:1,padding:"13px",borderRadius:14,border:"1px dashed rgba(167,139,250,0.3)",background:"rgba(167,139,250,0.05)",color:"#a78bfa",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Add Meal</button>
            {favs.length>0&&<button onClick={()=>setShowFavs(true)} style={{padding:"13px 16px",borderRadius:14,border:"1px solid rgba(252,211,77,0.2)",background:"rgba(252,211,77,0.05)",color:"#fcd34d",fontSize:13,fontWeight:700,cursor:"pointer"}}>⭐ {favs.length}</button>}
          </div>)}

          {/* Favorites panel */}
          {showFavs&&(<div style={{marginTop:12,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(252,211,77,0.15)",borderRadius:16,padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{fontSize:13,fontWeight:700,color:"#fcd34d"}}>⭐ Favorites</span><button onClick={()=>setShowFavs(false)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer"}}>✕</button></div>
            {favs.map((f,i)=>(<div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:i<favs.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
              <div onClick={()=>addFromFav(f)} style={{flex:1,cursor:"pointer"}}>
                <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.7)"}}>{f.name}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:1}}>{calcCal(f.protein,f.fat,f.carbs)} cal · <span style={{color:COL.protein}}>{f.protein}g P</span> · {f.fat}g F · {f.carbs}g C</div>
              </div>
              <button onClick={()=>removeFav(f.name)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.1)",fontSize:12,cursor:"pointer"}}>✕</button>
            </div>))}
            {favs.length===0&&<div style={{textAlign:"center",padding:"12px 0",color:"rgba(255,255,255,0.12)",fontSize:11}}>Star a meal to save it here</div>}
          </div>)}

          {/* Add meal form */}
          {adding&&(<div style={{marginTop:12,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{fontSize:14,fontWeight:700,color:"#fff"}}>Add Meal</span><button onClick={()=>{setAdding(false);setNewMeal({name:"",protein:"",fat:"",carbs:"",tag:"Lunch"});}} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer"}}>✕</button></div>
            {/* Meal tag selector */}
            <div style={{display:"flex",gap:4,marginBottom:10}}>{MEAL_TAGS.map(t=>(<button key={t} onClick={()=>setNewMeal({...newMeal,tag:t})} style={{padding:"5px 12px",borderRadius:10,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",background:newMeal.tag===t?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.04)",color:newMeal.tag===t?"#a78bfa":"rgba(255,255,255,0.25)"}}>{t}</button>))}</div>
            <div style={{marginBottom:10}}><div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginBottom:3,fontWeight:600}}>MEAL NAME</div><input value={newMeal.name} onChange={e=>setNewMeal({...newMeal,name:e.target.value})} placeholder="e.g. Beef Taco Wrap" style={inp}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>{[{k:"protein",l:"PROTEIN (g)",c:COL.protein},{k:"fat",l:"FATS (g)",c:COL.fat},{k:"carbs",l:"CARBS (g)",c:COL.carbs}].map(f=>(<div key={f.k}><div style={{fontSize:9,color:f.c,marginBottom:3,fontWeight:700}}>{f.l}</div><input type="number" value={newMeal[f.k]} onChange={e=>setNewMeal({...newMeal,[f.k]:e.target.value})} placeholder="0" style={{...inp,textAlign:"center",fontSize:16,padding:"10px 6px",fontWeight:700}}/></div>))}</div>
            {(newMeal.protein||newMeal.fat||newMeal.carbs)&&(<div style={{textAlign:"center",padding:"8px",background:"rgba(167,139,250,0.06)",borderRadius:10,marginBottom:12}}><span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>= </span><span style={{fontSize:18,fontWeight:800,color:COL.cal}}>{calcCal(+newMeal.protein,+newMeal.fat,+newMeal.carbs)}</span><span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}> cal</span></div>)}
            <button onClick={addMeal} disabled={!newMeal.name} style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:newMeal.name?"linear-gradient(135deg,#a78bfa,#6d28d9)":"rgba(255,255,255,0.06)",color:newMeal.name?"#fff":"rgba(255,255,255,0.2)",fontSize:14,fontWeight:700,cursor:newMeal.name?"pointer":"default"}}>Add Meal</button>
          </div>)}
        </>)}
        {macroSub==="history"&&(<>
          {weekAvgProtein&&<div style={{background:"rgba(244,114,182,0.06)",border:"1px solid rgba(244,114,182,0.1)",borderRadius:12,padding:"10px 14px",marginBottom:12,textAlign:"center"}}><span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>7-day protein avg: </span><span style={{fontSize:18,fontWeight:800,color:weekAvgProtein>=TARGETS.protein?"#4ade80":COL.protein}}>{weekAvgProtein}g</span><span style={{fontSize:11,color:"rgba(255,255,255,0.2)"}}> / {TARGETS.protein}g target</span></div>}
          {histDays.length===0?<div style={{textAlign:"center",padding:"36px 0",color:"rgba(255,255,255,0.15)",fontSize:12}}>No history</div>:histDays.map((d,i)=>{const lb=new Date(d.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});const ph=d.protein>=TARGETS.protein;return(<div key={i} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:12,padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:12,fontWeight:700,color:"#fff"}}>{lb}</span>{ph&&<span style={{fontSize:9,background:"rgba(74,222,128,0.1)",color:"#4ade80",padding:"2px 8px",borderRadius:8,fontWeight:600}}>Protein ✓</span>}</div>
            <div style={{display:"flex",gap:14,fontSize:11}}><span style={{color:COL.cal}}>{d.cal} cal</span><span style={{color:COL.protein,fontWeight:ph?700:400}}>{Math.round(d.protein)}g P</span><span style={{color:COL.fat}}>{Math.round(d.fat)}g F</span><span style={{color:COL.carbs}}>{Math.round(d.carbs)}g C</span></div>
            {/* Protein mini bar */}
            <div style={{height:3,background:"rgba(255,255,255,0.04)",borderRadius:2,marginTop:6,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,d.protein/TARGETS.protein*100)}%`,background:ph?"#4ade80":COL.protein,borderRadius:2}}/></div>
          </div>);})}</>)}
      </>)}

      {/* ═══ PEPTIDES ═══ */}
      {tab==="peptides"&&!pepLoading&&(<>
        <div style={{display:"flex",gap:4,marginBottom:14}}>{[["today","Today"],["all","Full Stack"],["history","History"]].map(([k,l])=>(<TabBtn key={k} active={pepSub===k} onClick={()=>setPepSub(k)}>{l}</TabBtn>))}</div>

        {pepSub==="today"&&(<>
          {/* Supply alerts — TOP */}
          {userPeps.filter(p=>p.daysSupply<=7&&p.status==="active").length>0&&(
            <div style={{marginBottom:14}}>
              {userPeps.filter(p=>p.daysSupply<=7&&p.status==="active").map(p=>(<div key={p.id} style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.15)",borderRadius:10,padding:"9px 12px",marginBottom:4}}>
                <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>⚠️ {p.name}</span><span style={{fontSize:11,fontWeight:700,color:"#f87171"}}>{p.daysSupply}d supply</span></div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1}}>{p.supplyNote}</div>
              </div>))}
            </div>
          )}

          {/* Streak + progress header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>🧬 {new Date().toLocaleDateString("en-US",{weekday:"long"})}</span>
              {streak>0&&<span style={{fontSize:11,fontWeight:700,color:"#fb923c",background:"rgba(251,146,60,0.1)",padding:"2px 8px",borderRadius:8}}>🔥 {streak}d streak</span>}
            </div>
            <div style={{fontSize:12,fontWeight:700,color:checkedCount===duePeptides.length&&duePeptides.length>0?"#4ade80":"rgba(255,255,255,0.3)"}}>{checkedCount}/{duePeptides.length}</div>
          </div>
          {duePeptides.length>0&&<div style={{height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,marginBottom:14,overflow:"hidden"}}><div style={{height:"100%",width:`${checkedCount/duePeptides.length*100}%`,background:"linear-gradient(90deg,#a78bfa,#4ade80)",borderRadius:2,transition:"width 0.3s"}}/></div>}

          {/* Checklist */}
          {duePeptides.map(p=>{const check=pepData.checks[p.id];const checked=!!check;const time=check?.time||"";const dose=check?.dose||"";const isEditing=editingDose===p.id;return(
            <div key={p.id} style={{background:checked?"rgba(74,222,128,0.05)":"rgba(255,255,255,0.02)",border:`1px solid ${checked?"rgba(74,222,128,0.12)":"rgba(255,255,255,0.06)"}`,borderRadius:14,padding:"11px 13px",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div onClick={()=>togglePep(p.id,p.dose)} style={{width:24,height:24,borderRadius:7,border:`2px solid ${checked?"#4ade80":p.color}`,background:checked?"#4ade80":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#0a0a14",flexShrink:0,cursor:"pointer"}}>{checked?"✓":""}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:13,fontWeight:700,color:checked?"rgba(255,255,255,0.4)":"#fff",textDecoration:checked?"line-through":"none"}}>{p.name}</span>
                    <span style={{fontSize:9,color:p.color,background:`${p.color}15`,padding:"2px 7px",borderRadius:8}}>{p.time}</span>
                  </div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:1}}>
                    {checked?(<span>✓ {time}{dose?` · ${dose}`:` · ${p.dose}`}</span>):p.dose}
                  </div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.15)",marginTop:3,lineHeight:1.4,fontStyle:"italic"}}>{p.purpose}</div>
                </div>
              </div>
              {/* Dose edit row — shown when checked */}
              {checked&&(<div style={{marginTop:6,marginLeft:34}}>
                {!isEditing?(<button onClick={()=>{setEditingDose(p.id);setDoseVal(dose||p.dose);}} style={{fontSize:10,color:"rgba(255,255,255,0.2)",background:"none",border:"none",cursor:"pointer",padding:0}}>edit dose</button>):(
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <input value={doseVal} onChange={e=>setDoseVal(e.target.value)} style={{...inp,fontSize:11,padding:"4px 8px",width:140}} placeholder="e.g. 40u (10.7mg)"/>
                    <button onClick={()=>{updateDose(p.id,doseVal);setEditingDose(null);}} style={{fontSize:10,color:"#4ade80",background:"none",border:"none",cursor:"pointer",fontWeight:700}}>Save</button>
                    <button onClick={()=>setEditingDose(null)} style={{fontSize:10,color:"rgba(255,255,255,0.2)",background:"none",border:"none",cursor:"pointer"}}>✕</button>
                  </div>
                )}
              </div>)}
            </div>
          );})}

          {duePeptides.length===0&&<div style={{textAlign:"center",padding:"24px 0",color:"rgba(255,255,255,0.15)",fontSize:12}}>No peptides scheduled today</div>}

          {/* 7-day peptide adherence matrix */}
          <div style={{marginTop:20,marginBottom:6}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginBottom:10}}>LAST 7 DAYS</div>
            {(()=>{
              const H={"2026-04-20":["glow","nad","motsc"],"2026-04-21":["reta"],"2026-04-22":["glow","nad","motsc","semax"],"2026-04-23":["semax"],"2026-04-24":["glow"],"2026-04-25":["motsc"],"2026-04-27":["glow","nad"],"2026-04-28":["reta","motsc"],"2026-04-29":["glow","nad"],"2026-05-01":["klow","motsc"],"2026-05-03":["klow"],"2026-05-04":["klow","nad","semax"],"2026-05-05":["klow","reta","motsc","semax"],"2026-05-06":["klow","nad","semax"],"2026-05-07":["klow","semax"],"2026-05-08":["klow","motsc","semax"],"2026-05-10":["klow"],"2026-05-11":["klow","nad"],"2026-05-12":["klow","reta","motsc"],"2026-05-13":["klow","nad"],"2026-05-14":["klow"],"2026-05-15":["klow","motsc"]};
              const today=new Date();
              // Build last 7 days
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
              // Active peptides only
              const activePeps=userPeps.filter(p=>p.status==="active");
              return(<div style={{overflowX:"auto"}}>
                <div style={{display:"grid",gridTemplateColumns:`80px repeat(7,1fr)`,gap:0,minWidth:340}}>
                  {/* Header row */}
                  <div style={{padding:"4px 0"}}/>
                  {days.map(d=>(<div key={d.key} style={{textAlign:"center",padding:"4px 2px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <div style={{fontSize:9,color:d.isToday?"#a78bfa":"rgba(255,255,255,0.15)"}}>{d.dayName}</div>
                    <div style={{fontSize:11,fontWeight:d.isToday?700:400,color:d.isToday?"#a78bfa":"rgba(255,255,255,0.2)"}}>{d.dateNum}</div>
                  </div>))}
                  {/* Peptide rows */}
                  {activePeps.map(p=>(<div key={p.id} style={{display:"contents"}}>
                    <div style={{display:"flex",alignItems:"center",gap:4,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                      <div style={{width:6,height:6,borderRadius:3,background:p.color,flexShrink:0}}/>
                      <span style={{fontSize:10,color:"rgba(255,255,255,0.4)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name.length>10?p.name.slice(0,9)+"…":p.name}</span>
                    </div>
                    {days.map(d=>{
                      const scheduled=p.schedule.includes(d.dow)&&(!p.startDate||d.key>=p.startDate);
                      const liveHist=pepHist.find(h=>h.date===d.key);
                      const liveTaken=liveHist?!!(liveHist.checks||{})[p.id]:false;
                      const histTaken=(H[d.key]||[]).includes(p.id);
                      const taken=liveTaken||histTaken;
                      const isFuture=new Date(d.key+"T23:59:59")>today&&d.key!==day;
                      let icon="";let bg="transparent";let color="rgba(255,255,255,0.04)";
                      if(isFuture){icon="";bg="transparent";color="rgba(255,255,255,0.04)";}
                      else if(!scheduled){icon="—";color="rgba(255,255,255,0.06)";}
                      else if(taken){icon="✓";bg="rgba(74,222,128,0.12)";color="#4ade80";}
                      else{icon="✗";bg="rgba(248,113,113,0.08)";color="rgba(248,113,113,0.5)";}
                      return(<div key={d.key} style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"6px 0",background:bg,borderBottom:"1px solid rgba(255,255,255,0.03)",fontSize:12,fontWeight:taken?700:400,color}}>{icon}</div>);
                    })}
                  </div>))}
                </div>
                {/* Legend */}
                <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:8}}>
                  {[{s:"✓",l:"taken",c:"#4ade80"},{s:"✗",l:"missed",c:"#f87171"},{s:"—",l:"not due",c:"rgba(255,255,255,0.15)"}].map((x,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:3}}><span style={{fontSize:11,color:x.c,fontWeight:700}}>{x.s}</span><span style={{fontSize:9,color:"rgba(255,255,255,0.2)"}}>{x.l}</span></div>))}
                </div>
              </div>);
            })()}
          </div>

          {/* Side effects — quick tags */}
          <div style={{marginTop:18,marginBottom:6}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginBottom:8}}>SIDE EFFECTS TODAY</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {SIDE_FX.map(fx=>{const active=pepData.sideEffects.includes(fx);return(
                <button key={fx} onClick={()=>toggleSideFx(fx)} style={{padding:"5px 10px",borderRadius:16,border:`1px solid ${active?"rgba(248,113,113,0.3)":"rgba(255,255,255,0.06)"}`,background:active?"rgba(248,113,113,0.12)":"transparent",color:active?"#f87171":"rgba(255,255,255,0.25)",fontSize:11,cursor:"pointer",fontWeight:active?600:400}}>{fx}</button>
              );})}
            </div>
            {pepData.sideEffects.length>0&&<div style={{fontSize:10,color:"rgba(248,113,113,0.5)",marginTop:6}}>Logged: {pepData.sideEffects.join(", ")}</div>}
          </div>

          {/* Collapsed other peptides */}
          {(notDue.length>0)&&(<div style={{marginTop:16}}>
            <button onClick={()=>setShowOther(!showOther)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.2)",fontSize:11,cursor:"pointer",padding:0}}>
              {notDue.filter(p=>p.status!=="break"&&p.status!=="starting").length} not due · {notDue.filter(p=>p.status==="break").length} on break · {notDue.filter(p=>p.status==="starting").length} upcoming {showOther?"▲":"▼"}
            </button>
            {showOther&&(<div style={{marginTop:8}}>
              {notDue.map(p=>(<div key={p.id} style={{padding:"5px 0",fontSize:11,color:"rgba(255,255,255,0.15)",borderBottom:"1px solid rgba(255,255,255,0.02)"}}>
                {p.status==="break"?"⏸️":p.status==="starting"?"📅":""} {p.name} — <span style={{color:"rgba(255,255,255,0.1)"}}>{p.note}</span>
              </div>))}
            </div>)}
          </div>)}
        </>)}

        {pepSub==="all"&&(<>
          <H2>Active Stack</H2>
          {userPeps.filter(p=>p.status==="active"||p.status==="prn").map(p=>{
            const cyclePct=p.totalWeeks>0?Math.min(100,(p.week/p.totalWeeks)*100):0;
            const supplyColor=p.daysSupply<=4?"#f87171":p.daysSupply<=14?"#fbbf24":"#4ade80";
            const daysToEnd=p.cycleEnd?Math.max(0,Math.round((new Date(p.cycleEnd)-new Date())/(1000*60*60*24))):null;
            return(<div key={p.id} style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${p.color}22`,borderRadius:14,padding:"14px 15px",marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:14,fontWeight:700,color:p.color}}>{p.name}</span>
                <div style={{display:"flex",gap:4}}>
                  {p.totalWeeks>0&&<span style={{fontSize:10,color:"rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.04)",padding:"2px 8px",borderRadius:8}}>Wk {p.week}/{p.totalWeeks}</span>}
                  {p.status==="prn"&&<span style={{fontSize:10,color:"#fcd34d",background:"rgba(252,211,77,0.1)",padding:"2px 8px",borderRadius:8}}>PRN</span>}
                </div>
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>{p.dose}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginTop:2}}>{p.time} · {p.note}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.18)",marginTop:4,lineHeight:1.5,borderLeft:`2px solid ${p.color}33`,paddingLeft:8}}>{p.purpose}</div>
              {p.totalWeeks>0&&(<div style={{marginTop:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"rgba(255,255,255,0.2)",marginBottom:3}}><span>Cycle</span><span>{daysToEnd!==null?`${daysToEnd}d left`:""}</span></div><div style={{height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${cyclePct}%`,background:p.color,borderRadius:2,opacity:0.6}}/></div></div>)}
              <div style={{marginTop:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"rgba(255,255,255,0.2)",marginBottom:3}}><span>Supply</span><span style={{color:supplyColor,fontWeight:600}}>{p.dosesLeft} doses · {p.daysSupply}d</span></div><div style={{height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,p.daysSupply/30*100)}%`,background:supplyColor,borderRadius:2,opacity:0.5}}/></div></div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.15)",marginTop:4}}>{p.supplyNote}</div>
            </div>);
          })}
          <H2>Starting Soon</H2>
          {userPeps.filter(p=>p.status==="starting").map(p=>(<div key={p.id} style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${p.color}22`,borderRadius:14,padding:"13px 15px",marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:14,fontWeight:700,color:p.color}}>{p.name}</span><span style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>{p.dosesLeft} doses ready</span></div><div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:2}}>{p.dose} · {p.note}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.15)",marginTop:4,lineHeight:1.4,fontStyle:"italic"}}>{p.purpose}</div></div>))}
          <H2>On Break</H2>
          {userPeps.filter(p=>p.status==="break").map(p=>(<div key={p.id} style={{background:"rgba(255,255,255,0.015)",borderRadius:12,padding:"10px 14px",marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,color:"rgba(255,255,255,0.3)"}}>{p.name}</span><span style={{fontSize:10,color:"rgba(255,255,255,0.2)"}}>{p.dosesLeft} doses for C2</span></div><div style={{fontSize:11,color:"rgba(255,255,255,0.15)",marginTop:2}}>{p.note}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.1)",marginTop:3,lineHeight:1.4,fontStyle:"italic"}}>{p.purpose}</div></div>))}
        </>)}

        {pepSub==="history"&&(<>
          {pepHist.length===0?<div style={{textAlign:"center",padding:"36px 0",color:"rgba(255,255,255,0.15)",fontSize:12}}>No history</div>:(<>
            {pepHist.map((d,i)=>{
              const lb=new Date(d.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
              const checks=d.checks||{};
              const ids=Object.keys(checks);
              // count how many were due that day
              const dow=new Date(d.date+"T12:00:00").getDay();
              const dueCount=userPeps.filter(p=>(p.status==="active"||p.status==="prn")&&p.schedule.includes(dow)).length;
              const adherence=dueCount>0?Math.round(ids.length/dueCount*100):0;
              const sf=d.sideEffects||[];
              return(<div key={i} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:12,padding:"12px 14px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#fff"}}>{lb}</span>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:11,fontWeight:700,color:adherence>=80?"#4ade80":adherence>=50?"#fbbf24":"#f87171"}}>{adherence}%</span>
                    <span style={{fontSize:10,color:"rgba(255,255,255,0.2)"}}>{ids.length}/{dueCount}</span>
                  </div>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {ids.map(id=>{const p=userPeps.find(x=>x.id===id);const c=checks[id];const timeStr=typeof c==="string"?c:(c?.time||"");const doseStr=typeof c==="object"&&c?.dose?` ${c.dose}`:"";return p?(<span key={id} style={{fontSize:10,color:p.color,background:`${p.color}15`,padding:"2px 8px",borderRadius:8}}>{p.name} {timeStr}{doseStr}</span>):null;})}
                </div>
                {sf.length>0&&<div style={{fontSize:10,color:"#f87171",marginTop:4}}>⚠️ {sf.join(", ")}</div>}
              </div>);
            })}
          </>)}
        </>)}
      </>)}

      {/* ═══ PROJECTION ═══ */}
      {tab==="projection"&&(<>
        <H2 sub="3 scenarios">Timeline to 30%</H2>
        <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>{etaMonths.map((s,i)=>(<div key={i} style={{flex:"1 1 90px",background:"rgba(255,255,255,0.02)",border:`1px solid ${s.color}33`,borderRadius:14,padding:"12px",textAlign:"center"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{s.name}</div><div style={{fontSize:26,fontWeight:800,color:s.color}}>{s.months}<span style={{fontSize:11,opacity:0.6}}>mo</span></div><div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:3}}>{s.rate} kg/mo</div></div>))}</div>
        <div style={cBox}><ResponsiveContainer width="100%" height={250}><LineChart data={projections} margin={{top:10,right:12,left:-14,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/><XAxis dataKey="label" tick={{fill:"rgba(255,255,255,0.3)",fontSize:10}} axisLine={false} tickLine={false}/><YAxis domain={[26,40]} tick={{fill:"rgba(255,255,255,0.3)",fontSize:10}} axisLine={false} tickLine={false}/><Tooltip content={<Tip/>}/><Legend iconType="circle" wrapperStyle={{fontSize:10}}/><ReferenceLine y={30} stroke="rgba(74,222,128,0.5)" strokeDasharray="6 3" strokeWidth={2}/>{scenarios.map(s=>(<Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} name={s.name} dot={false} strokeDasharray={s.name==="On Track"?"0":"6 3"}/>))}</LineChart></ResponsiveContainer></div>
      </>)}

      {/* ═══ MONTHLY ═══ */}
      {tab==="monthly"&&(<>
        <H2 sub="Average body fat % by month">Monthly Trend</H2>
        <div style={cBox}><ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthly} margin={{top:10,right:12,left:-14,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
            <XAxis dataKey="label" tick={{fill:"rgba(255,255,255,0.3)",fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis domain={[30,48]} tick={{fill:"rgba(255,255,255,0.3)",fontSize:10}} axisLine={false} tickLine={false}/>
            <Tooltip content={<Tip/>}/>
            <ReferenceLine y={30} stroke="rgba(74,222,128,0.4)" strokeDasharray="6 3" strokeWidth={1.5}/>
            <Bar dataKey="avgPct" name="Avg Fat %" radius={[6,6,0,0]}>
              {monthly.map((m,i)=>(<Cell key={i} fill={m.avgPct<=38?"#4ade80":m.avgPct<=40?"#a78bfa":"#f472b6"} fillOpacity={0.6}/>))}
            </Bar>
          </BarChart>
        </ResponsiveContainer></div>
        <H2 sub="Detail cards">Breakdown</H2>
        {monthly.map((m,i)=>{const prev=i>0?monthly[i-1]:null;const fd=prev?+(m.avgFat-prev.avgFat).toFixed(1):null;return(<div key={i} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:14,padding:"13px 15px",marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,fontWeight:700,color:"#fff"}}>{m.label}</span><span style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>{m.count} scan{m.count>1?"s":""}</span></div><div style={{display:"flex",gap:14,fontSize:12,flexWrap:"wrap"}}><div><div style={{color:"rgba(255,255,255,0.3)",fontSize:9}}>Fat%</div><div style={{color:"#f472b6",fontWeight:700}}>{m.avgPct}%</div></div><div><div style={{color:"rgba(255,255,255,0.3)",fontSize:9}}>Fat kg</div><div style={{color:"#fb923c",fontWeight:700}}>{m.avgFat}</div></div><div><div style={{color:"rgba(255,255,255,0.3)",fontSize:9}}>Muscle</div><div style={{color:"#34d399",fontWeight:700}}>{m.avgMuscle}</div></div>{fd!==null&&<div><div style={{color:"rgba(255,255,255,0.3)",fontSize:9}}>Δ</div><div style={{color:fd<=0?"#4ade80":"#f87171",fontWeight:700}}>{fd>0?"+":""}{fd}kg</div></div>}</div></div>);})}
      </>)}

      {/* ═══ WHOOP ═══ */}
      {tab==="whoop"&&!whoopLoading&&(<>
        <H2 sub="Log your Whoop metrics daily">Today's Whoop</H2>

        {/* Input / Display */}
        {whoopData?(<>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            {[
              {k:"recovery",l:"Recovery",v:whoopData.recovery,u:"%",color:whoopData.recovery>=67?"#4ade80":whoopData.recovery>=34?"#fbbf24":"#f87171",icon:"💚"},
              {k:"sleep",l:"Sleep",v:whoopData.sleep,u:"%",color:whoopData.sleep>=85?"#4ade80":whoopData.sleep>=70?"#fbbf24":"#f87171",icon:"😴"},
              {k:"strain",l:"Strain",v:whoopData.strain,u:"",color:whoopData.strain>=14?"#f87171":whoopData.strain>=8?"#fbbf24":"#60a5fa",icon:"🔥"},
            ].map(m=>(<div key={m.k} style={{flex:1,background:"rgba(255,255,255,0.02)",border:`1px solid ${m.color}33`,borderRadius:14,padding:"14px 8px",textAlign:"center"}}>
              <div style={{fontSize:14}}>{m.icon}</div>
              <div style={{fontSize:28,fontWeight:800,color:m.color,marginTop:4}}>{m.v}<span style={{fontSize:12,opacity:0.6}}>{m.u}</span></div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>{m.l}</div>
            </div>))}
          </div>
          <button onClick={()=>{setWhoopData(null);setWhoopInput({recovery:"",sleep:"",strain:""});}} style={{width:"100%",padding:"10px",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)",background:"transparent",color:"rgba(255,255,255,0.25)",fontSize:11,cursor:"pointer"}}>Edit today's entry</button>
        </>):(
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:16,marginBottom:16}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginBottom:12}}>Enter from your Whoop app this morning:</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
              {[
                {k:"recovery",l:"RECOVERY %",ph:"e.g. 78",c:"#4ade80"},
                {k:"sleep",l:"SLEEP SCORE %",ph:"e.g. 85",c:"#60a5fa"},
                {k:"strain",l:"STRAIN",ph:"e.g. 12.4",c:"#fb923c"},
              ].map(f=>(<div key={f.k}>
                <div style={{fontSize:9,color:f.c,marginBottom:3,fontWeight:700}}>{f.l}</div>
                <input type="number" step="0.1" value={whoopInput[f.k]} onChange={e=>setWhoopInput({...whoopInput,[f.k]:e.target.value})} placeholder={f.ph} style={{...inp,textAlign:"center",fontSize:18,padding:"12px 6px",fontWeight:700}}/>
              </div>))}
            </div>
            <button onClick={()=>{if(!whoopInput.recovery&&!whoopInput.sleep&&!whoopInput.strain)return;const d={recovery:+(whoopInput.recovery||0),sleep:+(whoopInput.sleep||0),strain:+(whoopInput.strain||0)};saveWhoop(d);}} style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#4ade80,#059669)",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>Save Whoop Data</button>
          </div>
        )}

        {/* What the numbers mean */}
        <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.04)",borderRadius:12,padding:"10px 14px",marginBottom:16}}>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.2)",marginBottom:6}}>QUICK GUIDE</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",lineHeight:1.6}}>
            <span style={{color:"#4ade80"}}>Recovery 67%+</span> = green (push hard) · <span style={{color:"#fbbf24"}}>34-66%</span> = yellow (moderate) · <span style={{color:"#f87171"}}>&lt;34%</span> = red (recover)<br/>
            <span style={{color:"#60a5fa"}}>Sleep 85%+</span> = great · <span style={{color:"#fbbf24"}}>70-84%</span> = ok · <span style={{color:"#f87171"}}>&lt;70%</span> = poor (CJC+Ipa less effective)<br/>
            <span style={{color:"#fb923c"}}>Strain 14+</span> = very high · <span style={{color:"#fbbf24"}}>8-13</span> = moderate · <span style={{color:"#60a5fa"}}>&lt;8</span> = light
          </div>
        </div>

        {/* 7-day history */}
        {whoopHist.length>0&&(<>
          <H2 sub="Last 7 days">Trend</H2>
          <div style={cBox}><ResponsiveContainer width="100%" height={180}>
            <LineChart data={whoopHist.slice(0,7).reverse()} margin={{top:10,right:12,left:-14,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="date" tickFormatter={d=>new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"narrow",day:"numeric"})} tick={{fill:"rgba(255,255,255,0.3)",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis domain={[0,100]} tick={{fill:"rgba(255,255,255,0.3)",fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<Tip/>}/>
              <Legend iconType="circle" wrapperStyle={{fontSize:10}}/>
              <Line type="monotone" dataKey="recovery" stroke="#4ade80" strokeWidth={2} name="Recovery %" dot={{r:3}}/>
              <Line type="monotone" dataKey="sleep" stroke="#60a5fa" strokeWidth={2} name="Sleep %" dot={{r:3}}/>
            </LineChart>
          </ResponsiveContainer></div>

          <H2 sub="Daily entries">History</H2>
          {whoopHist.map((d,i)=>{const lb=new Date(d.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});const rc=d.recovery>=67?"#4ade80":d.recovery>=34?"#fbbf24":"#f87171";return(
            <div key={i} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 0",borderBottom:i<whoopHist.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",width:65,flexShrink:0}}>{lb}</span>
              <div style={{display:"flex",gap:10,fontSize:12}}>
                <span style={{color:rc,fontWeight:700}}>{d.recovery}%</span>
                <span style={{color:"#60a5fa"}}>{d.sleep}%</span>
                <span style={{color:"#fb923c"}}>{d.strain}</span>
              </div>
            </div>
          );})}
        </>)}

        {whoopHist.length===0&&!whoopData&&<div style={{textAlign:"center",padding:"20px 0",color:"rgba(255,255,255,0.12)",fontSize:12}}>Start logging to see trends</div>}
      </>)}

      {/* ═══ DATA ═══ */}
      {tab==="data"&&(<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,marginTop:28}}>
          <div><h2 style={{fontSize:16,fontWeight:700,color:"#fff",margin:0}}>All Data</h2><p style={{fontSize:11,color:"rgba(255,255,255,0.3)",margin:"2px 0 0"}}>{data.length} scans</p></div>
          {!showAddScan&&<button onClick={()=>setShowAddScan(true)} style={{padding:"8px 14px",borderRadius:10,border:"1px solid rgba(167,139,250,0.3)",background:"rgba(167,139,250,0.08)",color:"#a78bfa",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Scan</button>}
        </div>

        {/* Add Scan Form */}
        {showAddScan&&(<div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:16,padding:16,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><span style={{fontSize:14,fontWeight:700,color:"#a78bfa"}}>📊 New InBody Scan</span><button onClick={()=>setShowAddScan(false)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer"}}>✕</button></div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginBottom:3,fontWeight:600}}>DATE</div>
            <input type="date" value={newScan.date} onChange={e=>setNewScan({...newScan,date:e.target.value})} style={{...inp,colorScheme:"dark"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
            <div>
              <div style={{fontSize:9,color:"#a78bfa",marginBottom:3,fontWeight:700}}>WEIGHT (kg)</div>
              <input type="number" step="0.1" value={newScan.weight} onChange={e=>setNewScan({...newScan,weight:e.target.value})} placeholder="54.1" style={{...inp,textAlign:"center",fontSize:18,padding:"10px 6px",fontWeight:700}}/>
            </div>
            <div>
              <div style={{fontSize:9,color:"#34d399",marginBottom:3,fontWeight:700}}>MUSCLE (kg)</div>
              <input type="number" step="0.1" value={newScan.muscle} onChange={e=>setNewScan({...newScan,muscle:e.target.value})} placeholder="18.0" style={{...inp,textAlign:"center",fontSize:18,padding:"10px 6px",fontWeight:700}}/>
            </div>
            <div>
              <div style={{fontSize:9,color:"#f472b6",marginBottom:3,fontWeight:700}}>BODY FAT %</div>
              <input type="number" step="0.1" value={newScan.fatPct} onChange={e=>setNewScan({...newScan,fatPct:e.target.value})} placeholder="37.6" style={{...inp,textAlign:"center",fontSize:18,padding:"10px 6px",fontWeight:700}}/>
            </div>
          </div>
          {newScan.weight&&newScan.fatPct&&(<div style={{textAlign:"center",padding:"8px",background:"rgba(255,255,255,0.03)",borderRadius:10,marginBottom:12,fontSize:12,color:"rgba(255,255,255,0.4)"}}>
            Fat mass: <span style={{color:"#f472b6",fontWeight:700}}>{(+newScan.weight * +newScan.fatPct/100).toFixed(1)} kg</span> · Lean: <span style={{color:"#60a5fa",fontWeight:700}}>{(+newScan.weight - +newScan.weight * +newScan.fatPct/100).toFixed(1)} kg</span>
          </div>)}
          <button onClick={addScan} disabled={!newScan.weight||!newScan.fatPct} style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:newScan.weight&&newScan.fatPct?"linear-gradient(135deg,#a78bfa,#6d28d9)":"rgba(255,255,255,0.06)",color:newScan.weight&&newScan.fatPct?"#fff":"rgba(255,255,255,0.2)",fontSize:14,fontWeight:700,cursor:newScan.weight&&newScan.fatPct?"pointer":"default"}}>Save Scan</button>
        </div>)}

        {/* Scan table */}
        <div style={{overflowX:"auto",borderRadius:12,border:"1px solid rgba(255,255,255,0.06)"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:"rgba(255,255,255,0.04)"}}>{["Date","Wt","Musc","Fat%","Fat kg","M:F",""].map(h=>(<th key={h} style={{padding:"8px 5px",textAlign:"right",color:"rgba(255,255,255,0.4)",fontWeight:600,borderBottom:"1px solid rgba(255,255,255,0.06)",whiteSpace:"nowrap"}}>{h}</th>))}</tr></thead>
          <tbody>{data.map((d,i)=>{const isB=d.fatPct===best.fatPct;const isL=i===data.length-1;const isUser=userScans.some(s=>s.date===d.date);return(<tr key={i} style={{background:isB?"rgba(74,222,128,0.05)":isL?"rgba(167,139,250,0.05)":i%2===0?"transparent":"rgba(255,255,255,0.015)"}}>
            <td style={{padding:"6px 5px",textAlign:"right",color:"rgba(255,255,255,0.5)",fontSize:10,whiteSpace:"nowrap"}}>{d.label}{isB?" ★":isL?" ●":""}</td>
            <td style={{padding:"6px 5px",textAlign:"right",color:"#a78bfa",fontWeight:600}}>{d.weight}</td>
            <td style={{padding:"6px 5px",textAlign:"right",color:"#34d399",fontWeight:600}}>{d.muscle}</td>
            <td style={{padding:"6px 5px",textAlign:"right",color:"#f472b6",fontWeight:600}}>{d.fatPct}%</td>
            <td style={{padding:"6px 5px",textAlign:"right",color:"rgba(255,255,255,0.4)"}}>{d.fatMass}</td>
            <td style={{padding:"6px 5px",textAlign:"right",color:(d.muscle/d.fatMass)>=0.9?"#4ade80":"#fbbf24"}}>{(d.muscle/d.fatMass).toFixed(2)}</td>
            <td style={{padding:"6px 2px",textAlign:"right"}}>{isUser&&<button onClick={()=>removeUserScan(d.date)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.1)",fontSize:10,cursor:"pointer"}}>✕</button>}</td>
          </tr>);})}</tbody></table>
        </div>
        <div style={{marginTop:6,fontSize:9,color:"rgba(255,255,255,0.15)"}}>★ best fat% · ● latest · ✕ = user-added (deletable)</div>
      </>)}

      <div style={{marginTop:32,textAlign:"center",fontSize:9,color:"rgba(255,255,255,0.06)"}}>Body Comp HQ</div>
      </div>

      {/* Bottom Navigation */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:99,background:"rgba(10,8,18,0.92)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,0.06)",padding:"6px 0 env(safe-area-inset-bottom,8px)",maxWidth:480,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-around",alignItems:"center"}}>
          {navItems.map(n=>{const active=n.id==="more"?["data","projection","monthly"].includes(tab):tab===n.id;return(
            <button key={n.id} onClick={()=>{if(n.id==="more"){setShowMore(!showMore);}else{setTab(n.id);setShowMore(false);}}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 12px",background:"none",border:"none",cursor:"pointer",minWidth:56}}>
              <span style={{fontSize:22,filter:active?"none":"grayscale(1) opacity(0.4)",transition:"filter 0.2s"}}>{n.icon}</span>
              <span style={{fontSize:10,fontWeight:active?700:400,color:active?"#a78bfa":"rgba(255,255,255,0.3)",fontFamily:"Outfit",transition:"color 0.2s"}}>{n.label}</span>
            </button>
          );})}
        </div>
      </div>
    </div>
  );
}
