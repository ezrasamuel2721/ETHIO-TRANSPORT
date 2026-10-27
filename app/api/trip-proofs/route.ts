import { NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

export async function POST(request: Request){
  try{
    const body=await request.json();
    if(!body?.origin || !body?.destination || !body?.plannedAt){
      return NextResponse.json({error:"Origin, destination and planned time are required."},{status:400});
    }
    const record={
      reference:String(body.reference||"ET-TRIP-"+Date.now()),
      origin:String(body.origin).trim(),
      destination:String(body.destination).trim(),
      planned_at:new Date(body.plannedAt).toISOString(),
      notes:body.notes ? String(body.notes).trim() : null
    };
    if(!supabaseUrl || !supabaseKey){
      return NextResponse.json({ok:true,persisted:false,reference:record.reference});
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
      cache:"no-store"
    });
    if(!r.ok)return NextResponse.json({error:"Could not save the trusted trip.",detail:(await r.text()).slice(0,300)},{status:502});
    return NextResponse.json({ok:true,persisted:true,reference:record.reference});
  }catch{
    return NextResponse.json({error:"Invalid trusted trip request."},{status:400});
  }
}
