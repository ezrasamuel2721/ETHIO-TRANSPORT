"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister(){
  useEffect(()=>{
    if(!("serviceWorker" in navigator)) return;
    const params = new URLSearchParams(window.location.search);
    const nativeRecovery = params.get("native_recovery") === "1";

    if(nativeRecovery){
      let cancelled = false;
      const recover = async()=>{
        try{
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration)=>registration.unregister()));
          if("caches" in window){
            const keys = await caches.keys();
            await Promise.all(keys.map((key)=>caches.delete(key)));
          }
        }catch{}
        if(!cancelled && sessionStorage.getItem("ethio_transport_native_recovered") !== "1"){
          sessionStorage.setItem("ethio_transport_native_recovered","1");
          window.location.replace("/?app_version=1.0.8&native_recovery=0&recovery="+Date.now());
        }
      };
      recover();
      return()=>{cancelled=true};
    }

    if(sessionStorage.getItem("ethio_transport_native_recovered") === "1"){
      sessionStorage.removeItem("ethio_transport_native_recovered");
    }

    navigator.serviceWorker.register("/sw.js?v=20261031-4",{updateViaCache:"none"}).catch(()=>{});
  },[]);
  return null;
}
