"use client";

import { useEffect, useState } from "react";

type Row = {
  id:string; authority_name:string; region_code:string; region_name:string; service_type:string;
  vehicle_category?:string|null; fixed_fare?:number|null; rate_per_km?:number|null;
  distance_min_km?:number|null; distance_max_km?:number|null; status:string;
  source_document_title?:string|null; source_reference?:string|null; source_document_url?:string|null;
  notes?:string|null; effective_from?:string|null; effective_to?:string|null;
};

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||"";
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||"";

export default function AuthorityFareReview(){
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [token,setToken]=useState(""); const [rows,setRows]=useState<Row[]>([]);
  const [status,setStatus]=useState("submitted"); const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{const t=localStorage.getItem("ethio_reviewer_token")||"";if(t){setToken(t);load(t,status)}},[]);

  async function login(){
    setBusy(true);setMessage("");
    try{
      const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"Content-Type":"application/json",apikey:SUPABASE_KEY},body:JSON.stringify({email,password})});
      const d=await r.json();if(!r.ok)throw new Error(d.error_description||"Sign-in failed.");
      const t=String(d.access_token||"");const u=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+t}}).then(x=>x.json());
      if(!["reviewer","admin"].includes(u?.app_metadata?.role))throw new Error("This account is not a reviewer.");
      localStorage.setItem("ethio_reviewer_token",t);setToken(t);await load(t,status);
    }catch(e:any){setMessage(e?.message||"Sign-in failed.");}finally{setBusy(false)}
  }

  async function load(t=token,s=status){
    if(!t)return;setBusy(true);
    try{const r=await fetch("/api/admin/authority-fares?status="+encodeURIComponent(s),{headers:{Authorization:"Bearer "+t},cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load.");setRows(d.submissions||[])}
    catch(e:any){setMessage(e?.message||"Could not load submissions.")}finally{setBusy(false)}
  }

  async function move(id:string,next:string){
    setBusy(true);setMessage("");
    try{const r=await fetch("/api/admin/authority-fares",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({id,status:next})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Update failed.");await load()}
    catch(e:any){setMessage(e?.message||"Update failed.")}finally{setBusy(false)}
  }

  if(!token)return <main style={shell}><section style={loginCard}><b style={{color:"#087443"}}>ETHIO TRANSPORT • REVIEW</b><h1>የታሪፍ ግምገማ</h1><p>የባለሥልጣን የላኩትን የታሪፍ መረጃ ይመርምሩ።</p><input placeholder="Reviewer email" value={email} onChange={e=>setEmail(e.target.value)} style={input}/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={input}/><button onClick={login} disabled={busy} style={button}>{busy?"Signing in…":"Sign in"}</button>{message&&<p>{message}</p>}</section></main>;

  return <main style={shell}><section style={{maxWidth:1100,margin:"0 auto"}}>
    <div style={bar}><div><b style={{color:"#087443"}}>ETHIO TRANSPORT • OFFICIAL TARIFF REVIEW</b><h1>Authority tariff queue</h1></div><button onClick={()=>{localStorage.removeItem("ethio_reviewer_token");setToken("")}} style={outline}>Sign out</button></div>
    <div style={{display:"flex",gap:8,margin:"16px 0",flexWrap:"wrap"}}>{["submitted","reviewing","approved","rejected","published","expired"].map(s=><button key={s} onClick={()=>{setStatus(s);load(token,s)}} style={status===s?button:outline}>{s}</button>)}</div>
    {message&&<div style={notice}>{message}</div>}
    <div style={{display:"grid",gap:12}}>{rows.map(r=><article key={r.id} style={card}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12}}><div><strong>{r.authority_name}</strong><div>{r.region_name} ({r.region_code}) • {r.service_type} • {r.vehicle_category||"—"}</div></div><b>{r.status}</b></div>
      <p>{r.fixed_fare!=null?r.fixed_fare+" ETB fixed":r.rate_per_km!=null?r.rate_per_km+" ETB/km":"No rate"} • {r.distance_min_km??0}–{r.distance_max_km??"∞"} km</p>
      <p style={{color:"#586a61"}}>{r.source_document_title||"No document title"} {r.source_reference?"• "+r.source_reference:""}</p>
      {r.source_document_url&&<a href={r.source_document_url} target="_blank" rel="noreferrer">Open official document ↗</a>}
      {r.notes&&<p>{r.notes}</p>}
      <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
        {r.status==="submitted"&&<button style={button} onClick={()=>move(r.id,"reviewing")}>Start review</button>}
        {r.status==="reviewing"&&<><button style={button} onClick={()=>move(r.id,"approved")}>Approve</button><button style={danger} onClick={()=>move(r.id,"rejected")}>Reject</button></>}
        {r.status==="approved"&&<button style={button} onClick={()=>move(r.id,"published")}>Publish to public app</button>}
        {r.status==="published"&&<button style={outline} onClick={()=>move(r.id,"expired")}>Expire</button>}
      </div>
    </article>)}</div>
  </section></main>;
}

const shell={minHeight:"100vh",padding:20,background:"#f3f7f4",fontFamily:"system-ui"} as const;
const loginCard={maxWidth:520,margin:"60px auto",background:"#fff",padding:28,borderRadius:20} as const;
const bar={display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",background:"#fff",padding:18,borderRadius:18} as const;
const card={background:"#fff",padding:18,borderRadius:16,border:"1px solid #dbe6df"} as const;
const input={width:"100%",padding:11,margin:"6px 0",border:"1px solid #cddbd3",borderRadius:10,boxSizing:"border-box"} as const;
const button={background:"#087443",color:"#fff",border:0,borderRadius:10,padding:"10px 14px",fontWeight:800} as const;
const outline={background:"#fff",border:"1px solid #9fb2a7",borderRadius:10,padding:"10px 14px",fontWeight:700} as const;
const danger={background:"#9a2f1f",color:"#fff",border:0,borderRadius:10,padding:"10px 14px",fontWeight:800} as const;
const notice={background:"#eef8f1",padding:12,borderRadius:10,marginBottom:12} as const;
