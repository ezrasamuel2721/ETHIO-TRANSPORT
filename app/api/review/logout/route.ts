import { NextResponse } from "next/server";
export async function POST(request:Request){
 const response=NextResponse.redirect(new URL("/review",request.url),303);
 response.cookies.set("ethio_review_session","",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});
 return response;
}