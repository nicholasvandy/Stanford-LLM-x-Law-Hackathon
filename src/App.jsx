import { useState, useRef, useEffect } from "react";

const GUARANTEED_ROUNDS = 4;
const MAX_ROUNDS = 8;
const SERIF = "'Source Serif 4', Georgia, serif";
const SANS = "'Instrument Sans', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";
const FONT_URL = "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&display=swap";

const C = {
  bg:"#faf8f5", bgAlt:"#f3f0eb", surface:"#ffffff", surfaceAlt:"#f8f6f2",
  border:"#e5e0d8", borderLight:"#ede9e2", borderDark:"#d0c9be",
  text:"#1a1815", textSoft:"#3d3832", muted:"#7a7268", dim:"#a69e93",
  accent:"#2563eb", accentSoft:"#dbeafe",
  green:"#16a34a", greenSoft:"#dcfce7",
  red:"#dc2626", redSoft:"#fee2e2",
  amber:"#d97706", amberSoft:"#fef3c7",
};

const SCENARIOS = [
  { id:"saas", title:"SaaS Vendor Agreement", subtitle:"You're a Series B startup buying enterprise software. Negotiate the MSA.", yourRole:"Buyer", theirRole:"Vendor Counsel",
    brief:"PARTNER MEMO — We're buying Acme's enterprise platform. Annual contract ~$240K. Push hard on the liability cap — I want uncapped or at minimum $5M. SLA needs to be 99.9%+. I'm flexible on termination notice and data deletion. Don't let them walk you into 'market standard' on liability. — Sarah K., Partner",
    dollarBase:240000,
    terms:[
      { id:"liability_cap",label:"Liability Cap",positions:["$50K","$100K","$250K","$500K","$750K","$1M","$2M","$3M","$5M","$8M","Unlimited"],
        clause:v=>`8.1 Limitation of Liability. IN NO EVENT SHALL VENDOR'S AGGREGATE LIABILITY EXCEED ${v}, WHETHER IN CONTRACT, TORT, OR OTHERWISE.` },
      { id:"termination",label:"Termination Notice",positions:["180 days","150 days","120 days","90 days","75 days","60 days","45 days","30 days","15 days","7 days","At will"],
        clause:v=>`12.2 Termination for Convenience. Either party may terminate upon ${v} prior written notice.` },
      { id:"sla",label:"SLA Uptime",positions:["95%","96%","97%","97.5%","98%","98.5%","99%","99.5%","99.9%","99.95%","99.99%"],
        clause:v=>`Schedule A. Vendor shall maintain Platform Availability of no less than ${v} monthly, excluding scheduled maintenance.` },
      { id:"data_deletion",label:"Data Deletion",positions:["Best effort","180 days","120 days","90 days","60 days","45 days","30 days","14 days","7 days","3 days","Immediate + cert"],
        clause:v=>`14.3 Data Deletion. Upon termination, Vendor shall delete all Customer Data within ${v==="Best effort"?"a commercially reasonable timeframe":v==="Immediate + cert"?"24 hours with written certification":v}.` },
    ],
    contractTitle:"MASTER SERVICES AGREEMENT",
    contractParties:"Between Customer (\"Buyer\") and Vendor (\"Provider\")",
    benchmarks:{liability_cap:{market:[3,7],median:5,source:"Common Paper"},termination:{market:[3,6],median:4,source:"Onecle"},sla:{market:[5,8],median:7,source:"Gartner"},data_deletion:{market:[4,7],median:5,source:"IAPP"}},
    persona:`You are outside counsel for a mid-market SaaS vendor. Priorities: (1) Keep liability cap LOW — resist unlimited; (2) Long termination notice; (3) SLA is flexible; (4) Data deletion — prefer longer timelines. Be professional but firm.`,
    userWeights:{liability_cap:8,termination:4,sla:6,data_deletion:7},
    aiWeights:{liability_cap:9,termination:7,sla:2,data_deletion:4},
  },
  { id:"sideletter", title:"Series A Side Letter", subtitle:"You're a $25M LP committing to a $300M fund. Negotiate your side letter.", yourRole:"LP", theirRole:"Fund GP",
    brief:"IC NOTE — We're committing $25M to Fund I ($300M target). GP is Tier 1 but first fund. Push hard on co-investment rights — that's our alpha. Mgmt fee below 2%, ideally 1.75%. MFN is nice-to-have. Info rights: quarterly + company names minimum. — CIO",
    dollarBase:25000000,
    terms:[
      { id:"mgmt_fee",label:"Management Fee",positions:["2.5%","2.25%","2.0%","1.9%","1.8%","1.75%","1.5%","1.25%","1.0%","0.75%","0.5%"],
        clause:v=>`2. Management Fee. The Fee applicable to Investor's Capital Commitment shall be ${v} per annum during the Investment Period.` },
      { id:"coinvest",label:"Co-Investment Rights",positions:["None","Best efforts","Notified","First look","1:1 ratio","1.5:1","2:1","2.5:1","3:1","4:1","Guaranteed pro-rata"],
        clause:v=>`3. Co-Investment. The GP shall provide the Investor with ${v==="None"?"no co-investment rights beyond the LPA":v==="Guaranteed pro-rata"?"guaranteed pro-rata co-investment in all investments":v+" co-investment rights"}.` },
      { id:"info_rights",label:"Reporting",positions:["Annual only","Semi-annual","Quarterly summary","Quarterly detailed","+ capital calls","+ company names","+ valuations","+ board decks","+ financials","+ monthly flash","Full LPAC seat"],
        clause:v=>`4. Information Rights. The GP shall provide ${v==="Annual only"?"annual audited financials":v==="Full LPAC seat"?"full LPAC membership with complete portfolio access":v+" reporting"}.` },
      { id:"mfn",label:"MFN Clause",positions:["None","Notification only","Narrow scope","Fee MFN only","Fees + key terms","Broad MFN","Broad + retroactive","+ audit rights","+ quarterly review","Auto-match","Unconditional MFN"],
        clause:v=>`5. Most Favored Nation. ${v==="None"?"No MFN protections included.":v==="Unconditional MFN"?"Investor automatically receives any more favorable term granted to any LP.":"Investor receives "+v+" MFN protections."}` },
    ],
    contractTitle:"SIDE LETTER TO LIMITED PARTNERSHIP AGREEMENT",
    contractParties:"Supplementing the LPA of Fund I, L.P.",
    benchmarks:{mgmt_fee:{market:[2,5],median:3,source:"Cooley GO"},coinvest:{market:[3,6],median:4,source:"NVCA"},info_rights:{market:[2,5],median:3,source:"Fenwick"},mfn:{market:[3,5],median:4,source:"Cooley GO"}},
    persona:`You are GP of a $300M fund negotiating with a $25M LP. Priorities: (1) Protect fees — resist below 1.5%; (2) Resist MFN; (3) Info rights are burdensome; (4) Co-invest is easy to give. Be collegial but firm.`,
    userWeights:{mgmt_fee:7,coinvest:9,info_rights:5,mfn:6},
    aiWeights:{mgmt_fee:10,coinvest:3,info_rights:7,mfn:8},
  },
  { id:"employment", title:"VP Engineering Offer", subtitle:"You're a senior engineer with competing offers.", yourRole:"Candidate", theirRole:"VP People",
    brief:"You have two competing offers. This Series C is your top choice but the initial offer is below market. Priorities: maximize equity (you believe in the company), get remote flexibility (partner in another city), secure acceleration on acquisition. Signing bonus is nice but not critical.",
    dollarBase:350000,
    terms:[
      { id:"equity",label:"Equity Grant",positions:["10K","15K","20K","25K","30K","40K","50K","65K","80K","100K","150K shares"],
        clause:v=>`4. Equity. Employee shall be granted ${v} RSUs, vesting over 4 years with a 1-year cliff.` },
      { id:"remote",label:"Remote Policy",positions:["Full on-site","4 days/wk","3 days/wk","2 days/wk","1 day/wk","2 days/mo","Quarterly","Remote US","Remote intl","Remote + stipend","Async-first"],
        clause:v=>`7. Work Location. Employee's arrangement shall be ${v==="Full on-site"?"full-time on-site":v==="Async-first"?"fully remote, async-first with co-working stipend":v}.` },
      { id:"signing",label:"Signing Bonus",positions:["$0","$5K","$10K","$15K","$20K","$25K","$30K","$40K","$50K","$75K","$100K"],
        clause:v=>`5. Signing Bonus. ${v==="$0"?"No signing bonus.":"Company shall pay "+v+" within 30 days, subject to 12-month repayment."}` },
      { id:"accel",label:"Acceleration",positions:["None","Board discretion","3 months","6 months","9 months","12 months","18 months","24 months","Single 50%","Single 100%","Double trigger 100%"],
        clause:v=>`6. Change of Control. ${v==="None"?"No acceleration on CoC.":v==="Board discretion"?"Board may accelerate at its discretion.":"Upon CoC, "+v+" of unvested equity vests immediately."}` },
    ],
    contractTitle:"EXECUTIVE OFFER LETTER",
    contractParties:"Between the Company and the undersigned Employee",
    benchmarks:{equity:{market:[3,7],median:5,source:"Levels.fyi"},remote:{market:[2,5],median:3,source:"Pave"},signing:{market:[3,6],median:4,source:"Levels.fyi"},accel:{market:[4,6],median:5,source:"NVCA"}},
    persona:`You are VP People at a Series C startup. Priorities: (1) Minimize signing bonus; (2) Protect in-office culture; (3) Equity is flexible; (4) Resist acceleration beyond 12mo. Be warm but firm on cash.`,
    userWeights:{equity:8,remote:9,signing:5,accel:4},
    aiWeights:{equity:3,remote:8,signing:10,accel:5},
  },
];

