import { useState, useRef, useEffect } from "react";

const GUARANTEED_ROUNDS = 4;
const MAX_ROUNDS = 8;
const FONT = "'DM Sans', system-ui, sans-serif";
const MONO = "'Space Mono', 'SF Mono', monospace";
const FONT_URL = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap";
const C = { bg:"#0b0d11",surface:"#13161d",surfaceAlt:"#1a1d26",border:"#262b38",borderLight:"#363d50",text:"#e4e7ed",muted:"#8891a5",dim:"#555d73",accent:"#5ba0f5",accentDim:"#2d5a99",green:"#3dd68c",greenDim:"#1a5e3e",red:"#f06868",redDim:"#6e2222",yellow:"#f0c050" };

const SCENARIOS = [
  { id:"saas", title:"SaaS Vendor Agreement", subtitle:"You're a Series B startup buying enterprise software. Negotiate the MSA.", yourRole:"Buyer", theirRole:"Vendor Counsel",
    terms:[
      { id:"liability_cap", label:"Liability Cap", positions:["$50K","$100K","$250K","$500K","$750K","$1M","$2M","$3M","$5M","$8M","Unlimited"], description:"Maximum vendor liability for damages",
        clause:(v)=>`8.1 Limitation of Liability. IN NO EVENT SHALL VENDOR'S AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT EXCEED ${v}, WHETHER IN CONTRACT, TORT, OR OTHERWISE.` },
      { id:"termination", label:"Termination for Convenience", positions:["180 days","150 days","120 days","90 days","75 days","60 days","45 days","30 days","15 days","7 days","At will"], description:"Notice period to terminate without cause",
        clause:(v)=>`12.2 Termination for Convenience. Either party may terminate this Agreement without cause upon ${v} prior written notice to the other party.` },
      { id:"sla", label:"SLA Uptime Guarantee", positions:["95%","96%","97%","97.5%","98%","98.5%","99%","99.5%","99.9%","99.95%","99.99%"], description:"Guaranteed minimum platform availability",
        clause:(v)=>`Schedule A — Service Levels. Vendor shall maintain Platform Availability of no less than ${v} measured on a monthly basis, excluding scheduled maintenance windows.` },
      { id:"data_deletion", label:"Data Deletion Post-Termination", positions:["Best effort","180 days","120 days","90 days","60 days","45 days","30 days","14 days","7 days","3 days","Immediate + cert"], description:"Timeline to delete all customer data",
        clause:(v)=>`14.3 Data Return and Deletion. Upon termination, Vendor shall delete all Customer Data within ${v === "Best effort" ? "a commercially reasonable timeframe" : v === "Immediate + cert" ? "twenty-four (24) hours and provide written certification of deletion" : v + " of the effective date of termination"}.` },
    ],
    contractTitle:"MASTER SERVICES AGREEMENT",
    contractParties:"This Master Services Agreement (\"Agreement\") is entered into between Customer (\"Buyer\") and Vendor (\"Provider\").",
    persona:`You are outside counsel for a mid-market SaaS vendor negotiating an MSA with a Series B buyer. Priorities: (1) Keep liability cap LOW — ideally $500K or 12mo fees, absolutely resist unlimited; (2) Long termination notice for revenue predictability; (3) SLA is flexible since platform runs 99.9%+; (4) Data deletion — prefer longer timelines due to backup complexity. Reference "market standard" and "industry practice" when pushing back. Be professional but firm. Never reveal your weights.`,
    userWeights:{ liability_cap:8, termination:4, sla:6, data_deletion:7 },
    aiWeights:{ liability_cap:9, termination:7, sla:2, data_deletion:4 },
  },
  { id:"sideletter", title:"Series A Side Letter", subtitle:"You're a $25M LP committing to a $300M fund. Negotiate your side letter.", yourRole:"LP", theirRole:"Fund GP",
    terms:[
      { id:"mgmt_fee", label:"Management Fee", positions:["2.5%","2.25%","2.0%","1.9%","1.8%","1.75%","1.5%","1.25%","1.0%","0.75%","0.5%"], description:"Annual fee on committed capital",
        clause:(v)=>`2. Management Fee. Notwithstanding Section 6.1 of the LPA, the Management Fee applicable to the Investor's Capital Commitment shall be ${v} per annum of committed capital during the Investment Period.` },
      { id:"coinvest", label:"Co-Investment Rights", positions:["None","Best efforts","Notified","First look","1:1 ratio","1.5:1","2:1","2.5:1","3:1","4:1","Guaranteed pro-rata"], description:"Right to co-invest alongside the fund",
        clause:(v)=>`3. Co-Investment. The General Partner shall provide the Investor with ${v === "None" ? "no co-investment rights beyond those in the LPA" : v === "Best efforts" ? "best efforts notification of co-investment opportunities" : v === "Guaranteed pro-rata" ? "a guaranteed pro-rata co-investment allocation in all portfolio investments" : v + " co-investment rights in future portfolio company investments"}.` },
      { id:"info_rights", label:"Reporting & Transparency", positions:["Annual only","Semi-annual","Quarterly summary","Quarterly detailed","+ capital call detail","+ company names","+ valuations","+ board decks","+ financials","+ monthly flash","Full LPAC seat"], description:"Level of portfolio reporting",
        clause:(v)=>`4. Information Rights. In addition to reports required under the LPA, the General Partner shall provide the Investor with ${v === "Annual only" ? "annual audited financial statements" : v === "Full LPAC seat" ? "full LPAC membership with access to all portfolio company financials, board materials, and monthly reporting" : v + " reporting on portfolio performance"}.` },
      { id:"mfn", label:"MFN Clause", positions:["None","Notification only","Narrow scope","Fee MFN only","Fees + key terms","Broad MFN","Broad + retroactive","+ audit rights","+ quarterly review","Auto-match","Unconditional MFN"], description:"Most Favored Nation rights",
        clause:(v)=>`5. Most Favored Nation. ${v === "None" ? "This Side Letter does not include most favored nation protections." : v === "Unconditional MFN" ? "The Investor shall automatically receive the benefit of any more favorable term granted to any other Limited Partner, without limitation as to scope or timing." : "The Investor shall receive " + v + " most favored nation protections with respect to side letter terms granted to other Limited Partners."}` },
    ],
    contractTitle:"SIDE LETTER TO LIMITED PARTNERSHIP AGREEMENT",
    contractParties:"This Side Letter (\"Letter\") supplements the Limited Partnership Agreement of Fund I, L.P. between the General Partner and the undersigned Limited Partner (\"Investor\").",
    persona:`You are GP of a $300M venture fund negotiating a side letter with a $25M LP. You've closed $200M already. Priorities: (1) Protect management fees — they fund operations, absolutely resist below 1.5%; (2) Resist MFN — dangerous precedent; (3) Information rights are operationally burdensome; (4) Co-invest is easy to give since it brings more capital. Reference "LPA standard provisions" and "fund economics." Be collegial but protect fund terms.`,
    userWeights:{ mgmt_fee:7, coinvest:9, info_rights:5, mfn:6 },
    aiWeights:{ mgmt_fee:10, coinvest:3, info_rights:7, mfn:8 },
  },
  { id:"employment", title:"VP Engineering Offer", subtitle:"You're a senior engineer with competing offers negotiating your package.", yourRole:"Candidate", theirRole:"VP People",
    terms:[
      { id:"equity", label:"Equity Grant (RSUs)", positions:["10K","15K","20K","25K","30K","40K","50K","65K","80K","100K","150K shares"], description:"Initial stock option/RSU grant",
        clause:(v)=>`4. Equity Compensation. Subject to Board approval, Employee shall be granted ${v} of Restricted Stock Units (RSUs), vesting over four (4) years with a one-year cliff.` },
      { id:"remote", label:"Remote Work Policy", positions:["Full on-site","4 days/wk","3 days/wk","2 days/wk","1 day/wk","2 days/mo","Quarterly visits","Remote (US)","Remote + intl","Remote + cowork $","Async-first"], description:"In-office vs remote expectations",
        clause:(v)=>`7. Work Location. Employee's work arrangement shall be ${v === "Full on-site" ? "full-time in the Company's primary office" : v === "Async-first" ? "fully remote with async-first communication and a monthly co-working stipend" : v + " in-office, with remaining days remote at Employee's discretion"}.` },
      { id:"signing", label:"Signing Bonus", positions:["$0","$5K","$10K","$15K","$20K","$25K","$30K","$40K","$50K","$75K","$100K"], description:"One-time cash bonus",
        clause:(v)=>`5. Signing Bonus. ${v === "$0" ? "No signing bonus shall be provided." : "Company shall pay Employee a one-time signing bonus of " + v + ", payable within thirty (30) days of the Start Date, subject to repayment if Employee voluntarily terminates within twelve (12) months."}` },
      { id:"accel", label:"Acceleration on CoC", positions:["None","Board discretion","3 months","6 months","9 months","12 months","18 months","24 months","Single trigger 50%","Single trigger 100%","Double trigger 100%"], description:"Vesting acceleration on acquisition",
        clause:(v)=>`6. Change of Control. ${v === "None" ? "No acceleration of vesting shall occur upon a Change of Control." : v === "Board discretion" ? "The Board may, in its sole discretion, accelerate vesting upon a Change of Control." : "Upon a Change of Control, " + v + " of unvested equity shall immediately vest."}` },
    ],
    contractTitle:"EXECUTIVE EMPLOYMENT OFFER LETTER",
    contractParties:"This Offer Letter (\"Agreement\") sets forth the terms of employment between the Company and the undersigned (\"Employee\").",
    persona:`You are VP People at a Series C startup. The candidate is strong with competing offers. Priorities: (1) Minimize signing bonus — pure cash cost, budget is tight; (2) Protect in-office culture — CEO is firm on hybrid; (3) Equity is flexible — board-approved band is wide; (4) Acceleration — resist beyond standard 12mo double trigger. Reference "our comp band" and "standard offer." Be warm but firm on cash.`,
    userWeights:{ equity:8, remote:9, signing:5, accel:4 },
    aiWeights:{ equity:3, remote:8, signing:10, accel:5 },
  },
];

