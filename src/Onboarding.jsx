/* ═══ ONBOARDING ═══
   First-run wizard: profile selection → macro targets → whey override → peptide picks.
   Writes to config via db.setConfig and calls onComplete() to advance. */

import {useState} from "react";
import {Icon} from "./Icon.jsx";
import {STYLE} from "./styles.js";
import {AVAILABLE_PEPS} from "./data.js";

/** Local-date YYYY-MM-DD for scan date default (matches helpers.js todayKey logic). */
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

export function Onboarding({db,onComplete}){
  const [step,setStep]=useState(0);
  const [d,setD]=useState({name:"",height:"",weight:"",age:"",gender:"female",activity:"light",targetBf:"30",targetCal:"",targetProtein:"",targetFat:"",targetCarbs:"",wheyProtein:"",wheyScoops:"",peptides:[],scanWeight:"",scanMuscle:"",scanFat:"",scanDate:todayLocal()});
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
