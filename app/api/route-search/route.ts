import { NextRequest, NextResponse } from "next/server";

const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"public, s-maxage=60, stale-while-revalidate=600"}});
const normalize=(v:string)=>v.toLocaleLowerCase().normalize("NFKC").replace(/[’']/g,"").replace(/[-_/.,()]/g," ").replace(/\s+/g," ").trim();

export async function GET(request:NextRequest){
  const p=new URL(request.url).searchParams;
  const origin=(p.get("origin")||"").trim(), destination=(p.get("destination")||"").trim();
  if(!origin||!destination)return json({error:"Origin and destination are required."},400);
  const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!base||!key)return json({error:"Transport route database is not configured."},503);

  try{
    const url=new URL("/rest/v1/transport_routes",base);
    url.searchParams.set("select","id,route_code,name,name_am,name_om,name_en,origin,destination,distance_km,service_type,region_code,active,verified_at,transport_operators(name,name_am,name_om,name_en),transport_route_stops(stop_sequence,transport_stops(id,name,name_am,name_om,name_en,latitude,longitude))");
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
    const matches=rows.map((x:any)=>({...x,_score:score(x)})).filter((x:any)=>x._score>0).sort((a:any,b:any)=>b._score-a._score).slice(0,20).map((x:any)=>{const {_score,...rest}=x;return rest;});
    return json({
      origin,destination,
      coverage:rows.length?"route_database":"no_route_data_loaded",
      routeCount:matches.length,
      routes:matches,
      message:matches.length?"Verified route records matched the requested places.":"No verified route record currently matches these places; no route is being invented."
    });
  }catch{return json({error:"Route search is temporarily unavailable."},503)}
}