async function callAI(sys, msg) {
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system:sys, messages:[{role:"user",content:msg}] }) });
    const d = await r.json(); return d.content?.[0]?.text||null;
  } catch(e) { return null; }
}

function buildSys(sc) {
  const td = sc.terms.map(t=>`- ${t.label}: 0="${t.positions[0]}" (favors you) ... 5="${t.positions[5]}" ... 10="${t.positions[10]}" (favors them)`).join("\n");
  return `${sc.persona}\n\nTERMS (0=favors you, 10=favors counterparty):\n${td}\n\nRESPONSE FORMAT:\n\`\`\`json\n{"action":"propose|accept|reject","positions":{${sc.terms.map(t=>`"${t.id}":<0-10>`).join(",")}}}\n\`\`\`\nMESSAGE: your negotiation message (max 150 words, natural legal language, reference actual values not numbers)\n\nFor accept, copy their last positions. Maximize YOUR score while reaching a deal. No deal = worst outcome for both.`;
}

function buildTurn(hist, round, sc) {
  let p = round>GUARANTEED_ROUNDS ? `⚠ OVERTIME Round ${round} — could end any moment with NO DEAL.\n\n` : "";
  if(hist.length) { p+="HISTORY:\n"; hist.forEach(h=>{ p+=`[${h.role}] ${h.action}: ${h.positions?sc.terms.map(t=>`${t.label}=${t.positions[h.positions[t.id]]}`).join(", "):""}\n  "${h.message}"\n`; }); p+="\n"; }
  return p+`Round ${round}. Your turn.`;
}

