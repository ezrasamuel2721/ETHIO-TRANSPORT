import { NextRequest, NextResponse } from "next/server";

const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"public, s-maxage=60, stale-while-revalidate=600"}});
const normalize=(v:string)=>v.toLocaleLowerCase().normalize("NFKC").replace(/[’']/g,"").replace(/[-_/.,()]/g," ").replace(/\s+/g," ").trim();

type RouteRow={
  id?:string|number;
  route_code?:string|null;
  name?:string|null;
  name_am?:string|null;
  name_om?:string|null;
  name_en?:string|null;
  origin?:string|null;
  destination?:string|null;
  distance_km?:number|null;
  service_type?:string|null;
  region_code?:string|null;
  active?:boolean;
  verified_at?:string|null;
  source?:{name:string;url:string;verification:string}|null;
};

function parseCsvLine(line:string){
  const out:string[]=[]; let cur=""; let quoted=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){
      if(quoted && line[i+1]==='"'){cur+='"';i++;continue;}
      quoted=!quoted; continue;
    }
    if(c===','&&!quoted){out.push(cur);cur="";continue;}
    cur+=c;
  }
  out.push(cur); return out;
}

async function liveAddisDetails(routes:RouteRow[]){
  const base="https://raw.githubusercontent.com/AddisMap/AddisMapTransit-gtfs/main/";
  const [rr,tt,ss]=await Promise.all([fetch(base+"routes.txt",{cache:"no-store"}),fetch(base+"trips.txt",{cache:"no-store"}),fetch(base+"stop_times.txt",{cache:"no-store"}),]);
  if(!rr.ok||!tt.ok||!ss.ok) return routes;
  const [rtxt,ttxt,stxt]=await Promise.all([rr.text(),tt.text(),ss.text()]);
  const parse=(t:string)=>{const ls=t.split(/\\r?\\n/).filter(Boolean);if(!ls.length)return [];const row=(s:string)=>{const a:string[]=[];let c="",q=false;for(let i=0;i<s.length;i++){const x=s[i];if(x==='"'){if(q&&s[i+1]==='"'){c+='"';i++;}else q=!q;}else if(x===','&&!q){a.push(c);c="";}else c+=x;}a.push(c);return a};const h=row(ls[0]);return ls.slice(1).map(x=>{const r=row(x),o:any={};h.forEach((k,i)=>o[k]=r[i]??"");return o});};
  const gtfsRoutes=parse(rtxt), trips=parse(ttxt), times=parse(stxt);
  const routeByCode=new Map(gtfsRoutes.map((r:any)=>[String(r.route_short_name||r.route_long_name).trim(),r]));
  const tripMap=new Map(trips.map((t:any)=>[String(t.trip_id),t]));
  const needed=new Set<string>();
  for(const r of routes){const g=routeByCode.get(String(r.route_code||"").trim());if(g) needed.add(String(g.route_id));}
  if(!needed.size)return routes;
  const stopIds=new Set<string>();
  const seqByRoute=new Map<string,any[]>();
  for(const x of times){const t=tripMap.get(String(x.trip_id));if(!t||!needed.has(String(t.route_id)))continue;stopIds.add(String(x.stop_id));const arr=seqByRoute.get(String(t.route_id))||[];if(arr.length<80)arr.push({stop_id:String(x.stop_id),stop_sequence:Number(x.stop_sequence||0),trip_id:String(x.trip_id)});seqByRoute.set(String(t.route_id),arr);}
  const stopRows=parse((await (await fetch(base+"stops.txt",{cache:"no-store"})).text()));
  const stopMap=new Map(stopRows.map((s:any)=>[String(s.stop_id),s]));
  return routes.map(r=>{const g=routeByCode.get(String(r.route_code||"").trim());if(!g)return r;const seq=(seqByRoute.get(String(g.route_id))||[]).sort((a,b)=>a.stop_sequence-b.stop_sequence);const seen=new Set<string>();const stops=seq.map(x=>{if(seen.has(x.stop_id))return null;seen.add(x.stop_id);const s=stopMap.get(x.stop_id);if(!s)return null;return {id:x.stop_id,name:s.stop_name,name_en:s.stop_name,latitude:Number(s.stop_lat),longitude:Number(s.stop_lon),stop_sequence:x.stop_sequence};}).filter(Boolean);return {...r,gtfs_route_id:String(g.route_id),stops,stopCount:stops.length,stopSource:"AddisMapTransit GTFS / OpenStreetMap"};});
}

