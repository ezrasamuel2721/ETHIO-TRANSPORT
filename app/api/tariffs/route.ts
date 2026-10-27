import { NextResponse } from "next/server";
export async function GET(){
  const endpoint=process.env.TRANSPORT_TARIFFS_URL;
  if(!endpoint)return NextResponse.json({ok:false,source:"not_configured",message:"Verified tariff source is not connected."},{status:503});
  try{const r=await fetch(endpoint,{cache:"no-store"});if(!r.ok)throw new Error("upstream");return NextResponse.json(await r.json());}
  catch{return NextResponse.json({ok:false,source:"unavailable"},{status:502});}
}
