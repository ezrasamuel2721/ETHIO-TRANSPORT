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
    const description=text(body?.description, 4000);
    if(!description || description.length<5){
      return NextResponse.json({error:"Description is required."},{status:400});
    }

    const latitudeValue = body?.latitude ?? body?.coordinates?.lat;
    const longitudeValue = body?.longitude ?? body?.coordinates?.lon;
    const latitude=latitudeValue == null ? null : Number(latitudeValue);
    const longitude=longitudeValue == null ? null : Number(longitudeValue);
    if(latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)){
      return NextResponse.json({error:"Invalid latitude."},{status:400});
    }
    if(longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)){
      return NextResponse.json({error:"Invalid longitude."},{status:400});
    }

    const reference=text(body?.reference, 80) || "ET-"+Date.now();
    const record={
      reference,
      name:text(body?.name, 120),
      phone:text(body?.phone, 40),
      category:text(body?.category, 120),
      location:text(body?.location, 300),
      description,
      latitude,
      longitude
    };

    if(!supabaseUrl || !supabaseKey){
      return NextResponse.json({error:"Complaint storage is not configured; the report was not saved. Please retry later."},{status:503});
    }

    const r=await fetch(`${supabaseUrl}/rest/v1/transport_complaints`,{
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
    if(!r.ok){
      const detail=await r.text();
      return NextResponse.json({error:"Could not save the report.",detail:detail.slice(0,300)},{status:502});
    }

    // Persisting the report is the submission. Notification delivery is best-effort;
    // don't tell clients a saved report failed just because a webhook is unavailable.
    let delivered=false;
    const webhook=process.env.TRANSPORT_COMPLAINT_WEBHOOK_URL;
    if(webhook){
      try{
        const notification=await fetch(webhook,{
          method:"POST",
          headers:{"content-type":"application/json"},
          body:JSON.stringify({...record,product:"ETHIO TRANSPORT"}),
          signal:AbortSignal.timeout(10000)
        });
        delivered=notification.ok;
      }catch{}
    }

    return NextResponse.json({ok:true,reference,delivered,persisted:true});
  }catch{return NextResponse.json({error:"Invalid report request."},{status:400});}
}