async function callAI(sys,msg){try{const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:sys,messages:[{role:"user",content:msg}]})});const d=await r.json();return d.content?.[0]?.text||null;}catch(e){return null;}}
function buildSys(sc){const td=sc.terms.map(t=>`- ${t.label}: 0="${t.positions[0]}" ... 5="${t.positions[5]}" ... 10="${t.positions[10]}"`).join("\n");return `${sc.persona}\n\nTERMS (0=favors you, 10=favors counterparty):\n${td}\n\nFORMAT:\n\`\`\`json\n{"action":"propose|accept|reject","positions":{${sc.terms.map(t=>`"${t.id}":<0-10>`).join(",")}}}\n\`\`\`\nMESSAGE: your message (max 120 words, natural legal language)\n\nRULES: Never concede >2 positions per round. On HIGH priority terms start at 2 or lower, never above 4 until final round. Only accept if scoring 55%+. Push back firmly. Anchor extreme on priorities.`;}
function buildTurn(hist,round,sc){let p=round>GUARANTEED_ROUNDS?`⚠ OVERTIME Round ${round}.\n\n`:"";if(hist.length){p+="HISTORY:\n";hist.forEach(h=>{p+=`[${h.role}] ${h.action}: ${h.positions?sc.terms.map(t=>`${t.label}=${t.positions[h.positions[t.id]]}`).join(", "):""}\n  "${h.message}"\n`;});p+="\n";}return p+`Round ${round}. Your turn.`;}
function parseResp(text,sc){try{const jm=text.match(/```json\s*([\s\S]*?)\s*```/);let parsed;if(jm)parsed=JSON.parse(jm[1]);else{const bm=text.match(/\{[\s\S]*"action"[\s\S]*\}/);if(bm)parsed=JSON.parse(bm[0]);else return null;}const mm=text.match(/MESSAGE:\s*([\s\S]*?)$/m);const msg=mm?mm[1].trim():text.replace(/```json[\s\S]*?```/,"").replace(/\{[\s\S]*?\}/,"").trim().substring(0,400);const pos={};sc.terms.forEach(t=>{pos[t.id]=Math.max(0,Math.min(10,parseInt(parsed.positions?.[t.id]??5)));});return{action:parsed.action||"reject",positions:pos,message:msg||"Let me review..."};}catch(e){return null;}}
function calcScore(pos,weights,terms){let s=0,m=0;terms.forEach(t=>{const w=weights[t.id]||1;s+=w*(pos[t.id]??5);m+=w*10;});return{score:s,maxScore:m,pct:m>0?Math.round(s/m*100):0};}

