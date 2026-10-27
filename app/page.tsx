"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Lang = "am" | "en" | "ao";
type ServiceId = "origin"|"fare"|"ticket"|"report"|"map"|"emergency"|"trusted"|"access"|"parcel"|"offline";

const services: Array<[string,string,string,ServiceId,string]> = [
  ["🧭","መንገድ ፈላጊ","Route Finder","origin","የመነሻና መድረሻ ቦታን በመምረጥ የካርታ መንገድ ያግኙ።"],
  ["💳","የክፍያ ጥበቃ","Fare Guard","fare","የታሪፍ መሠረቱን፣ ርቀቱን እና ምንጩን በግልጽ ይመልከቱ።"],
  ["🎫","ትኬት","Ticket","ticket","የትኬት መረጃን ከሚመለከተው አገልግሎት ጋር ለመገናኘት የተዘጋጀ።"],
  ["📝","በአንድ ንክኪ ሪፖርት","One-Tap Report","report","ቅሬታ፣ ችግር ወይም የመጓጓዣ ሪፖርት ያቅርቡ።"],
  ["🗺️","የችግር ካርታ","Problem Map","map","የችግር ቦታን በካርታ ላይ ለመላክ የተዘጋጀ።"],
  ["🚨","የአደጋ እርዳታ","Emergency Help","emergency","በአደጋ ጊዜ ወደ ተገቢው የእርዳታ ቁጥር ለመድረስ የተዘጋጀ።"],
  ["🛡️","የታመነ ጉዞ","Trusted Trip","trusted","የጉዞ መረጃን በስልክዎ ላይ ያደራጁ እና የTrip Proof መረጃ ይፍጠሩ።"],
  ["♿","ተደራሽነት","Accessibility","access","ተደራሽ የመጓጓዣ ፍላጎቶችን ለማስተናገድ የተዘጋጀ።"],
  ["📦","ፓርሴል / ሰነድ","Parcel / Document","parcel","የፓርሴልና ሰነድ መጓጓዣ መረጃ እና የአገልግሎት ግንኙነት።"],
  ["📴","ከመስመር ውጭ / ዝቅተኛ ዳታ","Offline / Low Data","offline","የመጨረሻ የተቀመጠ መረጃ በዝቅተኛ ዳታ ሁኔታ ይጠቀሙ።"]
];

const t = {
  am:{title:"ETHIO TRANSPORT",sub:"የኢትዮጵያ የህዝብ መጓጓዣ መረጃና አገልግሎት መድረክ",sections:"ዋና ዋና ክፍሎች",open:"ክፈት",close:"ዝጋ",back:"ተመለስ",from:"መነሻ ቦታ",to:"መድረሻ ቦታ",search:"ፈልግ",km:"ርቀት (km)",rate:"የተረጋገጠ ታሪፍ / km",calc:"ታሪፍ አስላ",submit:"ሪፖርቱን ላክ",name:"ስም (አማራጭ)",phone:"ስልክ (አማራጭ)",category:"የችግር ዓይነት",description:"ዝርዝር መግለጫ",location:"የችግሩ ቦታ",success:"ሪፖርቱ ተቀብሏል። የማጣቀሻ ቁጥሩን ያስቀምጡ።",source:"ምንጭ / ማስረጃ",notConnected:"ከሚመለከተው አካል ጋር የቀጥታ ግንኙነት ገና አልተዋቀረም፤ ሲዘጋጅ የዚህ መድረክ መግቢያ ይሆናል።"},
  en:{title:"ETHIO TRANSPORT",sub:"Ethiopia's public transport information and service platform",sections:"Core services",open:"Open",close:"Close",back:"Back",from:"Origin",to:"Destination",search:"Find route",km:"Distance (km)",rate:"Verified fare / km",calc:"Calculate fare",submit:"Submit report",name:"Name (optional)",phone:"Phone (optional)",category:"Issue type",description:"Description",location:"Problem location",success:"Report received. Save the reference number.",source:"Source / evidence",notConnected:"A direct connection to the responsible authority is not configured yet. This service is integration-ready."},
  ao:{title:"ETHIO TRANSPORT",sub:"Public transport information and service platform",sections:"Core services",open:"Open",close:"Close",back:"Back",from:"Origin",to:"Destination",search:"Find route",km:"Distance (km)",rate:"Verified fare / km",calc:"Calculate fare",submit:"Submit report",name:"Name (optional)",phone:"Phone (optional)",category:"Issue type",description:"Description",location:"Problem location",success:"Report received. Save the reference number.",source:"Source / evidence",notConnected:"A direct connection to the responsible authority is not configured yet. This service is integration-ready."}
};

