/* ═══ SHARED UI PRIMITIVES ═══
   Small presentational components reused across screens.
   Each is a thin styled wrapper — no state, no fetch, no business logic. */

import {Icon} from "./Icon.jsx";

/* ═══ SHARED UI ═══ */
export const Tip=({active,payload,label})=>!active||!payload?.length?null:(<div style={{background:"var(--tip-bg)",backdropFilter:"blur(20px)",border:"1px solid var(--line)",borderRadius:14,padding:"10px 14px",fontSize:12,color:"var(--t-1)",boxShadow:"var(--shadow-1)"}}><div className="mono" style={{fontWeight:600,marginBottom:6,fontSize:11,color:"var(--t-2)",textTransform:"uppercase",letterSpacing:".08em"}}>{label}</div>{payload.map((p,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}><span style={{width:7,height:7,borderRadius:"50%",background:p.color,display:"inline-block"}}/><span style={{color:"var(--t-3)",fontSize:11}}>{p.name}</span><span className="mono" style={{fontWeight:600,color:p.color,marginLeft:"auto",fontSize:12}}>{p.value}</span></div>))}</div>);

export const Card=({title,value,unit,sub,color,icon,delay=0})=>(
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

export const H2=({children,sub,delay=0})=>(<div className="rise" style={{animationDelay:`${delay}s`,marginBottom:12,marginTop:28}}>
  <h2 className="serif" style={{fontSize:26,fontWeight:400,color:"var(--t-1)",margin:0,letterSpacing:"-0.015em",fontStyle:"italic"}}>{children}</h2>
  {sub&&<p style={{fontSize:11.5,color:"var(--t-3)",margin:"2px 0 0",letterSpacing:".01em"}}>{sub}</p>}
</div>);

export const TabBtn=({active,onClick,children})=>(<button onClick={onClick} style={{padding:"8px 14px",borderRadius:999,border:"1px solid "+(active?"var(--accent-line)":"transparent"),cursor:"pointer",fontSize:12,fontWeight:active?600:500,background:active?"var(--accent-soft)":"transparent",color:active?"var(--accent)":"var(--t-3)",whiteSpace:"nowrap",transition:"all .2s var(--ease-out)"}}>{children}</button>);

export const Insight=({icon,title,text,color,delay=0})=>(<div className="rise" style={{animationDelay:`${delay}s`,background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:"14px 16px",marginBottom:10,borderLeft:`3px solid ${color}`}}>
  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
    <Icon n={icon} s={15} c={color} sw={1.7}/>
    <span style={{fontSize:13,fontWeight:600,color}}>{title}</span>
  </div>
  <div style={{fontSize:12.5,lineHeight:1.6,color:"var(--t-2)"}}>{text}</div>
</div>);

export const cBox={background:"var(--elev-1)",borderRadius:"var(--r-md)",padding:"14px 6px 6px 0",border:"none"};

/* Skeleton loader — shimmering placeholder bars while data fetches */
export const Skel=({h=14,w="100%",mb=8,r=6,style={}})=>(<div style={{height:h,width:w,marginBottom:mb,borderRadius:r,background:"linear-gradient(90deg, var(--elev-1) 0%, var(--elev-2) 50%, var(--elev-1) 100%)",backgroundSize:"200% 100%",animation:"shimmer 1.6s var(--ease-out) infinite",...style}}/>);
export const SkelTab=()=>(<div className="fade">
  <Skel h={140} mb={14} r={20}/>
  <Skel h={64} mb={12} r={14}/>
  <div style={{display:"flex",gap:8,marginBottom:14}}>{[1,2,3].map(i=>(<Skel key={i} h={68} mb={0} r={12}/>))}</div>
  <Skel h={54} mb={18} r={12}/>
  <Skel h={18} w="40%" mb={12}/>
  {[1,2,3].map(i=>(<Skel key={i} h={48} mb={6} r={8}/>))}
</div>);

/* Toast — bottom-center brief notification, used for save failures */
export const Toast=({toast})=>!toast?null:(<div className="sheet" style={{position:"fixed",bottom:"calc(96px + env(safe-area-inset-bottom,0px))",left:"50%",transform:"translateX(-50%)",zIndex:200,background:toast.type==="error"?"color-mix(in oklch, var(--c-danger) 18%, var(--elev-2))":"color-mix(in oklch, var(--c-success) 18%, var(--elev-2))",border:`1px solid ${toast.type==="error"?"var(--c-danger)":"var(--c-success)"}`,borderRadius:"var(--r-md)",padding:"11px 18px",color:"var(--t-1)",fontSize:13,fontWeight:500,boxShadow:"var(--shadow-1)",maxWidth:"min(90vw, 360px)",display:"flex",alignItems:"center",gap:8}}>
  <Icon n={toast.type==="error"?"warn":"check"} s={16} c={toast.type==="error"?"var(--c-danger)":"var(--c-success)"} sw={2}/>
  <span>{toast.msg}</span>
</div>);