function parseResp(text,sc) {
  try {
    const jm=text.match(/```json\s*([\s\S]*?)\s*```/); let parsed;
    if(jm) parsed=JSON.parse(jm[1]); else { const bm=text.match(/\{[\s\S]*"action"[\s\S]*\}/); if(bm) parsed=JSON.parse(bm[0]); else return null; }
    const mm=text.match(/MESSAGE:\s*([\s\S]*?)$/m);
    const msg=mm?mm[1].trim():text.replace(/```json[\s\S]*?```/,"").replace(/\{[\s\S]*?\}/,"").trim().substring(0,400);
    const pos={}; sc.terms.forEach(t=>{pos[t.id]=Math.max(0,Math.min(10,parseInt(parsed.positions?.[t.id]??5)));});
    return {action:parsed.action||"reject",positions:pos,message:msg||"Let me review..."};
  } catch(e){ return null; }
}

function calcScore(pos,weights,terms){ let s=0,m=0; terms.forEach(t=>{const w=weights[t.id]||1;s+=w*(pos[t.id]??5);m+=w*10;}); return {score:s,maxScore:m,pct:m>0?Math.round(s/m*100):0}; }

export default function App() {
  const [phase,setPhase]=useState("select");
  const [sc,setSc]=useState(null);
  const [pos,setPos]=useState({});
  const [hist,setHist]=useState([]);
  const [round,setRound]=useState(1);
  const [lastAI,setLastAI]=useState(null);
  const [msg,setMsg]=useState("");
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState(null);
  const ref=useRef(null);

  useEffect(()=>{const l=document.createElement("link");l.href=FONT_URL;l.rel="stylesheet";document.head.appendChild(l);},[]);
  useEffect(()=>{ref.current?.scrollIntoView({behavior:"smooth"});},[hist]);

  const start=(s)=>{ const init={}; s.terms.forEach(t=>init[t.id]=5); setSc(s);setPos(init);setHist([]);setRound(1);setLastAI(null);setMsg("");setResult(null);setPhase("play"); };

  const endGame=(deal,fp)=>{
    if(!deal){setResult({deal:false});} else {
      const us=calcScore(fp,sc.userWeights,sc.terms);
      const af={}; sc.terms.forEach(t=>af[t.id]=10-fp[t.id]);
      const as=calcScore(af,sc.aiWeights,sc.terms);
      setResult({deal:true,positions:fp,userScore:us,aiScore:as});
    } setPhase("debrief");
  };

  const submit=async(action)=>{
    if(loading)return; setLoading(true);
    const nh=[...hist]; const up={...pos};
    nh.push({role:sc.yourRole,action,positions:action==="propose"?up:action==="accept"&&lastAI?(() => { const f={}; sc.terms.forEach(t=>f[t.id]=10-lastAI[t.id]); return f; })():null,message:msg||(action==="propose"?"Here's my proposal.":action==="accept"?"I accept.":"I'd like to counter.")});
    if(action==="accept"&&lastAI){const f={};sc.terms.forEach(t=>f[t.id]=10-lastAI[t.id]);setHist(nh);setMsg("");setLoading(false);endGame(true,f);return;}
    // AI turn
    const sys=buildSys(sc);
    const aiHist=nh.map(h=>({...h,positions:h.positions?(()=>{const f={};sc.terms.forEach(t=>{f[t.id]=h.role===sc.yourRole?10-(h.positions[t.id]??5):(h.positions[t.id]??5);});return f;})():null}));
    const tp=buildTurn(aiHist,round,sc);
    const aiText=await callAI(sys,tp);
    let ai=aiText?parseResp(aiText,sc):null;
    if(!ai){ai={action:"reject",positions:{},message:"I need to discuss this with my team."};sc.terms.forEach(t=>ai.positions[t.id]=5);}
    if(ai.action==="accept"&&action==="propose"){nh.push({role:sc.theirRole,action:"accept",positions:null,message:ai.message});setHist(nh);setMsg("");setLoading(false);endGame(true,up);return;}
    const disp={};sc.terms.forEach(t=>disp[t.id]=10-(ai.positions[t.id]??5));
    nh.push({role:sc.theirRole,action:ai.action==="propose"?"propose":"reject",positions:ai.action==="propose"?disp:null,message:ai.message});
    setLastAI(ai.positions);setHist(nh);setMsg("");
    const nr=round+1;
    if(nr>MAX_ROUNDS||(nr>GUARANTEED_ROUNDS&&Math.random()<0.25)){setLoading(false);endGame(false,null);return;}
    setRound(nr);setLoading(false);
  };

  // SELECT
  if(phase==="select") return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{maxWidth:960,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:56}}>
          <div style={{fontFamily:MONO,fontSize:11,letterSpacing:4,color:C.accent,textTransform:"uppercase",marginBottom:14}}>Stanford CodeX × LLM x Law Hackathon</div>
          <h1 style={{fontFamily:FONT,fontSize:44,fontWeight:700,color:C.text,margin:0,lineHeight:1.05}}>Contract Negotiation<br/>Arena</h1>
          <p style={{fontFamily:FONT,fontSize:15,color:C.muted,marginTop:14,maxWidth:440,marginLeft:"auto",marginRight:"auto"}}>Negotiate real contract terms against AI counsel. Every clause has hidden value. Find the optimal deal.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
          {SCENARIOS.map(s=>(
            <button key={s.id} onClick={()=>start(s)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"28px 22px",cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.background=C.surfaceAlt;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.surface;}}>
              <div style={{fontFamily:MONO,fontSize:10,color:C.accent,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>{s.id==="saas"?"MSA":s.id==="sideletter"?"SIDE LETTER":"OFFER LETTER"}</div>
              <div style={{fontFamily:FONT,fontSize:19,fontWeight:600,color:C.text,marginBottom:8}}>{s.title}</div>
              <div style={{fontFamily:FONT,fontSize:12,color:C.muted,lineHeight:1.5,marginBottom:14}}>{s.subtitle}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{s.terms.map(t=><span key={t.id} style={{fontFamily:MONO,fontSize:9,padding:"3px 7px",background:C.bg,borderRadius:4,color:C.dim}}>{t.label}</span>)}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if(!sc) return null;

  // DEBRIEF
  if(phase==="debrief"&&result) return (
    <div style={{minHeight:"100vh",background:C.bg,padding:24,display:"flex",justifyContent:"center"}}>
      <div style={{maxWidth:680,width:"100%",paddingTop:48}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontFamily:MONO,fontSize:11,letterSpacing:4,color:result.deal?C.green:C.red,textTransform:"uppercase",marginBottom:10}}>{result.deal?"DEAL CLOSED":"NO DEAL — BOTH LOSE"}</div>
          <h2 style={{fontFamily:FONT,fontSize:48,fontWeight:700,color:C.text,margin:0}}>{result.deal?`${result.userScore.pct}%`:"-50"}</h2>
          <p style={{fontFamily:FONT,fontSize:14,color:C.muted,marginTop:6}}>{result.deal?`You captured ${result.userScore.pct}% of your maximum possible value`:"Negotiation expired without agreement"}</p>
        </div>
        {result.deal&&<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:24}}>
          <div style={{fontFamily:MONO,fontSize:10,color:C.accent,letterSpacing:2,marginBottom:20}}>DEAL ANALYSIS</div>
          {sc.terms.map(t=>{
            const p=result.positions[t.id];const uw=sc.userWeights[t.id];const aw=sc.aiWeights[t.id];const good=p>=6;const bad=p<=4;const youMore=uw>aw;
            return(<div key={t.id} style={{marginBottom:20,padding:14,background:C.bg,borderRadius:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontFamily:FONT,fontSize:14,fontWeight:600,color:C.text}}>{t.label}</span>
                <span style={{fontFamily:MONO,fontSize:13,fontWeight:700,color:good?C.green:bad?C.red:C.yellow}}>{t.positions[p]}</span>
              </div>
              <div style={{height:6,background:C.surfaceAlt,borderRadius:3,marginBottom:8,position:"relative"}}>
                <div style={{position:"absolute",left:0,height:"100%",width:`${p*10}%`,background:good?C.green:bad?C.red:C.yellow,borderRadius:3}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontFamily:MONO,fontSize:10,color:C.dim,marginBottom:6}}>
                <span>← Favors {sc.theirRole}</span><span>Favors you →</span>
              </div>
              <div style={{display:"flex",gap:16,fontFamily:MONO,fontSize:10}}>
                <span style={{color:C.muted}}>You: <span style={{color:uw>6?C.green:uw>3?C.yellow:C.dim}}>{uw>6?"HIGH":uw>3?"MED":"LOW"}</span></span>
                <span style={{color:C.muted}}>Them: <span style={{color:aw>6?C.red:aw>3?C.yellow:C.dim}}>{aw>6?"HIGH":aw>3?"MED":"LOW"}</span></span>
              </div>
              {youMore&&bad&&<div style={{fontFamily:FONT,fontSize:11,color:C.red,marginTop:6}}>⚠ You valued this more — you left value on the table here.</div>}
              {!youMore&&good&&<div style={{fontFamily:FONT,fontSize:11,color:C.green,marginTop:6}}>✓ Smart — they cared less, you captured it.</div>}
              {youMore&&good&&<div style={{fontFamily:FONT,fontSize:11,color:C.green,marginTop:6}}>✓ Pushed hard on your priority and won.</div>}
              {!youMore&&bad&&<div style={{fontFamily:FONT,fontSize:11,color:C.muted,marginTop:6}}>→ Smart concession — they needed this more.</div>}
            </div>);
          })}
          <div style={{marginTop:16,padding:14,background:C.surfaceAlt,borderRadius:10,border:`1px solid ${C.borderLight}`}}>
            <div style={{fontFamily:FONT,fontSize:13,fontWeight:600,color:C.text,marginBottom:8}}>Key Insight</div>
            <div style={{fontFamily:FONT,fontSize:12,color:C.muted,lineHeight:1.7}}>{(()=>{
              const best=sc.terms.reduce((a,b)=>(sc.userWeights[b.id]-sc.aiWeights[b.id])>(sc.userWeights[a.id]-sc.aiWeights[a.id])?b:a);
              const worst=sc.terms.reduce((a,b)=>(sc.aiWeights[b.id]-sc.userWeights[b.id])>(sc.aiWeights[a.id]-sc.userWeights[a.id])?b:a);
              return `Your best leverage was "${best.label}" — you valued it much more than they did. The optimal play was to push aggressively there while conceding on "${worst.label}" which mattered more to them. The best negotiators find these asymmetries and trade across them.`;
            })()}</div>
          </div>
        </div>}
        <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:28}}>
          <button onClick={()=>start(sc)} style={{fontFamily:FONT,fontSize:14,fontWeight:600,padding:"12px 28px",borderRadius:8,border:`1px solid ${C.accent}`,background:"transparent",color:C.accent,cursor:"pointer"}}>Play Again</button>
          <button onClick={()=>{setPhase("select");setSc(null);}} style={{fontFamily:FONT,fontSize:14,fontWeight:600,padding:"12px 28px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer"}}>New Scenario</button>
        </div>
      </div>
    </div>
  );

  // PLAY
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex"}}>
      <div style={{width:280,borderRight:`1px solid ${C.border}`,padding:20,display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto"}}>
        <div style={{fontFamily:MONO,fontSize:10,color:C.accent,letterSpacing:2,marginBottom:4}}>{sc.title.toUpperCase()}</div>
        <div style={{fontFamily:FONT,fontSize:17,fontWeight:600,color:C.text,marginBottom:3}}>You: {sc.yourRole}</div>
        <div style={{fontFamily:FONT,fontSize:12,color:C.muted,marginBottom:20}}>vs {sc.theirRole}</div>
        <div style={{background:C.surface,borderRadius:10,padding:14,border:`1px solid ${C.border}`,marginBottom:16}}>
          <div style={{fontFamily:MONO,fontSize:10,color:C.dim,letterSpacing:1,marginBottom:10}}>ROUND {round} {round>GUARANTEED_ROUNDS?"⚠ OVERTIME":`of ${GUARANTEED_ROUNDS}+`}</div>
          <div style={{fontFamily:MONO,fontSize:10,color:C.dim,letterSpacing:1,marginBottom:10}}>YOUR PRIORITIES</div>
          {sc.terms.map(t=>{const w=sc.userWeights[t.id];return(
            <div key={t.id} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{fontFamily:FONT,fontSize:11,color:C.muted}}>{t.label}</span>
                <span style={{fontFamily:MONO,fontSize:10,color:w>6?C.green:w>3?C.yellow:C.dim}}>{w>6?"HIGH":w>3?"MED":"LOW"}</span>
              </div>
              <div style={{height:3,background:C.bg,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${w*10}%`,background:w>6?C.green:w>3?C.yellow:C.dim,borderRadius:2}}/></div>
            </div>);
          })}
        </div>
        <div style={{marginTop:"auto",padding:12,background:C.surface,borderRadius:8,border:`1px solid ${C.border}`}}>
          <div style={{fontFamily:MONO,fontSize:10,color:C.dim,marginBottom:4}}>TIP</div>
          <div style={{fontFamily:FONT,fontSize:11,color:C.muted,lineHeight:1.5}}>Concede on LOW priority terms to win HIGH priority ones. The counterparty has different priorities — find the asymmetry.</div>
        </div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column"}}>
        <div style={{flex:1,padding:20,overflowY:"auto"}}>
          {/* Live contract preview */}
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:24,marginBottom:20,maxWidth:640}}>
            <div style={{fontFamily:MONO,fontSize:10,color:C.accent,letterSpacing:3,marginBottom:6}}>LIVE PREVIEW</div>
            <div style={{fontFamily:"'Times New Roman',Georgia,serif",fontSize:16,fontWeight:700,color:C.text,textAlign:"center",marginBottom:4,letterSpacing:1}}>{sc.contractTitle}</div>
            <div style={{fontFamily:"'Times New Roman',Georgia,serif",fontSize:11,color:C.muted,textAlign:"center",marginBottom:16,lineHeight:1.5}}>{sc.contractParties}</div>
            <div style={{borderTop:`1px solid ${C.border}`,marginBottom:16}}/>
            {sc.terms.map((t,idx)=>{const p=pos[t.id]??5;const val=t.positions[p];return(
              <div key={t.id} style={{marginBottom:14}}>
                <div style={{fontFamily:"'Times New Roman',Georgia,serif",fontSize:12.5,color:C.text,lineHeight:1.7}}>
                  {t.clause(val).split(val).map((part,i,arr)=>i<arr.length-1?(
                    <span key={i}>{part}<span style={{background:C.accentDim+"50",color:C.accent,padding:"1px 4px",borderRadius:3,fontWeight:700,borderBottom:`2px solid ${C.accent}`}}>{val}</span></span>
                  ):<span key={i}>{part}</span>)}
                </div>
              </div>
            );})}
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:8}}>
              <div style={{fontFamily:"'Times New Roman',Georgia,serif",fontSize:10,color:C.dim,fontStyle:"italic"}}>Draft — values update as you adjust terms below. Highlighted values are under negotiation.</div>
            </div>
          </div>

          {/* Chat history */}
          {hist.map((h,i)=>{const isU=h.role===sc.yourRole;return(
            <div key={i} style={{display:"flex",justifyContent:isU?"flex-end":"flex-start",marginBottom:14}}>
              <div style={{maxWidth:520,padding:14,background:isU?C.accentDim+"35":C.surface,border:`1px solid ${isU?C.accentDim:C.border}`,borderRadius:isU?"14px 14px 4px 14px":"14px 14px 14px 4px"}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                  <span style={{fontFamily:FONT,fontSize:12,fontWeight:600,color:isU?C.accent:C.yellow}}>{h.role}</span>
                  <span style={{fontFamily:MONO,fontSize:9,padding:"2px 7px",borderRadius:4,background:h.action==="propose"?C.accentDim+"25":h.action==="accept"?C.greenDim+"40":C.redDim+"35",color:h.action==="propose"?C.accent:h.action==="accept"?C.green:C.red}}>{h.action.toUpperCase()}</span>
                </div>
                {h.positions&&<div style={{background:C.bg,borderRadius:8,padding:10,marginBottom:10}}>
                  {sc.terms.map(t=>{const p=h.positions[t.id];if(p===undefined)return null;return(
                    <div key={t.id} style={{display:"flex",justifyContent:"space-between",marginBottom:3,fontFamily:MONO,fontSize:11}}>
                      <span style={{color:C.muted}}>{t.label}</span>
                      <span style={{color:C.text,fontWeight:600}}>{t.positions[p]}</span>
                    </div>);})}
                </div>}
                <div style={{fontFamily:FONT,fontSize:13,color:C.text,lineHeight:1.55}}>{h.message}</div>
              </div>
            </div>);})}
          {loading&&<div style={{display:"flex",justifyContent:"flex-start",marginBottom:14}}>
            <div style={{padding:14,background:C.surface,border:`1px solid ${C.border}`,borderRadius:"14px 14px 14px 4px"}}>
              <span style={{fontFamily:FONT,fontSize:13,color:C.muted}}>{sc.theirRole} is reviewing...</span>
            </div></div>}
          <div ref={ref}/>
        </div>
        <div style={{borderTop:`1px solid ${C.border}`,padding:20,background:C.surface}}>
          <div style={{fontFamily:MONO,fontSize:10,color:C.dim,letterSpacing:2,marginBottom:14}}>SET YOUR POSITION ON EACH CLAUSE</div>
          {sc.terms.map(t=>{const p=pos[t.id]??5;return(
            <div key={t.id} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontFamily:FONT,fontSize:13,fontWeight:500,color:C.text}}>{t.label}</span>
                <span style={{fontFamily:MONO,fontSize:13,fontWeight:700,color:p>=7?C.green:p<=3?C.red:C.yellow}}>{t.positions[p]}</span>
              </div>
              <input type="range" min={0} max={10} value={p} onChange={e=>setPos(prev=>({...prev,[t.id]:parseInt(e.target.value)}))} style={{width:"100%",accentColor:C.accent}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontFamily:MONO,fontSize:9,color:C.dim,marginTop:2}}>
                <span>{t.positions[0]}</span><span>{t.positions[10]}</span>
              </div>
            </div>);})}
          <input type="text" placeholder="Add a message to support your position..." value={msg} onChange={e=>setMsg(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&!loading&&submit("propose")}
            style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,background:C.bg,color:C.text,fontFamily:FONT,fontSize:13,boxSizing:"border-box",outline:"none",marginTop:4}}/>
          <div style={{display:"flex",gap:10,marginTop:12}}>
            <button onClick={()=>submit("propose")} disabled={loading} style={{flex:1,padding:"11px 0",borderRadius:8,border:"none",background:loading?C.dim:C.accent,color:"#fff",fontFamily:FONT,fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer"}}>{loading?"Waiting...":"Propose These Terms"}</button>
            {lastAI&&<button onClick={()=>submit("accept")} disabled={loading} style={{flex:1,padding:"11px 0",borderRadius:8,border:`1px solid ${C.green}`,background:"transparent",color:C.green,fontFamily:FONT,fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer"}}>Accept Their Terms</button>}
            {hist.length>0&&<button onClick={()=>submit("reject")} disabled={loading} style={{padding:"11px 20px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:FONT,fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer"}}>Reject</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
