import { cookies } from "next/headers";
import { verifyReviewSession, reviewSetupReady } from "../../lib/review-auth";

const sections = [
["01","የሕዝብ አገልግሎት","Public service purpose, scope, accessibility and actual user workflows."],
["02","ታሪፍና የመጓጓዣ መረጃ","Distance-based fare workflow, source traceability, effective dates and verification status."],
["03","መንገድና ትኬት","Route discovery, ticket gateways, operators and source attribution."],
["04","ቅሬታና ሪፖርት","Complaint submission, reference number, routing and evidence trail."],
["05","ደህንነትና ግላዊነት","Authentication, least privilege, privacy, secrets and auditability."],
["06","ቴክኒክ","Architecture, deployment, code review, API integration and reliability."],
["07","የመረጃ አስተዳደር","Publisher, publication date, effective date, update time and status."],
["08","ሕግና ተቋማዊ ግምገማ","Evidence prepared for regulators, authorities, partners and institutional reviewers."],
["09","የንግድ / Startup ግምገማ","Problem, solution, market, sustainability, impact and scalability."],
["10","ማስረጃ ክፍል","Review documents, policies, architecture notes and implementation evidence."]
] as const;

export default async function ReviewPage() {
 const token=(await cookies()).get("ethio_review_session")?.value;
 const session=verifyReviewSession(token);
 if(!session) return <main style={styles.shell}><section style={styles.loginCard}>
  <div style={styles.kicker}>ETHIO TRANSPORT • OFFICIAL REVIEW ACCESS</div>
  <h1 style={styles.h1}>የተቋማት ግምገማ መግቢያ</h1>
  <p style={styles.muted}>ይህ የሕዝብ መግቢያ አይደለም። ለተፈቀደላቸው የመንግሥት፣ የተቆጣጣሪ፣ የቴክኒክ ወይም የStartup ገምጋሚዎች ብቻ ነው።</p>
  {!reviewSetupReady()?<div style={styles.warning}>የግምገማ መዳረሻ ገና በVercel ላይ አልተዋቀረም። REVIEW_ACCESS_SECRET እና REVIEW_USERS_JSON ከተዘጋጁ በኋላ ይህ ገጽ ይከፈታል።</div>:
  <form action="/api/review/login" method="post" style={styles.form}><label>የገምጋሚ መለያ<input name="username" required autoComplete="username" style={styles.input}/></label><label>የይለፍ ቃል<input name="password" required type="password" autoComplete="current-password" style={styles.input}/></label><button style={styles.primary}>ወደ ግምገማ ግባ</button></form>}
  <p style={styles.note}>Review accounts are read-only and should be issued individually to authorized institutions. Do not share an administrator password.</p>
 </section></main>;

 return <main style={styles.shell}>
  <header style={styles.header}><div><div style={styles.kicker}>ETHIO TRANSPORT • OFFICIAL REVIEW ACCESS</div><h1 style={styles.h1}>የተቋማት ምዘናና ግምገማ መድረክ</h1><p style={styles.muted}>ተቋሙ: <strong>{session.institution}</strong> • ሚና: {session.role}</p></div><form action="/api/review/logout" method="post"><button style={styles.secondary}>ውጣ</button></form></header>
  <section style={styles.notice}><strong>የግምገማ መርህ:</strong> ይህ ገጽ የተለያዩ ተቋማት ሊመረምሩባቸው የሚችሉ ዋና መስፈርቶችን በአንድ ቦታ ያደራጃል። የሕዝብ አገልግሎቱ እና ዋናው የETHIO TRANSPORT ዲዛይን አልተቀየረም።</section>
  <div style={styles.grid}>{sections.map(([no,title,desc])=><article key={no} style={styles.card}><span style={styles.number}>{no}</span><h2 style={styles.h2}>{title}</h2><p style={styles.muted}>{desc}</p><span style={styles.status}>የግምገማ ክፍል</span></article>)}</div>
  <section style={styles.card}><h2 style={styles.h2}>የተግባር ግምገማ</h2><p style={styles.muted}>ገምጋሚው ዋናውን አፕ በተለየ መንገድ ለመሞከር የPublic Service መግቢያን ይጠቀማል። የReview Access መለያው የአስተዳዳሪ መብት አይኖረውም።</p><div style={styles.actions}><a href="/" style={styles.primaryLink}>ዋናውን ETHIO TRANSPORT ክፈት →</a><a href="/privacy" style={styles.secondaryLink}>Privacy Policy →</a></div></section>
 </main>;
}
const styles:Record<string,React.CSSProperties>={shell:{minHeight:"100vh",padding:"32px 20px",background:"linear-gradient(180deg,#06130d,#f5f7f6 55%)",color:"#12231b"},loginCard:{maxWidth:620,margin:"8vh auto",background:"#fff",borderRadius:24,padding:32,boxShadow:"0 20px 70px rgba(0,0,0,.18)"},header:{maxWidth:1180,margin:"0 auto 22px",display:"flex",justifyContent:"space-between",gap:20,alignItems:"flex-start",background:"#fff",borderRadius:22,padding:26},kicker:{fontSize:12,fontWeight:900,letterSpacing:1.4,color:"#006b3c"},h1:{fontSize:"clamp(28px,5vw,46px)",margin:"8px 0 10px"},h2:{fontSize:21,margin:"8px 0"},muted:{color:"#52645b",lineHeight:1.7},note:{fontSize:12,color:"#718078",marginTop:20,lineHeight:1.6},warning:{background:"#fff6d8",border:"1px solid #e7cf72",borderRadius:14,padding:16,lineHeight:1.6},notice:{maxWidth:1180,margin:"0 auto 18px",background:"#e9f7ef",border:"1px solid #b9dfc8",borderRadius:18,padding:18,lineHeight:1.7},form:{display:"grid",gap:14,marginTop:20},input:{display:"block",width:"100%",boxSizing:"border-box",padding:"13px 14px",marginTop:6,border:"1px solid #cbd7d1",borderRadius:12,fontSize:16},primary:{border:0,borderRadius:12,padding:"13px 18px",background:"#006b3c",color:"#fff",fontWeight:800,cursor:"pointer"},secondary:{border:"1px solid #cbd7d1",borderRadius:12,padding:"11px 15px",background:"#fff",fontWeight:800,cursor:"pointer"},grid:{maxWidth:1180,margin:"0 auto 18px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:14},card:{background:"#fff",border:"1px solid #e0e7e3",borderRadius:18,padding:20,boxShadow:"0 8px 30px rgba(20,40,30,.06)"},number:{fontSize:12,fontWeight:900,color:"#b18a00"},status:{display:"inline-block",marginTop:10,padding:"5px 9px",borderRadius:999,background:"#eef6f1",color:"#006b3c",fontSize:11,fontWeight:800},actions:{display:"flex",gap:10,flexWrap:"wrap",marginTop:16},primaryLink:{display:"inline-block",padding:"12px 16px",borderRadius:12,background:"#006b3c",color:"#fff",textDecoration:"none",fontWeight:800},secondaryLink:{display:"inline-block",padding:"12px 16px",borderRadius:12,border:"1px solid #cbd7d1",color:"#17372a",textDecoration:"none",fontWeight:800}};
