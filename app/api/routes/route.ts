import { NextResponse } from "next/server";
export async function GET(request:Request){
  const endpoint=process.env.TRANSPORT_ROUTES_URL;
  if(!endpoint)return NextResponse.json({ok:false,source:"not_configured",message:"Verified route source is not connected."},{status:503});
  try{const u=new URL(endpoint);const q=new URL(request.url).searchParams.get("q");if(q)u.searchParams.set("q",q);const r=await fetch(u,{cache:"no-store"});if(!r.ok)throw new Error("upstream");return NextResponse.json(await r.json());}
  catch{return NextResponse.json({ok:false,source:"unavailable"},{status:502});}
}