async function liveAddisRoutes(origin:string,destination:string){
  const url="https://raw.githubusercontent.com/AddisMap/AddisMapTransit-gtfs/main/routes.txt";
  const r=await fetch(url,{cache:"no-store"});
  if(!r.ok) return [];
  const text=await r.text();
  const lines=text.split(/\r?\n/).filter(Boolean);
  if(lines.length<2) return [];
  const header=parseCsvLine(lines[0]).map(normalize);
  const ix=(name:string)=>header.indexOf(name);
  const routeId=ix("route_id"), routeType=ix("route_type"), longName=ix("route_long_name"), shortName=ix("route_short_name");
  const o=normalize(origin),d=normalize(destination);
  return lines.slice(1).map(line=>{
    const c=parseCsvLine(line);
    const long=(c[longName]||"").trim(), short=(c[shortName]||"").trim();
    const text=normalize(long+" "+short);
    const parts=long.split("↔").map(x=>x.trim());
    let score=0;
    if(text.includes(o))score+=5;
    if(text.includes(d))score+=5;
    if(parts[0]&&normalize(parts[0]).includes(o))score+=4;
    if(parts[1]&&normalize(parts[1]).includes(d))score+=4;
    if(parts[0]&&normalize(parts[0]).includes(d))score+=2;
    if(parts[1]&&normalize(parts[1]).includes(o))score+=2;
    return {_score:score,row:{
      id:"addismap-"+(c[routeId]||""),
      route_code:short||null,
      name:long||short||null,
      name_en:long||short||null,
      origin:parts[0]||null,
      destination:parts[1]||null,
      service_type:Number(c[routeType])===0?"tram":Number(c[routeType])===3?"bus":"public_transport",
      region_code:"AA",
      active:true,
      verified_at:new Date().toISOString(),
      source:{
        name:"AddisMapTransit GTFS / OpenStreetMap",
        url,
        verification:"Community-mapped and OSM-validated GTFS source; not a government certification."
      }
    } as RouteRow};
  }).filter(x=>x._score>0).sort((a,b)=>b._score-a._score).slice(0,20).map(x=>x.row);
}

export async function GET(request:NextRequest){
  const p=new URL(request.url).searchParams;
  const origin=(p.get("origin")||"").trim(), destination=(p.get("destination")||"").trim();
  if(!origin||!destination)return json({error:"Origin and destination are required."},400);
  const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!base||!key)return json({error:"Transport route database is not configured."},503);

  try{
    const url=new URL("/rest/v1/transport_routes",base);
    url.searchParams.set("select","id,route_code,name,name_am,name_om,name_en,origin,destination,distance_km,service_type,region_code,active,verified_at,transport_operators(name,name_am,name_om,name_en),transport_route_stops(stop_sequence,transport_stops(id,name,name_am,name_om,name_en,latitude,longitude)),transport_sources(organization_name,source_url,title,status,verification_note)");
    url.searchParams.set("active","eq.true");
    url.searchParams.set("limit","500");
    const r=await fetch(url,{headers:{apikey:key,Authorization:`Bearer ${key}`},next:{revalidate:60}});
    if(!r.ok)return json({error:"Could not read route data."},503);
    const rows=await r.json();
    const o=normalize(origin),d=normalize(destination);
    const score=(row:any)=>{
      const text=[row.origin,row.destination,row.name,row.name_en,row.name_am,row.name_om].filter(Boolean).map(normalize).join(" ");
      let s=0;
      if(text.includes(o))s+=3;if(text.includes(d))s+=3;
      if(normalize(String(row.origin||"")).includes(o))s+=4;
      if(normalize(String(row.destination||"")).includes(d))s+=4;
      return s;
    };
    let matches=rows.map((x:any)=>({...x,_score:score(x)})).filter((x:any)=>x._score>0).sort((a:any,b:any)=>b._score-a._score).slice(0,20).map((x:any)=>{const {_score,...rest}=x;return rest;});
    let coverage=rows.length?"route_database":"live_addis_gtfs_fallback";
    let sourceVerification=rows.length?"Database records":"Live AddisMapTransit GTFS fallback";
    if(!matches.length){
      const live=await liveAddisRoutes(origin,destination);
      if(live.length){matches=live;coverage="live_addis_gtfs_fallback";sourceVerification="Community-mapped/OSM-validated GTFS; not government certification.";}
    }
    const enrichedMatches = matches.length ? await liveAddisDetails(matches) : matches;
    return json({
      origin,destination,coverage,sourceVerification,
      routeCount:enrichedMatches.length,routes:enrichedMatches,
      message:enrichedMatches.length
        ?"Transport route records matched the requested places."
        :"No verified/community-sourced route record currently matches these places; no route is being invented."
    });
  }catch{return json({error:"Route search is temporarily unavailable."},503)}
}