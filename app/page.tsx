"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Lang = "am" | "en" | "ao";
type ServiceId = "origin"|"fare"|"ticket"|"report"|"map"|"emergency"|"trusted"|"access"|"parcel"|"offline";

const services = [
  {id:"origin" as ServiceId,icon:"🧭",am:"መንገድ ፈላጊ",en:"Route Finder",desc:"መነሻ፣ መድረሻ፣ ቀን እና የጉዞ አይነት በአንድ ቦታ።",visual:"route"},
  {id:"fare" as ServiceId,icon:"💳",am:"የክፍያ ጥበቃ",en:"Fare Guard",desc:"ርቀትን እና የተረጋገጠ የኪ.ሜ ታሪፍን በግልጽ ያስሉ።",visual:"fare"},
  {id:"ticket" as ServiceId,icon:"🎫",am:"ትኬት",en:"Tickets & Buses",desc:"የቲኬት መድረኮችን እና የባስ ኦፕሬተሮችን ይፈልጉ።",visual:"ticket"},
  {id:"report" as ServiceId,icon:"📝",am:"ቅሬታና ሪፖርት",en:"Report a Problem",desc:"የታሪፍ፣ የመንገድ፣ የደህንነት ወይም የአገልግሎት ችግር ያሳውቁ።",visual:"report"},
  {id:"map" as ServiceId,icon:"🗺️",am:"የችግር ካርታ",en:"Problem Map",desc:"የችግሩን ቦታ በGPS ይያዙ እና በካርታ ይክፈቱ።",visual:"map"},
  {id:"emergency" as ServiceId,icon:"🚨",am:"የአደጋ እርዳታ",en:"Emergency Help",desc:"የተረጋገጡ የፖሊስ እና የአደጋ መስመሮችን በፍጥነት ይድረሱ።",visual:"emergency"},
  {id:"trusted" as ServiceId,icon:"🛡️",am:"የታመነ ጉዞ",en:"Trusted Trip",desc:"የጉዞ ማስረጃ፣ ጊዜ፣ መነሻ እና መድረሻ ያስቀምጡ።",visual:"trusted"},
  {id:"access" as ServiceId,icon:"♿",am:"ተደራሽነት",en:"Accessibility",desc:"የተደራሽነት ፍላጎትዎን ያስቀምጡ እና ለተደራሽ ጉዞ ይዘጋጁ።",visual:"access"},
  {id:"parcel" as ServiceId,icon:"📦",am:"ፓርሴል / ሰነድ",en:"Parcel / Document",desc:"የፓርሴል እና የሰነድ ጉዞን ከተጓዥ ቲኬት በተለየ ያደራጁ።",visual:"parcel"},
  {id:"offline" as ServiceId,icon:"📴",am:"ከመስመር ውጭ / ዝቅተኛ ዳታ",en:"Offline / Low Data",desc:"የተቀመጡ ጉዞዎችን፣ ሪፖርቶችን እና የመጨረሻ መረጃን በዝቅተኛ ዳታ ይጠቀሙ።",visual:"offline"}
];

const ticketPlatforms = [
  {name:"i-Ticket",meta:"Bus ticketing • QR • TeleBirr",url:"https://i-ticket.et/",image:"https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=900&q=80"},
  {name:"iGO",meta:"50+ operators • 200+ routes",url:"https://igo.et/",image:"https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=900&q=80"},
  {name:"DANU Booking",meta:"20+ bus operators",url:"https://staging.danubooking.et/guest/bookings",image:"https://images.unsplash.com/photo-1494515843206-f3117d3f51b7?auto=format&fit=crop&w=900&q=80"},
  {name:"eTicket Ethiopia",meta:"Intercity tickets • PNR",url:"https://www.eticket.et/",image:"https://images.unsplash.com/photo-1509749837427-ac94a2553d0e?auto=format&fit=crop&w=900&q=80"},
  {name:"GARA",meta:"200+ routes • 30+ operators",url:"https://ethticket.et/",image:"https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=900&q=80"},
  {name:"Menahariya",meta:"Bus search • digital ticket",url:"https://menahariya.com/",image:"https://images.unsplash.com/photo-1525609004556-c46c7cf6cf4d?auto=format&fit=crop&w=900&q=80"},
  {name:"Mengedegna",meta:"Bus booking • multiple partners",url:"https://mengedegna.com/en",image:"https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=900&q=80"},
  {name:"Wede",meta:"Express buses • digital QR",url:"https://wede.et/",image:"https://images.unsplash.com/photo-1557223562-6c77ef16210f?auto=format&fit=crop&w=900&q=80"}
];

