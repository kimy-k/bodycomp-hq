/* ═══ ERROR BOUNDARY ═══
   Surfaces real crashes instead of black screen. Logs to console for debugging. */

import {Component} from "react";
import {Icon} from "./Icon.jsx";

export class ErrorBoundary extends Component {
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

