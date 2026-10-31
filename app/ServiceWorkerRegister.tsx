"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister(){
  useEffect(()=>{
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("/sw.js?v=20261031-3",{updateViaCache:"none"}).catch(()=>{});
    }
  },[]);
  return null;
}
