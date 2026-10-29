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
    return json({
      origin,destination,coverage,sourceVerification,
      routeCount:matches.length,routes:matches,
      message:matches.length
        ?"Transport route records matched the requested places."
        :"No verified/community-sourced route record currently matches these places; no route is being invented."
    });
  }catch{return json({error:"Route search is temporarily unavailable."},503)}
}