import { NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

const text = (value: unknown, max: number) => {
  if (value == null) return null;
  const v = String(value).trim();
  return v ? v.slice(0, max) : null;
};

export async function POST(request: Request){
  try{
    const body=await request.json();
    const origin=text(body?.origin, 180);
    const destination=text(body?.destination, 180);
    if(!origin || !destination || !body?.plannedAt){
      return NextResponse.json({error:"Origin, destination and planned time are required."},{status:400});
    }
    if(origin.toLowerCase()===destination.toLowerCase()){
      return NextResponse.json({error:"Origin and destination must be different."},{status:400});
    }
    const plannedAt=new Date(body.plannedAt);
    if(Number.isNaN(plannedAt.getTime())) return NextResponse.json({error:"Invalid planned time."},{status:400});
    const record={
      reference:text(body?.reference, 80) || "ET-TRIP-"+Date.now(),
      origin,
      destination,
      planned_at:plannedAt.toISOString(),
      notes:text(body?.notes, 1000)
    };
    if(!supabaseUrl || !supabaseKey){
      return NextResponse.json({
        ok:false,
        persisted:false,
        reference:record.reference,
        error:"Trip-proof storage is not configured; the trip was not registered on the server. Save it locally and retry later."
      },{status:503});
    }
    const r=await fetch(`${supabaseUrl}/rest/v1/trip_proofs`,{
      method:"POST",
      headers:{
        "content-type":"application/json",
        apikey:supabaseKey,
        Authorization:`Bearer ${supabaseKey}`,
        Prefer:"return=minimal"
      },
      body:JSON.stringify(record),
      cache:"no-store",
      signal:AbortSignal.timeout(10000)
    });
    if(!r.ok)return NextResponse.json({error:"Could not save the trusted trip.",detail:(await r.text()).slice(0,300)},{status:502});
    return NextResponse.json({ok:true,persisted:true,reference:record.reference});
  }catch{
    return NextResponse.json({error:"Invalid trusted trip request."},{status:400});
  }
}