export default function App(){
  const[phase,setPhase]=useState("select");
  const[sc,setSc]=useState(null);
  const[pos,setPos]=useState({});
  const[hist,setHist]=useState([]);
  const[round,setRound]=useState(1);
  const[lastAI,setLastAI]=useState(null);
  const[msg,setMsg]=useState("");
  const[loading,setLoading]=useState(false);
  const[result,setResult]=useState(null);
  const ref=useRef(null);
  useEffect(()=>{const l=document.createElement("link");l.href=FONT_URL;l.rel="stylesheet";document.head.appendChild(l);},[]);
  useEffect(()=>{ref.current?.scrollIntoView({behavior:"smooth"});},[hist]);
  const start=s=>{const init={};s.terms.forEach(t=>init[t.id]=3);setSc(s);setPos(init);setHist([]);setRound(1);setLastAI(null);setMsg("");setResult(null);setPhase("play");};
  const endGame=(deal,fp)=>{if(!deal){setResult({deal:false});}else{const us=calcScore(fp,sc.userWeights,sc.terms);const af={};sc.terms.forEach(t=>af[t.id]=10-fp[t.id]);const as=calcScore(af,sc.aiWeights,sc.terms);setResult({deal:true,positions:fp,userScore:us,aiScore:as});}setPhase("debrief");};
  const submit=async action=>{if(loading)return;setLoading(true);const nh=[...hist];const up={...pos};nh.push({role:sc.yourRole,action,positions:action==="propose"?up:action==="accept"&&lastAI?(()=>{const f={};sc.terms.forEach(t=>f[t.id]=10-lastAI[t.id]);return f;})():null,message:msg||(action==="propose"?"Here's my proposal.":action==="accept"?"I accept.":"I'd like to counter.")});if(action==="accept"&&lastAI){const f={};sc.terms.forEach(t=>f[t.id]=10-lastAI[t.id]);setHist(nh);setMsg("");setLoading(false);endGame(true,f);return;}const sys=buildSys(sc);const aiHist=nh.map(h=>({...h,positions:h.positions?(()=>{const f={};sc.terms.forEach(t=>{f[t.id]=h.role===sc.yourRole?10-(h.positions[t.id]??5):(h.positions[t.id]??5);});return f;})():null}));const tp=buildTurn(aiHist,round,sc);const aiText=await callAI(sys,tp);let ai=aiText?parseResp(aiText,sc):null;if(!ai){ai={action:"reject",positions:{},message:"I need to discuss this internally."};sc.terms.forEach(t=>ai.positions[t.id]=5);}if(ai.action==="accept"&&action==="propose"){nh.push({role:sc.theirRole,action:"accept",positions:null,message:ai.message});setHist(nh);setMsg("");setLoading(false);endGame(true,up);return;}const disp={};sc.terms.forEach(t=>disp[t.id]=10-(ai.positions[t.id]??5));nh.push({role:sc.theirRole,action:ai.action==="propose"?"propose":"reject",positions:ai.action==="propose"?disp:null,message:ai.message});setLastAI(ai.positions);setHist(nh);setMsg("");const nr=round+1;if(nr>MAX_ROUNDS||(nr>GUARANTEED_ROUNDS&&Math.random()<0.25)){setLoading(false);endGame(false,null);return;}setRound(nr);setLoading(false);};

  // ── SELECT ──
  if(phase==="select") return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:40}}>
      <div style={{maxWidth:880,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:64}}>
          <div style={{fontFamily:MONO,fontSize:11,letterSpacing:3,color:C.muted,marginBottom:20}}>STANFORD CODEX · HARVEY CHALLENGE</div>
          <h1 style={{fontFamily:SERIF,fontSize:52,fontWeight:700,color:C.text,margin:0,lineHeight:1.1}}>Contract Negotiation Arena</h1>
          <p style={{fontFamily:SANS,fontSize:16,color:C.muted,marginTop:20,maxWidth:460,margin:"20px auto 0",lineHeight:1.7}}>Negotiate real contract terms against AI counsel with hidden priorities. Every clause has a value. Find the asymmetry.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
          {SCENARIOS.map(s=>(
            <button key={s.id} onClick={()=>start(s)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"32px 24px",cursor:"pointer",textAlign:"left",transition:"all 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.boxShadow="0 4px 16px rgba(37,99,235,0.08)";e.currentTarget.style.transform="translateY(-2px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)";e.currentTarget.style.transform="translateY(0)";}}>
              <div style={{fontFamily:MONO,fontSize:10,color:C.accent,letterSpacing:2,marginBottom:14}}>{s.id==="saas"?"MSA":s.id==="sideletter"?"SIDE LETTER":"OFFER LETTER"}</div>
              <div style={{fontFamily:SERIF,fontSize:20,fontWeight:600,color:C.text,marginBottom:8}}>{s.title}</div>
              <div style={{fontFamily:SANS,fontSize:13,color:C.muted,lineHeight:1.6,marginBottom:16}}>{s.subtitle}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{s.terms.map(t=><span key={t.id} style={{fontFamily:MONO,fontSize:9,padding:"4px 8px",background:C.bgAlt,borderRadius:5,color:C.dim}}>{t.label}</span>)}</div>
            </button>))}
        </div>
        <div style={{textAlign:"center",marginTop:40,fontFamily:SANS,fontSize:12,color:C.dim}}>Built on Paradigm Optimization Arena · Powered by Claude</div>
      </div>
    </div>);

  if(!sc) return null;

  // ── DEBRIEF ──
  if(phase==="debrief"&&result){
    const ta=result.deal?sc.terms.map(t=>{const p=result.positions[t.id],uw=sc.userWeights[t.id],aw=sc.aiWeights[t.id];return{...t,p,uw,aw,dollarImpact:Math.round(sc.dollarBase*(uw/30)*(p-5)/5),youMore:uw>aw,won:p>=6,lost:p<=4};}):[];
    const leak=result.deal?ta.filter(t=>t.youMore&&t.lost).reduce((s,t)=>s+Math.abs(t.dollarImpact),0):0;
    const wins=result.deal?ta.filter(t=>!t.youMore&&t.won).length:0;
    const misses=result.deal?ta.filter(t=>t.youMore&&t.lost).length:0;
    return(
    <div style={{minHeight:"100vh",background:C.bg,padding:40,display:"flex",justifyContent:"center"}}>
      <div style={{maxWidth:740,width:"100%"}}>
        <div style={{fontFamily:MONO,fontSize:10,color:C.muted,letterSpacing:3,marginBottom:8}}>POST-DEAL FORENSICS</div>
        <div style={{fontFamily:SERIF,fontSize:32,fontWeight:700,color:C.text,marginBottom:4}}>{sc.title}</div>
        <div style={{fontFamily:SANS,fontSize:14,color:C.muted,marginBottom:32}}>{sc.yourRole} vs {sc.theirRole} · {round} rounds</div>
        <div style={{display:"flex",gap:16,marginBottom:28}}>
          {[{label:"YOUR SCORE",val:result.deal?`${result.userScore.pct}%`:"-50%",color:result.deal?(result.userScore.pct>=60?C.green:result.userScore.pct>=40?C.amber:C.red):C.red},
            {label:"COUNTERPARTY",val:result.deal?`${result.aiScore.pct}%`:"-50%",color:result.deal?C.muted:C.red},
            {label:"VALUE LEAKED",val:result.deal?(leak>0?`$${(leak/1000).toFixed(0)}K`:"$0"):"-",color:leak>0?C.red:C.green}
          ].map((s,i)=>(
            <div key={i} style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"24px 20px",textAlign:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
              <div style={{fontFamily:MONO,fontSize:9,color:C.dim,letterSpacing:1,marginBottom:8}}>{s.label}</div>
              <div style={{fontFamily:SERIF,fontSize:44,fontWeight:700,color:s.color}}>{s.val}</div>
            </div>))}
        </div>
        {result.deal&&<div style={{background:result.userScore.pct>=60?C.greenSoft:result.userScore.pct>=40?C.amberSoft:C.redSoft,border:`1px solid ${result.userScore.pct>=60?C.green+"30":result.userScore.pct>=40?C.amber+"30":C.red+"30"}`,borderRadius:10,padding:"14px 20px",marginBottom:28}}>
          <div style={{fontFamily:SANS,fontSize:15,fontWeight:600,color:C.text}}>{result.userScore.pct>=70?"Excellent — you found the asymmetries.":result.userScore.pct>=55?"Solid deal. Room for improvement.":result.userScore.pct>=40?"Below average — conceded too much on priorities.":"Poor — gave away high-priority terms."}</div>
          <div style={{fontFamily:SANS,fontSize:12,color:C.muted,marginTop:4}}>{wins} smart trades · {misses} missed opportunities</div>
        </div>}
        {result.deal&&<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",marginBottom:28,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`}}><span style={{fontFamily:MONO,fontSize:10,color:C.muted,letterSpacing:2}}>TERM-BY-TERM ANALYSIS</span></div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
              {["CLAUSE","RESULT","YOU","THEM",""].map((h,i)=><th key={i} style={{textAlign:i===0?"left":i===4?"right":"center",padding:"10px 20px",fontFamily:MONO,fontSize:9,color:C.dim,fontWeight:500,letterSpacing:1}}>{h}</th>)}
            </tr></thead>
            <tbody>{ta.map(t=><tr key={t.id} style={{borderBottom:`1px solid ${C.borderLight}`}}>
              <td style={{padding:"14px 20px",fontFamily:SANS,fontSize:13,fontWeight:500,color:C.text}}>{t.label}</td>
              <td style={{textAlign:"center",padding:"14px 12px"}}><span style={{fontFamily:MONO,fontSize:13,fontWeight:700,color:t.won?C.green:t.lost?C.red:C.amber}}>{t.positions[t.p]}</span></td>
              <td style={{textAlign:"center"}}><span style={{fontFamily:MONO,fontSize:10,padding:"3px 8px",borderRadius:4,background:t.uw>6?C.greenSoft:t.uw>3?C.amberSoft:C.bgAlt,color:t.uw>6?C.green:t.uw>3?C.amber:C.dim}}>{t.uw>6?"HIGH":t.uw>3?"MED":"LOW"}</span></td>
              <td style={{textAlign:"center"}}><span style={{fontFamily:MONO,fontSize:10,padding:"3px 8px",borderRadius:4,background:t.aw>6?C.redSoft:t.aw>3?C.amberSoft:C.bgAlt,color:t.aw>6?C.red:t.aw>3?C.amber:C.dim}}>{t.aw>6?"HIGH":t.aw>3?"MED":"LOW"}</span></td>
              <td style={{padding:"14px 20px",textAlign:"right",fontFamily:SANS,fontSize:12,color:t.youMore&&t.won?C.green:t.youMore&&t.lost?C.red:!t.youMore&&t.won?C.green:C.muted}}>{t.youMore&&t.won?"✓ Won priority":t.youMore&&t.lost?"✗ Left value":!t.youMore&&t.won?"✓ Smart capture":"→ Good concession"}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        {result.deal&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:36}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontFamily:MONO,fontSize:9,color:C.accent,letterSpacing:2,marginBottom:10}}>OPTIMAL STRATEGY</div>
            <div style={{fontFamily:SANS,fontSize:13,color:C.textSoft,lineHeight:1.65}}>{(()=>{const best=sc.terms.reduce((a,b)=>(sc.userWeights[b.id]-sc.aiWeights[b.id])>(sc.userWeights[a.id]-sc.aiWeights[a.id])?b:a);const worst=sc.terms.reduce((a,b)=>(sc.aiWeights[b.id]-sc.userWeights[b.id])>(sc.aiWeights[a.id]-sc.userWeights[a.id])?b:a);return`Your edge was "${best.label}" (you: ${sc.userWeights[best.id]}/10, them: ${sc.aiWeights[best.id]}/10). Push there, concede on "${worst.label}" (them: ${sc.aiWeights[worst.id]}/10, you: ${sc.userWeights[worst.id]}/10).`;})()}</div>
          </div>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            <div style={{fontFamily:MONO,fontSize:9,color:C.amber,letterSpacing:2,marginBottom:10}}>DEBRIEF</div>
            <div style={{fontFamily:SANS,fontSize:13,color:C.textSoft,lineHeight:1.65}}>{(()=>{if(ta.filter(t=>t.p>=7).length>=3)return"Very aggressive across most terms — risks deadlock. Use selective concessions to unlock trades.";if(ta.filter(t=>t.p<=4).length>=3)return"Conceded too broadly. Open stronger next time — you can come down, never go back up.";if(wins>=2)return"Strong. You identified asymmetries — conceding where they cared, pushing where they didn't.";return"Mixed. Rank priorities before negotiating. Decide in advance where to concede.";})()}</div>
          </div>
        </div>}
        <div style={{display:"flex",gap:12,justifyContent:"center"}}>
          <button onClick={()=>start(sc)} style={{fontFamily:SANS,fontSize:14,fontWeight:600,padding:"12px 28px",borderRadius:8,border:`1px solid ${C.accent}`,background:"transparent",color:C.accent,cursor:"pointer"}}>Try Again</button>
          <button onClick={()=>{setPhase("select");setSc(null);}} style={{fontFamily:SANS,fontSize:14,fontWeight:600,padding:"12px 28px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer"}}>New Scenario</button>
        </div>
      </div>
    </div>);}

  // ── PLAY ──
  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex"}}>
      <div style={{width:280,borderRight:`1px solid ${C.border}`,padding:"24px 20px",display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto",background:C.surface}}>
        <div style={{fontFamily:MONO,fontSize:10,color:C.accent,letterSpacing:2,marginBottom:6}}>{sc.title.toUpperCase()}</div>
        <div style={{fontFamily:SERIF,fontSize:18,fontWeight:600,color:C.text,marginBottom:3}}>You: {sc.yourRole}</div>
        <div style={{fontFamily:SANS,fontSize:12,color:C.muted,marginBottom:20}}>vs {sc.theirRole}</div>
        <div style={{background:C.bgAlt,borderRadius:8,padding:14,border:`1px solid ${C.borderLight}`,marginBottom:16}}>
          <div style={{fontFamily:MONO,fontSize:9,color:C.muted,letterSpacing:1,marginBottom:10}}>ROUND {round} {round>GUARANTEED_ROUNDS?"· OVERTIME":`of ${GUARANTEED_ROUNDS}+`}</div>
          <div style={{fontFamily:MONO,fontSize:9,color:C.muted,letterSpacing:1,marginBottom:10}}>YOUR PRIORITIES</div>
          {sc.terms.map(t=>{const w=sc.userWeights[t.id];return(<div key={t.id} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{fontFamily:SANS,fontSize:11,color:C.textSoft}}>{t.label}</span>
              <span style={{fontFamily:MONO,fontSize:10,fontWeight:600,color:w>6?C.green:w>3?C.amber:C.dim}}>{w>6?"HIGH":w>3?"MED":"LOW"}</span>
            </div>
            <div style={{height:3,background:C.border,borderRadius:2}}><div style={{height:"100%",width:`${w*10}%`,background:w>6?C.green:w>3?C.amber:C.dim,borderRadius:2}}/></div>
          </div>);})}
        </div>
        <div style={{background:C.bgAlt,borderRadius:8,padding:14,border:`1px solid ${C.borderLight}`,marginBottom:16}}>
          <div style={{fontFamily:MONO,fontSize:9,color:C.amber,letterSpacing:2,marginBottom:10}}>MARKET DATA</div>
          {sc.terms.map(t=>{const p=pos[t.id]??3;const b=sc.benchmarks[t.id];const inR=p>=b.market[0]&&p<=b.market[1];const above=p>b.market[1];return(<div key={t.id} style={{marginBottom:8}}>
            <div style={{fontFamily:SANS,fontSize:10,fontWeight:500,color:C.textSoft}}>{t.label}</div>
            <div style={{fontFamily:SANS,fontSize:10,color:C.muted}}>Standard: {t.positions[b.market[0]]} – {t.positions[b.market[1]]}</div>
            <div style={{fontFamily:SANS,fontSize:10,color:above?C.green:inR?C.amber:C.red}}>Your ask: <b>{t.positions[p]}</b>{above?" · aggressive":inR?" · in range":" · below market"}</div>
          </div>);})}
        </div>
        <div style={{background:C.bgAlt,borderRadius:8,padding:14,border:`1px solid ${C.borderLight}`,marginBottom:16}}>
          <div style={{fontFamily:MONO,fontSize:9,color:C.accent,letterSpacing:2,marginBottom:10}}>COUNTERPARTY INTEL</div>
          {hist.length===0?<div style={{fontFamily:SANS,fontSize:10,color:C.dim,fontStyle:"italic"}}>Propose first to see how they respond.</div>
          :(()=>{const aiM=hist.filter(h=>h.role===sc.theirRole&&h.positions);if(!aiM.length)return<div style={{fontFamily:SANS,fontSize:10,color:C.dim,fontStyle:"italic"}}>Waiting...</div>;
            return sc.terms.map(t=>{const lp=aiM[aiM.length-1]?.positions?.[t.id];if(lp===undefined)return null;const sig=lp<=3?"hard":lp<=5?"mid":"soft";return(<div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
              <span style={{fontFamily:SANS,fontSize:10,color:C.textSoft}}>{t.label}</span>
              <span style={{fontFamily:MONO,fontSize:9,fontWeight:600,color:sig==="hard"?C.red:sig==="soft"?C.green:C.amber}}>{sig==="hard"?"FIRM":sig==="soft"?"FLEX":"MID"}</span>
            </div>);});})()}
        </div>
        <div style={{marginTop:"auto",padding:12,background:C.bgAlt,borderRadius:8,border:`1px solid ${C.borderLight}`}}>
          <div style={{fontFamily:SANS,fontSize:11,color:C.muted,lineHeight:1.5}}>Concede LOW priorities to win HIGH ones. Find the asymmetry.</div>
        </div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column"}}>
        <div style={{flex:1,padding:"24px 32px",overflowY:"auto"}}>
          <div style={{borderLeft:`3px solid ${C.amber}`,background:C.amberSoft+"80",padding:"12px 16px",borderRadius:"0 8px 8px 0",marginBottom:20,maxWidth:640}}>
            <div style={{fontFamily:MONO,fontSize:8,color:C.amber,letterSpacing:2,marginBottom:4}}>ASSIGNMENT</div>
            <div style={{fontFamily:SANS,fontSize:12,color:C.textSoft,lineHeight:1.6}}>{sc.brief}</div>
          </div>
          <div style={{background:"#fffef9",border:`1px solid ${C.borderDark}`,borderRadius:2,padding:"36px 40px",marginBottom:24,maxWidth:640,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <div style={{fontFamily:SERIF,fontSize:14,fontWeight:700,color:C.text,textAlign:"center",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>{sc.contractTitle}</div>
            <div style={{fontFamily:SERIF,fontSize:10,color:C.muted,textAlign:"center",marginBottom:24}}>{sc.contractParties}</div>
            <div style={{borderTop:"1px solid #ddd",marginBottom:20}}/>
            {sc.terms.map(t=>{const p=pos[t.id]??3;const val=t.positions[p];return(<div key={t.id} style={{marginBottom:16}}>
              <div style={{fontFamily:SERIF,fontSize:12.5,color:"#2a2a2a",lineHeight:1.8}}>
                {t.clause(val).split(val).map((part,i,arr)=>i<arr.length-1?<span key={i}>{part}<span style={{background:"#dbeafe",color:"#1e40af",padding:"2px 6px",borderRadius:3,fontWeight:700}}>{val}</span></span>:<span key={i}>{part}</span>)}
              </div>
            </div>);})}
            <div style={{borderTop:"1px solid #e5e5e5",paddingTop:10,marginTop:8}}>
              <div style={{fontFamily:SERIF,fontSize:9,color:"#aaa",fontStyle:"italic"}}>Working Draft — highlighted values under negotiation</div>
            </div>
          </div>
          {hist.map((h,i)=>{const isU=h.role===sc.yourRole;return(
            <div key={i} style={{display:"flex",justifyContent:isU?"flex-end":"flex-start",marginBottom:14,maxWidth:640}}>
              <div style={{maxWidth:480,padding:"14px 18px",background:isU?C.accentSoft:C.surface,border:`1px solid ${isU?C.accent+"25":C.border}`,borderRadius:isU?"16px 16px 4px 16px":"16px 16px 16px 4px",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                  <span style={{fontFamily:SANS,fontSize:12,fontWeight:600,color:isU?C.accent:C.amber}}>{h.role}</span>
                  <span style={{fontFamily:MONO,fontSize:9,padding:"2px 7px",borderRadius:4,background:h.action==="propose"?C.accentSoft:h.action==="accept"?C.greenSoft:C.redSoft,color:h.action==="propose"?C.accent:h.action==="accept"?C.green:C.red}}>{h.action.toUpperCase()}</span>
                </div>
                {h.positions&&<div style={{background:C.bgAlt,borderRadius:8,padding:10,marginBottom:10,border:`1px solid ${C.borderLight}`}}>
                  {sc.terms.map(t=>{const p=h.positions[t.id];if(p===undefined)return null;return(<div key={t.id} style={{display:"flex",justifyContent:"space-between",marginBottom:3,fontFamily:MONO,fontSize:11}}>
                    <span style={{color:C.muted}}>{t.label}</span>
                    <span style={{color:C.text,fontWeight:600}}>{t.positions[p]}</span>
                  </div>);})}
                </div>}
                <div style={{fontFamily:SANS,fontSize:13,color:C.textSoft,lineHeight:1.6}}>{h.message}</div>
              </div>
            </div>);})}
          {loading&&<div style={{maxWidth:640,marginBottom:14}}><div style={{display:"inline-block",padding:"14px 18px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:"16px 16px 16px 4px"}}><span style={{fontFamily:SANS,fontSize:13,color:C.muted}}>{sc.theirRole} is reviewing...</span></div></div>}
          <div ref={ref}/>
        </div>
        <div style={{borderTop:`1px solid ${C.border}`,padding:"16px 32px",background:C.surface}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 24px",marginBottom:12}}>
            {sc.terms.map(t=>{const p=pos[t.id]??3;return(<div key={t.id}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontFamily:SANS,fontSize:12,fontWeight:500,color:C.text}}>{t.label}</span>
                <span style={{fontFamily:MONO,fontSize:12,fontWeight:700,color:p>=7?C.green:p<=3?C.red:C.amber}}>{t.positions[p]}</span>
              </div>
              <input type="range" min={0} max={10} value={p} onChange={e=>setPos(prev=>({...prev,[t.id]:parseInt(e.target.value)}))} style={{width:"100%",accentColor:C.accent,height:4}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontFamily:MONO,fontSize:8,color:C.dim}}><span>{t.positions[0]}</span><span>{t.positions[10]}</span></div>
            </div>);})}
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <input type="text" placeholder="Add a message..." value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!loading&&submit("propose")}
              style={{flex:1,padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,background:C.bg,color:C.text,fontFamily:SANS,fontSize:12,boxSizing:"border-box",outline:"none"}}/>
            <button onClick={()=>submit("propose")} disabled={loading} style={{padding:"10px 24px",borderRadius:8,border:"none",background:loading?C.dim:C.accent,color:"#fff",fontFamily:SANS,fontSize:13,fontWeight:600,cursor:loading?"not-allowed":"pointer"}}>Propose</button>
            {lastAI&&<button onClick={()=>submit("accept")} disabled={loading} style={{padding:"10px 20px",borderRadius:8,border:`1px solid ${C.green}`,background:"transparent",color:C.green,fontFamily:SANS,fontSize:13,fontWeight:600,cursor:loading?"not-allowed":"pointer"}}>Accept</button>}
            {hist.length>0&&<button onClick={()=>submit("reject")} disabled={loading} style={{padding:"10px 16px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,fontFamily:SANS,fontSize:13,fontWeight:600,cursor:loading?"not-allowed":"pointer"}}>Reject</button>}
          </div>
        </div>
      </div>
    </div>);
}
