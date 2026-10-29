import { NextResponse } from "next/server";
import { authenticateReviewUser, createReviewSession } from "../../../../lib/review-auth";
export async function POST(request:Request){
 const form=await request.formData(), username=String(form.get("username")||"").trim(), password=String(form.get("password")||"");
 const user=authenticateReviewUser(username,password);
 if(!user) return NextResponse.redirect(new URL("/review?error=1",request.url),303);
 const response=NextResponse.redirect(new URL("/review",request.url),303);
 response.cookies.set("ethio_review_session",createReviewSession(user),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:60*60*8});
 return response;
}