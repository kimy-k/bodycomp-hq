/* ═══ SETTINGS SHEET ═══
   Editable profile, goals, macros, whey, peptide toggles, notif setup, export, switch user.
   Reads userConfig from parent, writes via onSave callback. */

import {useState} from "react";
import {Icon} from "./Icon.jsx";
import {STYLE} from "./styles.js";
import {PROFILES, PEPTIDES, AVAILABLE_PEPS} from "./data.js";

export function Settings({db,userId,userConfig,defaultProfile,onClose,onSave,notifEnabled,notifPerm,requestNotifPermission,disableNotifs,exportData,exporting,switchUser}){
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

        {/* Preferences */}
        <div className="rise" style={{animationDelay:".36s",marginTop:28,...section}}>
          <h2 className="serif" style={{fontSize:20,margin:"0 0 4px",fontStyle:"italic",color:"var(--t-1)",fontWeight:400,letterSpacing:"-0.015em"}}>Preferences</h2>
          <p style={{fontSize:11.5,color:"var(--t-3)",margin:"0 0 16px"}}>Notifications and data tools.</p>

          {/* Notifications row */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,paddingBottom:14,borderBottom:"1px solid var(--line-soft)",marginBottom:14}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13.5,fontWeight:600,color:"var(--t-1)"}}>Peptide reminders</div>
              <div style={{fontSize:11.5,color:"var(--t-3)",marginTop:4,lineHeight:1.5}}>{notifPerm==="unsupported"?"Notifications aren't supported in this browser.":notifPerm==="denied"?"Blocked — enable in your browser/system settings to use this.":notifEnabled?"On. The app will alert you when a dose goes overdue (only while open).":"Off. Tap to enable."}</div>
              <div style={{fontSize:11,color:"var(--t-4)",marginTop:6,fontStyle:"italic",lineHeight:1.4}}>iOS: install to home screen for the most reliable delivery (Share → Add to Home Screen).</div>
            </div>
            {notifPerm!=="unsupported"&&(<button onClick={notifEnabled?disableNotifs:requestNotifPermission} disabled={notifPerm==="denied"} className="touch" style={{padding:"10px 14px",borderRadius:"var(--r-sm)",border:notifEnabled?"1px solid var(--accent-line)":"1px solid var(--line-soft)",background:notifEnabled?"var(--accent-soft)":"var(--elev-2)",color:notifEnabled?"var(--accent)":notifPerm==="denied"?"var(--t-4)":"var(--t-2)",fontSize:12,fontWeight:600,cursor:notifPerm==="denied"?"default":"pointer",flexShrink:0}}>{notifEnabled?"On":notifPerm==="denied"?"Blocked":"Turn on"}</button>)}
          </div>

          {/* Export row */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13.5,fontWeight:600,color:"var(--t-1)"}}>Export your data</div>
              <div style={{fontSize:11.5,color:"var(--t-3)",marginTop:4,lineHeight:1.5}}>Download every scan, meal, dose, Whoop entry, measurement, photo URL, and reconstitution batch as JSON. Yours to keep.</div>
            </div>
            <button onClick={exportData} disabled={exporting} className="touch" style={{padding:"10px 14px",borderRadius:"var(--r-sm)",border:"1px solid var(--line-soft)",background:"var(--elev-2)",color:"var(--t-2)",fontSize:12,fontWeight:600,cursor:exporting?"default":"pointer",flexShrink:0,opacity:exporting?0.6:1}}>{exporting?"…":"Export"}</button>
          </div>
        </div>

        {/* Switch user — lets the device be handed over briefly without exposing data */}
        {switchUser&&<div className="rise" style={{animationDelay:".38s",marginTop:18,padding:"14px 18px",background:"var(--elev-1)",borderRadius:"var(--r-md)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13.5,fontWeight:600,color:"var(--t-1)"}}>Switch user</div>
              <div style={{fontSize:11.5,color:"var(--t-3)",marginTop:4,lineHeight:1.5}}>This device is locked to <strong style={{color:"var(--t-2)"}}>{defaultProfile?.name||userId}</strong>. Tap to hand the phone to the other user — they'll be returned to the picker.</div>
            </div>
            <button onClick={switchUser} className="touch" style={{padding:"10px 14px",borderRadius:"var(--r-sm)",border:"1px solid var(--line-soft)",background:"var(--elev-2)",color:"var(--t-2)",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>Switch</button>
          </div>
        </div>}

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