const operators = ["Selam Bus","Abay Bus","Ghion Bus","Awash Bus","Golden Bus","Zemen Bus","ODAA Bus","Ethio Bus","Liyu Bus","Walia Bus","Dream Line","Limalimo"];

const t = {
  am:{sub:"የኢትዮጵያ የህዝብ መጓጓዣ መረጃና አገልግሎት መድረክ",sections:"ዋና ዋና አገልግሎቶች",open:"ክፈት",close:"ዝጋ",from:"መነሻ",to:"መድረሻ",date:"የጉዞ ቀን",find:"መንገድ ፈልግ",distance:"ርቀት (km)",rate:"የተረጋገጠ ታሪፍ / km",calc:"ታሪፍ አስላ",report:"ሪፖርቱን ላክ",success:"ሪፖርቱ ተቀብሏል።",location:"የችግሩ ቦታ",description:"ዝርዝር መግለጫ",name:"ስም",phone:"ስልክ",category:"የችግር ዓይነት",save:"አስቀምጥ",saved:"በስልክ ላይ ተቀምጧል",today:"ዛሬ",bus:"የባስ ኦፕሬተሮች",platforms:"የቲኬት መድረኮች"},
  en:{sub:"Ethiopia's public transport information and service platform",sections:"Core services",open:"Open",close:"Close",from:"Origin",to:"Destination",date:"Travel date",find:"Find route",distance:"Distance (km)",rate:"Verified fare / km",calc:"Calculate fare",report:"Submit report",success:"Report received.",location:"Problem location",description:"Description",name:"Name",phone:"Phone",category:"Issue type",save:"Save",saved:"Saved on this device",today:"Today",bus:"Bus operators",platforms:"Ticket platforms"},
  ao:{sub:"Ethiopia public transport information and service platform",sections:"Core services",open:"Open",close:"Close",from:"Origin",to:"Destination",date:"Travel date",find:"Find route",distance:"Distance (km)",rate:"Verified fare / km",calc:"Calculate fare",report:"Submit report",success:"Report received.",location:"Problem location",description:"Description",name:"Name",phone:"Phone",category:"Issue type",save:"Save",saved:"Saved on this device",today:"Today",bus:"Bus operators",platforms:"Ticket platforms"}
};

