"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Provider = { code:string; name:string; checkout_mode:string; capabilities:Record<string,boolean> };

function getCustomerRef() {
  const key = "ethio_transport_customer_ref";
  let value = localStorage.getItem(key);
  if (!value) {
    value = "ETU_" + crypto.randomUUID().replace(/-/g,"");
    localStorage.setItem(key,value);
  }
  return value;
}

export default function PaymentPage() {
  const [providers,setProviders] = useState<Provider[]>([]);
  const [provider,setProvider] = useState("telebirr");
  const [purpose,setPurpose] = useState<"membership"|"bus_ticket">("membership");
  const [amount,setAmount] = useState(250);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [transactionId,setTransactionId] = useState("");

  useEffect(() => {
    fetch("/api/payments/providers").then(r=>r.json()).then(d=>{
      if (Array.isArray(d.providers)) setProviders(d.providers);
    }).catch(()=>{});
    (window as any).handleinitDataCallback = function() {
      setMessage("የክፍያ ሂደቱ ተመልሷል። የserver ማረጋገጫ እየተጠበቀ ነው።");
    };
  },[]);

  useEffect(() => { if (purpose === "membership") setAmount(250); },[purpose]);

  async function pay() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/payments/create", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({provider,purpose,amount,customerRef:getCustomerRef()})
      });
      const data = await response.json();
      if (!response.ok && response.status !== 202) throw new Error(data.error || "Payment could not start.");
      setTransactionId(data.transactionId || "");
      if (data.rawRequest && (window as any).consumerapp?.evaluate) {
        (window as any).consumerapp.evaluate(JSON.stringify({
          functionName:"js_fun_start_pay",
          params:{rawRequest:String(data.rawRequest).trim(),functionCallBackName:"handleinitDataCallback"}
        }));
        setMessage("Telebirr ክፍያ ተጀምሯል። በTelebirr ውስጥ ያረጋግጡ።");
      } else if (data.receiveCode) {
        setMessage("የTelebirr የክፍያ መረጃ ተዘጋጅቷል። ለPlay Store የAndroid SDK ድልድይ ሲገናኝ ከአፑ ውስጥ ይከፈታል።");
      } else {
        setMessage(data.message || "የክፍያ አጋር ገና ለምርት አልተዋቀረም።");
      }
    } catch(error:any) {
      setMessage(error?.message || "ክፍያው አልተጀመረም።");
    } finally { setBusy(false); }
  }

  return <main style={{minHeight:"100vh",padding:"28px 16px",background:"linear-gradient(180deg,#071c16,#0b3027)",color:"#fff"}}>
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <a href="/" style={{color:"#d6c46a",textDecoration:"none"}}>← ETHIO TRANSPORT</a>
      <section style={{marginTop:20,padding:24,borderRadius:24,background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.12)"}}>
        <div style={{fontSize:12,letterSpacing:2,opacity:.75}}>SECURE PAYMENT CENTER</div>
        <h1 style={{margin:"8px 0 6px"}}>ክፍያ ይፈጽሙ</h1>
        <p style={{opacity:.82,marginTop:0}}>ከETHIO TRANSPORT ሳይወጡ የተፈቀደ የክፍያ መንገድ ይምረጡ።</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12,margin:"18px 0"}}>
          <button onClick={()=>setPurpose("membership")} style={card(purpose==="membership")}>የዓመታዊ አገልግሎት<br/><b>250 ETB / 1 ዓመት</b></button>
          <button onClick={()=>setPurpose("bus_ticket")} style={card(purpose==="bus_ticket")}>የባስ ቲኬት<br/><b>የተመረጠውን ዋጋ</b></button>
        </div>
        <h3 style={{marginBottom:10}}>የክፍያ መንገድ</h3>
        <div style={{display:"grid",gap:10}}>
          {providers.map(p=><button key={p.code} onClick={()=>setProvider(p.code)} style={providerCard(provider===p.code)}>
            <span style={{fontSize:22}}>{p.code==="telebirr"?"📱":p.code==="card"?"💳":"🏦"}</span>
            <span style={{textAlign:"left"}}><b>{p.name}</b><small style={{display:"block",opacity:.7}}>{p.checkout_mode==="native"?"App / native checkout":"Online checkout"}</small></span>
            <span style={{marginLeft:"auto"}}>{provider===p.code?"✓":""}</span>
          </button>)}
        </div>
        {purpose==="bus_ticket" && <label style={{display:"block",marginTop:16}}>የቲኬት መጠን
          <input type="number" min="1" max="1000000" value={amount} onChange={e=>setAmount(Number(e.target.value))} style={input}/>
        </label>}
        <button disabled={busy} onClick={pay} style={{width:"100%",marginTop:20,padding:"15px 18px",border:0,borderRadius:14,fontWeight:800,fontSize:16,cursor:busy?"wait":"pointer"}}>{busy?"እየተዘጋጀ ነው…":"🔐 ክፍያ ጀምር"}</button>
        {message && <div style={{marginTop:16,padding:14,borderRadius:12,background:"rgba(255,255,255,.08)"}}>{message}</div>}
        {transactionId && <div style={{marginTop:12,fontSize:12,opacity:.7}}>Transaction: {transactionId}</div>}
      </section>
      <p style={{fontSize:12,opacity:.55,marginTop:14}}>ETHIO TRANSPORT የሐሰት የክፍያ ማረጋገጫ አያደርግም። ክፍያ የሚፈጸመው በተፈቀደ የpayment provider ግንኙነት ብቻ ነው።</p>
    </div>
  </main>;
}

const card=(active:boolean):CSSProperties=>({padding:16,borderRadius:16,border:"1px solid "+(active?"#d6c46a":"rgba(255,255,255,.14)"),background:active?"rgba(214,196,106,.12)":"rgba(255,255,255,.05)",color:"#fff",textAlign:"left"});
const providerCard=(active:boolean):CSSProperties=>({display:"flex",alignItems:"center",gap:12,padding:14,borderRadius:14,border:"1px solid "+(active?"#d6c46a":"rgba(255,255,255,.14)"),background:active?"rgba(214,196,106,.10)":"rgba(255,255,255,.04)",color:"#fff"});
const input:CSSProperties={width:"100%",marginTop:8,padding:12,borderRadius:10,border:"1px solid rgba(255,255,255,.18)",background:"rgba(0,0,0,.18)",color:"#fff"};
