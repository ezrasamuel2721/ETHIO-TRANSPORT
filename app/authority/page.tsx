"use client";

import { FormEvent, useEffect, useState, type CSSProperties } from "react";

type Submission = {
  id:string; service_type:string; vehicle_category?:string|null; rate_per_km?:number|null; fixed_fare?:number|null;
  distance_min_km?:number|null; distance_max_km?:number|null; status:string; source_document_title?:string|null;
  source_reference?:string|null; rejection_reason?:string|null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

const input:CSSProperties={width:"100%",padding:"11px 12px",border:"1px solid #cddbd3",borderRadius:10,marginTop:5,boxSizing:"border-box"};
const button:CSSProperties={background:"#087443",color:"#fff",border:0,borderRadius:10,padding:"12px 18px",fontWeight:800,cursor:"pointer"};
const outline:CSSProperties={background:"#fff",border:"1px solid #9fb2a7",borderRadius:10,padding:"10px 14px",fontWeight:700};

export default function AuthorityPortal(){
  const [token,setToken]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [loggedIn,setLoggedIn]=useState(false);
  const [authority,setAuthority]=useState<any>(null);
  const [submissions,setSubmissions]=useState<Submission[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [form,setForm]=useState({
    serviceType:"bus",vehicleCategory:"",fareScope:"regional",cityName:"",areaName:"",
    fixedFare:"",ratePerKm:"",baseFare:"",minimumFare:"",distanceMinKm:"",distanceMaxKm:"",
    passengerType:"",sourceDocumentTitle:"",sourceDocumentUrl:"",sourceReference:"",
    effectiveFrom:"",effectiveTo:"",notes:""
  });

  useEffect(()=>{
    const saved=window.localStorage.getItem("ethio_authority_token")||"";
    if(saved){setToken(saved);load(saved);}
  },[]);

  async function load(accessToken=token){
    if(!accessToken)return;
    const r=await fetch("/api/authority/fare-submissions",{headers:{Authorization:"Bearer "+accessToken},cache:"no-store"});
    if(!r.ok){window.localStorage.removeItem("ethio_authority_token");setToken("");setLoggedIn(false);return;}
    const d=await r.json(); setAuthority(d.authority); setSubmissions(d.submissions||[]); setLoggedIn(true);
  }

  async function login(e:FormEvent){
    e.preventDefault(); setBusy(true); setMessage("");
    try{
      if(!SUPABASE_URL||!SUPABASE_KEY) throw new Error("Authority sign-in is not configured yet.");
      const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{
        method:"POST",headers:{"Content-Type":"application/json",apikey:SUPABASE_KEY},
        body:JSON.stringify({email,password})
      });
      const d=await r.json();
      if(!r.ok)throw new Error(d.error_description||d.msg||"Sign-in failed.");
      const accessToken=String(d.access_token||"");
      if(!accessToken)throw new Error("No access token returned.");
      const user=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+accessToken}});
      const u=await user.json();
      if(u?.app_metadata?.role!=="authority")throw new Error("This account is not registered as a transport authority.");
      if(!u?.app_metadata?.region_code)throw new Error("This authority account has no assigned region code.");
      window.localStorage.setItem("ethio_authority_token",accessToken);setToken(accessToken);
      await load(accessToken);
    }catch(err:any){setMessage(err?.message||"Sign-in failed.");}
    finally{setBusy(false);}
  }

  async function submit(e:FormEvent){
    e.preventDefault();setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/authority/fare-submissions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify(form)});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Submission failed.");
      setMessage("Submitted. The tariff will be public only after official review and publication.");
      setForm({...form,fixedFare:"",ratePerKm:"",baseFare:"",minimumFare:"",distanceMinKm:"",distanceMaxKm:"",notes:""});
      await load();
    }catch(err:any){setMessage(err?.message||"Submission failed.");}
    finally{setBusy(false);}
  }

  function logout(){window.localStorage.removeItem("ethio_authority_token");setToken("");setLoggedIn(false);setAuthority(null);}

  if(!loggedIn)return <main style={{minHeight:"100vh",padding:24,background:"#f3f7f4",fontFamily:"system-ui"}}>
    <section style={{maxWidth:520,margin:"60px auto",background:"#fff",padding:28,borderRadius:22,boxShadow:"0 10px 40px rgba(0,0,0,.08)"}}>
      <div style={{fontSize:12,fontWeight:800,letterSpacing:1,color:"#087443"}}>ETHIO TRANSPORT • AUTHORITY PORTAL</div>
      <h1 style={{margin:"8px 0"}}>የባለሥልጣን የታሪፍ መላኪያ</h1>
      <p style={{color:"#4b5d55"}}>የተቋሙን የአሁኑ ታሪፍ ያስገቡ። ከግምገማ በኋላ በETHIO TRANSPORT ላይ ይታያል።</p>
      <form onSubmit={login} style={{display:"grid",gap:12}}>
        <input required type="email" placeholder="Official authority email" value={email} onChange={e=>setEmail(e.target.value)} style={input}/>
        <input required type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={input}/>
        <button disabled={busy} style={button}>{busy?"Signing in…":"Sign in"}</button>
      </form>
      {message&&<p style={{marginTop:14,color:"#9a2f1f"}}>{message}</p>}
    </section>
  </main>;

  return <main style={{minHeight:"100vh",padding:20,background:"#f3f7f4",fontFamily:"system-ui"}}>
    <section style={{maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",background:"#fff",padding:18,borderRadius:18}}>
        <div><div style={{fontSize:12,fontWeight:800,color:"#087443"}}>ETHIO TRANSPORT • VERIFIED AUTHORITY</div><h1 style={{margin:"5px 0"}}>{authority?.name||"Authority"}</h1><div style={{color:"#63756c"}}>{authority?.regionName} • {authority?.regionCode}</div></div>
        <button onClick={logout} style={outline}>Sign out</button>
      </div>

      <section style={{background:"#fff",marginTop:16,padding:20,borderRadius:18}}>
        <h2>Submit current tariff</h2>
        <p style={{color:"#63756c"}}>Only this authority's assigned region can be submitted from this account. A reviewer must publish it before users can see it.</p>
        <form onSubmit={submit} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
          <label>Service<select value={form.serviceType} onChange={e=>setForm({...form,serviceType:e.target.value})} style={input}><option value="bus">Bus</option><option value="taxi">Taxi</option><option value="rail">Rail</option><option value="other">Other</option></select></label>
          <label>Vehicle category<input value={form.vehicleCategory} onChange={e=>setForm({...form,vehicleCategory:e.target.value})} style={input}/></label>
          <label>Fare scope<select value={form.fareScope} onChange={e=>setForm({...form,fareScope:e.target.value})} style={input}><option value="regional">Regional</option><option value="city">City</option><option value="area">Area</option><option value="route">Route</option><option value="national">National</option></select></label>
          <label>City<input value={form.cityName} onChange={e=>setForm({...form,cityName:e.target.value})} style={input}/></label>
          <label>Area<input value={form.areaName} onChange={e=>setForm({...form,areaName:e.target.value})} style={input}/></label>
          <label>Fixed fare (ETB)<input type="number" min="0" step="0.01" value={form.fixedFare} onChange={e=>setForm({...form,fixedFare:e.target.value})} style={input}/></label>
          <label>Rate / km (ETB)<input type="number" min="0" step="0.01" value={form.ratePerKm} onChange={e=>setForm({...form,ratePerKm:e.target.value})} style={input}/></label>
          <label>Base fare (ETB)<input type="number" min="0" step="0.01" value={form.baseFare} onChange={e=>setForm({...form,baseFare:e.target.value})} style={input}/></label>
          <label>Minimum fare (ETB)<input type="number" min="0" step="0.01" value={form.minimumFare} onChange={e=>setForm({...form,minimumFare:e.target.value})} style={input}/></label>
          <label>Distance from (km)<input type="number" min="0" step="0.01" value={form.distanceMinKm} onChange={e=>setForm({...form,distanceMinKm:e.target.value})} style={input}/></label>
          <label>Distance to (km)<input type="number" min="0" step="0.01" value={form.distanceMaxKm} onChange={e=>setForm({...form,distanceMaxKm:e.target.value})} style={input}/></label>
          <label>Passenger type<input value={form.passengerType} onChange={e=>setForm({...form,passengerType:e.target.value})} style={input}/></label>
          <label>Effective from<input type="datetime-local" value={form.effectiveFrom} onChange={e=>setForm({...form,effectiveFrom:e.target.value})} style={input}/></label>
          <label>Effective to<input type="datetime-local" value={form.effectiveTo} onChange={e=>setForm({...form,effectiveTo:e.target.value})} style={input}/></label>
          <label style={{gridColumn:"1/-1"}}>Official decision / document title<input value={form.sourceDocumentTitle} onChange={e=>setForm({...form,sourceDocumentTitle:e.target.value})} style={input}/></label>
          <label>Official document URL<input type="url" value={form.sourceDocumentUrl} onChange={e=>setForm({...form,sourceDocumentUrl:e.target.value})} style={input}/></label>
          <label>Decision / reference number<input value={form.sourceReference} onChange={e=>setForm({...form,sourceReference:e.target.value})} style={input}/></label>
          <label style={{gridColumn:"1/-1"}}>Notes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={{...input,minHeight:90}}/></label>
          <div style={{gridColumn:"1/-1"}}><button disabled={busy} style={button}>{busy?"Sending…":"Send tariff for official review"}</button></div>
        </form>
        {message&&<div style={{marginTop:14,padding:12,borderRadius:12,background:"#eef8f1"}}>{message}</div>}
      </section>

      <section style={{background:"#fff",marginTop:16,padding:20,borderRadius:18}}>
        <h2>Submission history</h2>
        <div style={{display:"grid",gap:10}}>{submissions.map(s=><article key={s.id} style={{border:"1px solid #dbe6df",borderRadius:14,padding:14}}>
          <strong>{s.service_type} • {s.vehicle_category||"—"} • {s.status}</strong>
          <div style={{color:"#63756c",marginTop:5}}>{s.fixed_fare!=null?s.fixed_fare+" ETB fixed":s.rate_per_km!=null?s.rate_per_km+" ETB/km":"—"} • {s.distance_min_km??0}–{s.distance_max_km??"∞"} km</div>
          <small>{s.source_document_title||"No document title"} {s.source_reference?"• "+s.source_reference:""}</small>
          {s.rejection_reason&&<div style={{color:"#9a2f1f",marginTop:5}}>Rejected: {s.rejection_reason}</div>}
        </article>)}</div>
      </section>
    </section>
  </main>;
}