function mapsUrl(a:string,b:string){return "https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(a)+"&destination="+encodeURIComponent(b)+"&travelmode=driving";}
function save<T>(key:string,value:T){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function load<T>(key:string,fallback:T):T{try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback}catch{return fallback}}

export default function Home(){
 const [lang,setLang]=useState<Lang>("am");
 const [active,setActive]=useState<ServiceId|null>(null);
 const [origin,setOrigin]=useState(""); const [destination,setDestination]=useState(""); const [tripDate,setTripDate]=useState("");
 const [fareKm,setFareKm]=useState(""); const [fareRate,setFareRate]=useState(""); const [fareResult,setFareResult]=useState<number|null>(null);
 const [coords,setCoords]=useState<{lat:number,lon:number}|null>(null);
 const [status,setStatus]=useState(""); const [ref,setRef]=useState("");
 const [report,setReport]=useState({name:"",phone:"",category:"Fare / overcharge",description:"",location:""});
 const [trip,setTrip]=useState({origin:"",destination:"",time:"",notes:""});
 const [savedTrips,setSavedTrips]=useState<any[]>([]);
 const [accessNeed,setAccessNeed]=useState("Wheelchair access");
 const [parcel,setParcel]=useState({from:"",to:"",description:""});
 const L=t[lang];

 useEffect(()=>{setLang(load<Lang>("ethio_transport_lang","am"));setSavedTrips(load("ethio_transport_trips",[]));},[]);
 useEffect(()=>save("ethio_transport_lang",lang),[lang]);

 const reportReady=useMemo(()=>report.description.trim().length>=5,[report.description]);
 const selected=services.find(x=>x.id===active);

 function locate(){
  if(!navigator.geolocation){setStatus("GPS is not supported on this device.");return}
  navigator.geolocation.getCurrentPosition(p=>{const c={lat:p.coords.latitude,lon:p.coords.longitude};setCoords(c);setReport(x=>({...x,location:x.location||c.lat.toFixed(6)+", "+c.lon.toFixed(6)}));setStatus("Location captured.");},()=>setStatus("Could not read your location."));
 }
 function findRoute(e:FormEvent){
  e.preventDefault(); if(!origin.trim()||!destination.trim()){setStatus("Please enter both origin and destination.");return}
  window.open(mapsUrl(origin,destination),"noopener,noreferrer");
 }
 function addTrip(){
  if(!trip.origin.trim()||!trip.destination.trim()){setStatus("Enter origin and destination first.");return}
  const next=[{...trip,id:crypto.randomUUID(),createdAt:new Date().toISOString()},...savedTrips].slice(0,20);setSavedTrips(next);save("ethio_transport_trips",next);setStatus(L.saved);
 }
 async function submitReport(e:FormEvent){
  e.preventDefault();setStatus("");
  const id="ET-"+new Date().toISOString().replace(/\D/g,"").slice(0,14)+"-"+Math.random().toString(36).slice(2,7).toUpperCase();
  const payload={...report,reference:id,createdAt:new Date().toISOString(),coordinates:coords};
  try{const r=await fetch("/api/complaints",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});if(r.ok){const d=await r.json();setRef(d.reference||id);setStatus(L.success);return}}catch{}
  save("ethio_transport_reports",[payload,...load<any[]>("ethio_transport_reports",[])].slice(0,50));setRef(id);setStatus(L.success);
 }
 function saveAccess(){save("ethio_transport_accessibility",{need:accessNeed,savedAt:new Date().toISOString()});setStatus(L.saved)}
 function saveParcel(){if(!parcel.from||!parcel.to||!parcel.description){setStatus("Complete the parcel form first.");return}save("ethio_transport_parcel",parcel);setStatus(L.saved)}

 return <main className="app">
  <header className="top">
   <div><div className="brand">ETHIO TRANSPORT</div><div className="sub">{L.sub}</div></div>
   <select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}><option value="am">አማ</option><option value="en">EN</option><option value="ao">AO</option></select>
  </header>

  <section className="hero">
   <div className="hero-copy"><span className="eyebrow">SMART MOBILITY • ETHIOPIA</span><h1>🚍 ETHIO TRANSPORT</h1><p>{L.sub}</p></div>
   <form className="quick-search" onSubmit={findRoute}>
    <div><span>FROM</span><input value={origin} onChange={e=>setOrigin(e.target.value)} placeholder={L.from}/></div>
    <div><span>TO</span><input value={destination} onChange={e=>setDestination(e.target.value)} placeholder={L.to}/></div>
    <div><span>{L.date}</span><input type="date" value={tripDate} onChange={e=>setTripDate(e.target.value)}/></div>
    <button className="search-btn">{L.find} →</button>
   </form>
   <div className="trust"><span>✓ Verified-source architecture</span><span>✓ Mobile-first</span><span>✓ Authority integration ready</span></div>
  </section>

  <div className="quick-actions">
   <button onClick={()=>setActive("ticket")}>🎫 {L.platforms}</button>
   <button onClick={()=>setActive("fare")}>💳 {lang==="am"?"ታሪፍ አስላ":"Fare"}</button>
   <button onClick={()=>setActive("report")}>📝 {lang==="am"?"ቅሬታ":"Report"}</button>
   <button onClick={()=>setActive("emergency")}>🚨 {lang==="am"?"አደጋ":"Emergency"}</button>
  </div>

  <div className="section-heading"><div><span className="eyebrow dark">SERVICES</span><h2>{L.sections}</h2></div><span className="service-count">10</span></div>
  <div className="grid">{services.map(s=><button className={"card card-"+s.visual} key={s.id} onClick={()=>{setActive(s.id);setStatus("")}}>
    <div className="card-image"><div className="card-art">{s.icon}</div><span className="card-arrow">↗</span></div>
    <div className="card-body"><div className="card-kicker">ETHIO TRANSPORT</div><h3>{lang==="am"?s.am:s.en}</h3><p>{s.desc}</p><span className="open">{L.open} →</span></div>
  </button>)}</div>

  {active&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setActive(null)}}>
   <section className="modal" role="dialog" aria-modal="true" aria-labelledby="service-title">
    <div className="modal-hero"><div className={"modal-art "+(selected?.visual||"")}>{selected?.icon}</div><div><span className="eyebrow dark">ACTIVE SERVICE</span><h2 id="service-title">{lang==="am"?selected?.am:selected?.en}</h2></div><button className="close" onClick={()=>setActive(null)}>{L.close} ×</button></div>
    <div className="modal-content">

     {active==="origin"&&<form className="feature-form" onSubmit={findRoute}>
      <div className="form-grid"><label>{L.from}<input value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="Bole / local area"/></label><label>{L.to}<input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Mercato / local area"/></label><label>{L.date}<input type="date" value={tripDate} onChange={e=>setTripDate(e.target.value)}/></label></div>
      <div className="action-row"><button className="primary">🗺️ {L.find}</button>{origin&&destination&&<a className="outline" target="_blank" rel="noreferrer" href={mapsUrl(origin,destination)}>Google Maps ↗</a>}</div>
      <div className="info-strip"><strong>Route workflow</strong><span>Search → map → compare route → report problems → save trip proof.</span></div>
     </form>}

     {active==="fare"&&<div className="feature-form">
      <div className="fare-layout"><div className="fare-visual"><span>💳</span><strong>Fare Guard</strong><small>Transparent calculation</small></div><div className="form-grid"><label>{L.distance}<input inputMode="decimal" value={fareKm} onChange={e=>setFareKm(e.target.value)} placeholder="10"/></label><label>{L.rate}<input inputMode="decimal" value={fareRate} onChange={e=>setFareRate(e.target.value)} placeholder="Enter authority rate"/></label></div></div>
      <button className="primary" onClick={()=>{const k=Number(fareKm),r=Number(fareRate);setFareResult(Number.isFinite(k*r)&&k>=0&&r>=0?k*r:null)}}>{L.calc}</button>
      {fareResult!==null&&<div className="big-result"><span>Estimated fare</span><strong>{fareResult.toFixed(2)} ETB</strong><small>{fareKm} km × {fareRate} ETB/km</small></div>}
      <div className="info-strip"><strong>Source control</strong><span>The rate field is for an authority-published rate; no unofficial fare is presented as official.</span></div>
     </div>}

     {active==="ticket"&&<div className="ticket-hub">
      <div className="ticket-banner"><div><span className="eyebrow">TICKET HUB</span><h3>Find, compare and book intercity travel</h3><p>Open a live ticket platform, search a route, choose a bus and complete booking on the provider.</p></div><span className="ticket-badge">LIVE LINKS</span></div>
      <h3 className="subheading">{L.platforms}</h3>
      <div className="platform-grid">{ticketPlatforms.map(p=><a className="platform-card" key={p.name} href={p.url} target="_blank" rel="noreferrer"><img src={p.image} alt="" loading="lazy"/><div><strong>{p.name}</strong><span>{p.meta}</span><b>Open booking ↗</b></div></a>)}</div>
      <h3 className="subheading">{L.bus}</h3>
      <div className="operator-grid">{operators.map((o,i)=><div className="operator" key={o}><span>{String(i+1).padStart(2,"0")}</span><strong>{o}</strong><a href="https://i-ticket.et/" target="_blank" rel="noreferrer">Find trips ↗</a></div>)}</div>
      <div className="info-strip"><strong>Ticket protection</strong><span>Booking and payment stay with the ticket provider. ETHIO TRANSPORT does not pretend to issue a ticket until a formal operator/API partnership is activated.</span></div>
     </div>}

     {active==="report"&&<form className="feature-form" onSubmit={submitReport}>
      <div className="form-grid"><label>{L.name}<input value={report.name} onChange={e=>setReport({...report,name:e.target.value})}/></label><label>{L.phone}<input value={report.phone} onChange={e=>setReport({...report,phone:e.target.value})}/></label><label>{L.category}<select value={report.category} onChange={e=>setReport({...report,category:e.target.value})}><option>Fare / overcharge</option><option>Route / vehicle</option><option>Safety</option><option>Ticket / service</option><option>Accessibility</option><option>Other</option></select></label><label>{L.location}<div className="inline"><input value={report.location} onChange={e=>setReport({...report,location:e.target.value})}/><button type="button" className="outline icon-btn" onClick={locate}>📍</button></div></label></div>
      <label>{L.description}<textarea required minLength={5} value={report.description} onChange={e=>setReport({...report,description:e.target.value})}/></label>
      <button className="primary" disabled={!reportReady}>📝 {L.report}</button>{status&&<div className="big-result"><span>{status}</span>{ref&&<strong>{ref}</strong>}</div>}
     </form>}

     {active==="map"&&<div className="feature-form"><div className="map-preview"><div>📍</div><strong>Problem location</strong><span>{coords?coords.lat.toFixed(6)+", "+coords.lon.toFixed(6):"GPS location not captured yet"}</span></div><div className="action-row"><button className="primary" onClick={locate}>📍 Use my location</button>{coords&&<a className="outline" target="_blank" rel="noreferrer" href={"https://www.google.com/maps/search/?api=1&query="+coords.lat+","+coords.lon}>Open in Google Maps ↗</a>}</div><p className="helper">Use this module with a report to attach a precise problem location to the complaint.</p></div>}

     {active==="emergency"&&<div className="emergency-grid"><a className="emergency-card red" href="tel:991"><span>🚔</span><strong>Federal / Addis Police</strong><b>991</b><small>Official police emergency line</small></a><a className="emergency-card" href="tel:8295"><span>🚨</span><strong>Sidama Police</strong><b>8295</b><small>Sidama Police official hotline</small></a><a className="emergency-card" href="tel:990"><span>📞</span><strong>Federal Police</strong><b>990</b><small>Federal Police toll-free line</small></a><a className="emergency-card" href="tel:907"><span>🚑</span><strong>Ambulance</strong><b>907</b><small>Emergency medical line listed by official police source</small></a><a className="emergency-card" href="tel:912"><span>🔥</span><strong>Addis Fire</strong><b>912</b><small>Addis Ababa emergency code</small></a></div>}

     {active==="trusted"&&<div className="feature-form"><div className="form-grid"><label>{L.from}<input value={trip.origin} onChange={e=>setTrip({...trip,origin:e.target.value})}/></label><label>{L.to}<input value={trip.destination} onChange={e=>setTrip({...trip,destination:e.target.value})}/></label><label>Time<input type="datetime-local" value={trip.time} onChange={e=>setTrip({...trip,time:e.target.value})}/></label></div><label>Notes<textarea value={trip.notes} onChange={e=>setTrip({...trip,notes:e.target.value})}/></label><button className="primary" onClick={addTrip}>🛡️ {L.save}</button>{savedTrips.length>0&&<div className="saved-list">{savedTrips.map(x=><div className="saved-item" key={x.id}><strong>{x.origin} → {x.destination}</strong><span>{x.time||x.createdAt}</span></div>)}</div>}</div>}

     {active==="access"&&<div className="feature-form"><div className="access-options">{["Wheelchair access","Visual assistance","Hearing assistance","Elderly assistance","Other"].map(x=><button key={x} className={accessNeed===x?"selected":""} onClick={()=>setAccessNeed(x)}>{x}</button>)}</div><button className="primary" onClick={saveAccess}>♿ {L.save}</button>{status&&<div className="info-strip"><strong>{status}</strong><span>Preference is stored locally and can be used when an accessibility partner is connected.</span></div>}</div>}

     {active==="parcel"&&<div className="feature-form"><div className="form-grid"><label>{L.from}<input value={parcel.from} onChange={e=>setParcel({...parcel,from:e.target.value})}/></label><label>{L.to}<input value={parcel.to} onChange={e=>setParcel({...parcel,to:e.target.value})}/></label></div><label>Parcel / document details<textarea value={parcel.description} onChange={e=>setParcel({...parcel,description:e.target.value})}/></label><div className="action-row"><button className="primary" onClick={saveParcel}>📦 {L.save}</button><a className="outline" href="https://i-ticket.et/" target="_blank" rel="noreferrer">Check ticket services ↗</a></div>{status&&<div className="info-strip"><strong>{status}</strong><span>Saved request is ready for a verified parcel operator workflow.</span></div>}</div>}

     {active==="offline"&&<div className="offline-grid"><div className="offline-card"><span>🛡️</span><strong>{savedTrips.length} saved trips</strong><small>Available on this device</small></div><div className="offline-card"><span>📝</span><strong>{load<any[]>("ethio_transport_reports",[]).length} saved reports</strong><small>Available for later sync</small></div><div className="offline-card"><span>📡</span><strong>Low-data mode</strong><small>Official live data is never fabricated offline</small></div></div>}
    </div>
   </section>
  </div>}

  <footer><strong>ETHIO TRANSPORT</strong><span>Public information platform • verified-source architecture • responsible-authority integration</span></footer>
 </main>
}