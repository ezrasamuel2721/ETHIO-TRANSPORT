import { NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

export async function POST(request: Request){
  try{
    const body=await request.json();
    if(!body?.description || String(body.description).trim().length<5){
      return NextResponse.json({error:"Description is required."},{status:400});
    }

    const reference=String(body.reference||"ET-"+Date.now());
    const record={
      reference,
      name: body.name ? String(body.name) : null,
      phone: body.phone ? String(body.phone) : null,
      category: body.category ? String(body.category) : null,
      location: body.location ? String(body.location) : null,
      description: String(body.description).trim(),
      latitude: Number.isFinite(Number(body.latitude)) ? Number(body.latitude) : null,
      longitude: Number.isFinite(Number(body.longitude)) ? Number(body.longitude) : null
    };

    if(supabaseUrl && supabaseKey){
      const r=await fetch(`${supabaseUrl}/rest/v1/transport_complaints`,{
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
      if(!r.ok){
        const detail=await r.text();
        return NextResponse.json({error:"Could not save the report.",detail:detail.slice(0,300)},{status:502});
      }
    }

    const webhook=process.env.TRANSPORT_COMPLAINT_WEBHOOK_URL;
    if(webhook){
      const r=await fetch(webhook,{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({...record,product:"ETHIO TRANSPORT"})
      });
      if(!r.ok)return NextResponse.json({error:"Responsible-authority endpoint rejected the report."},{status:502});
    }

    return NextResponse.json({ok:true,reference,delivered:Boolean(webhook),persisted:Boolean(supabaseUrl && supabaseKey)});
  }catch{return NextResponse.json({error:"Invalid report request."},{status:400});}
}
