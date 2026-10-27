import { NextResponse } from "next/server";

export async function POST(request: Request){
  try{
    const body=await request.json();
    if(!body?.description || String(body.description).trim().length<5){
      return NextResponse.json({error:"Description is required."},{status:400});
    }
    const reference=String(body.reference||"ET-"+Date.now());
    const webhook=process.env.TRANSPORT_COMPLAINT_WEBHOOK_URL;
    if(webhook){
      const r=await fetch(webhook,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,reference,product:"ETHIO TRANSPORT"})});
      if(!r.ok)return NextResponse.json({error:"Responsible-authority endpoint rejected the report."},{status:502});
      return NextResponse.json({ok:true,reference,delivered:true});
    }
    return NextResponse.json({ok:true,reference,delivered:false,integration:"not_configured"});
  }catch{return NextResponse.json({error:"Invalid report request."},{status:400});}
}