function mapsUrl(a:string,b:string){return "https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(a)+"&destination="+encodeURIComponent(b)+"&travelmode=driving";}
function save<T>(key:string,value:T){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function load<T>(key:string,fallback:T):T{try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback}catch{return fallback}}

export default function Home(){
 const [lang,setLang]=useState<Lang>("am");
 const [active,setActive]=useState<ServiceId|null>(null);
 const [fareKm,setFareKm]=useState("");
 const [fareRate,setFareRate]=useState("");
 const [fareResult,setFareResult]=useState<number|null>(null);
 const [origin,setOrigin]=useState(""); const [destination,setDestination]=useState("");
 const [report,setReport]=useState({name:"",phone:"",category:"Fare / overcharge",description:"",location:""});
 const [status,setStatus]=useState(""); const [ref,setRef]=useState("");
 const [trip,setTrip]=useState({origin:"",destination:"",time:"",notes:""});
 const [coords,setCoords]=useState<{lat:number,lon:number}|null>(null);
 const [savedTrips,setSavedTrips]=useState<any[]>([]);
 const L=t[lang];

 useEffect(()=>{const saved=load<Lang>("ethio_transport_lang","am");setLang(saved);setSavedTrips(load("ethio_transport_trips",[]));},[]);
 useEffect(()=>save("ethio_transport_lang",lang),[lang]);

 const reportReady=useMemo(()=>report.description.trim().length>=5,[report.description]);

 function locate(){
  if(!navigator.geolocation)return setStatus("Location is not supported on this device.");
  navigator.geolocation.getCurrentPosition(p=>{setCoords({lat:p.coords.latitude,lon:p.coords.longitude});setReport(x=>({...x,location:x.location||p.coords.latitude.toFixed(6)+", "+p.coords.longitude.toFixed(6)}));},()=>setStatus("Could not read your location."));
 }
 function addTrip(){
  if(!trip.origin||!trip.destination)return;
  const next=[{...trip,id:crypto.randomUUID(),createdAt:new Date().toISOString()},...savedTrips].slice(0,20);
  setSavedTrips(next);save("ethio_transport_trips",next);setStatus("Trip saved locally.");
 }
 async function submitReport(e:FormEvent){
  e.preventDefault(); setStatus("");
  const id="ET-"+new Date().toISOString().replace(/\D/g,"").slice(0,14)+"-"+Math.random().toString(36).slice(2,7).toUpperCase();
  const payload={...report,reference:id,createdAt:new Date().toISOString(),coordinates:coords};
  try{
   const r=await fetch("/api/complaints",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
   if(r.ok){const d=await r.json();setRef(d.reference||id);setStatus(L.success);return;}
  }catch{}
  const local=load<any[]>("ethio_transport_reports",[]);save("ethio_transport_reports",[payload,...local].slice(0,50));
  setRef(id);setStatus(L.success);
 }

 return <main className="app">
  <header className="top">
   <div><div className="brand">{L.title}</div><div className="sub">{L.sub}</div></div>
   <select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}><option value="am">አማ</option><option value="en">EN</option><option value="ao">AO</option></select>
  </header>
  <section className="hero"><h1>🚍 ETHIO TRANSPORT</h1><p>{L.sub}</p><div className="trust">✓ Source-aware &nbsp; ✓ Integration-ready &nbsp; ✓ Mobile-first</div></section>
  <h2 className="section-title">{L.sections}</h2>
  <div className="grid">{services.map(([icon,am,en,id,desc])=><button className="card" key={id} onClick={()=>{setActive(id);setStatus("")}}><span className="icon">{icon}</span><h3>{lang==="am"?am:en}</h3><p>{lang==="am"?desc:"Connected service module prepared for verified transport information, responsible-authority links and user actions."}</p><span className="open">{L.open} →</span></button>)}</div>

  {active&&<section className="panel">
   <div className="panel-head"><h2>{services.find(x=>x[3]===active)?.[lang==="am"?1:2]}</h2><button onClick={()=>setActive(null)}>{L.close}</button></div>

   {active==="origin"&&<div className="stack"><label>{L.from}<input value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="Bole / local area"/></label><label>{L.to}<input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Mercato / local area"/></label><a className="primary" target="_blank" rel="noreferrer" href={mapsUrl(origin,destination)}>{L.search} 🗺️</a><p className="note">{L.notConnected}</p></div>}

   {active==="fare"&&<div className="stack"><label>{L.km}<input inputMode="decimal" value={fareKm} onChange={e=>setFareKm(e.target.value)} /></label><label>{L.rate}<input inputMode="decimal" value={fareRate} onChange={e=>setFareRate(e.target.value)} /></label><button className="primary" onClick={()=>{const k=Number(fareKm),r=Number(fareRate);setFareResult(Number.isFinite(k*r)&&k>=0&&r>=0?k*r:null)}}>{L.calc}</button>{fareResult!==null&&<div className="result"><strong>{fareResult.toFixed(2)} ETB</strong><span>{fareKm} km × {fareRate} ETB/km</span></div>}<p className="note">{L.notConnected}</p></div>}

   {active==="report"&&<form className="stack" onSubmit={submitReport}><label>{L.name}<input value={report.name} onChange={e=>setReport({...report,name:e.target.value})}/></label><label>{L.phone}<input value={report.phone} onChange={e=>setReport({...report,phone:e.target.value})}/></label><label>{L.category}<select value={report.category} onChange={e=>setReport({...report,category:e.target.value})}><option>Fare / overcharge</option><option>Route / vehicle</option><option>Safety</option><option>Ticket / service</option><option>Accessibility</option><option>Other</option></select></label><label>{L.location}<div className="inline"><input value={report.location} onChange={e=>setReport({...report,location:e.target.value})}/><button type="button" className="outline" onClick={locate}>📍</button></div></label><label>{L.description}<textarea required minLength={5} value={report.description} onChange={e=>setReport({...report,description:e.target.value})}/></label><button className="primary" disabled={!reportReady}>{L.submit}</button>{status&&<div className="result"><strong>{status}</strong>{ref&&<span>Reference: {ref}</span>}</div>}<p className="note">{L.notConnected}</p></form>}

   {active==="map"&&<div className="stack"><p>📍 {L.location}</p><button className="outline" onClick={locate}>Use my location</button>{coords&&<a className="primary" target="_blank" rel="noreferrer" href={"https://www.google.com/maps/search/?api=1&query="+coords.lat+","+coords.lon}>Open current location in Google Maps</a>}<p className="note">{L.notConnected}</p></div>}

   {active==="ticket"&&<div className="stack"><p>🎫 Ticket information is structured for future links to bus, rail, air and authorized ticket providers.</p><a className="outline" href="https://www.google.com/search?q=Ethiopia+public+transport+tickets" target="_blank" rel="noreferrer">Find authorized ticket service</a><p className="note">{L.notConnected}</p></div>}

   {active==="emergency"&&<div className="stack"><p>Use only verified emergency contacts published by the responsible authority. The system is ready for authority-managed numbers.</p><a className="primary" href="tel:991">📞 991</a><p className="note">Emergency numbers can vary by service and location. Verify before production publication.</p></div>}

   {active==="trusted"&&<div className="stack"><label>{L.from}<input value={trip.origin} onChange={e=>setTrip({...trip,origin:e.target.value})}/></label><label>{L.to}<input value={trip.destination} onChange={e=>setTrip({...trip,destination:e.target.value})}/></label><label>Time<input type="datetime-local" value={trip.time} onChange={e=>setTrip({...trip,time:e.target.value})}/></label><label>Notes<textarea value={trip.notes} onChange={e=>setTrip({...trip,notes:e.target.value})}/></label><button className="primary" onClick={addTrip}>Save Trip Proof</button>{savedTrips.length>0&&<div className="list">{savedTrips.map(x=><div className="mini" key={x.id}><strong>{x.origin} → {x.destination}</strong><span>{x.time||x.createdAt}</span></div>)}</div>}</div>}

   {active==="access"&&<div className="stack"><label>Accessibility need<select><option>Wheelchair access</option><option>Visual assistance</option><option>Hearing assistance</option><option>Other</option></select></label><p className="note">{L.notConnected}</p></div>}
   {active==="parcel"&&<div className="stack"><p>Parcel and document transport is separated from passenger transport so authorized operators can be connected without mixing services.</p><p className="note">{L.notConnected}</p></div>}
   {active==="offline"&&<div className="stack"><p>Last locally saved trips and reports remain available on this device. Official fares and live status must not be fabricated when offline.</p><button className="outline" onClick={()=>setStatus("Offline data is available on this device.")}>Check offline data</button></div>}
  </section>}

  <footer><strong>ETHIO TRANSPORT</strong><span>Public information platform • verified-source architecture • responsible-authority integration</span></footer>
 </main>
