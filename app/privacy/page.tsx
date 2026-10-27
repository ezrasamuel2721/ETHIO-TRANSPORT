"use client";

import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main style={{maxWidth:900,margin:"0 auto",padding:"32px 20px",fontFamily:"system-ui,sans-serif",lineHeight:1.7}}>
      <Link href="/" style={{color:"#006b3c",fontWeight:700,textDecoration:"none"}}>← ETHIO TRANSPORT</Link>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated: October 28, 2026</strong></p>
      <p><strong>App:</strong> ETHIO TRANSPORT<br/><strong>Privacy contact:</strong> Ezra Samuel Abebe — ezrasamuel2721@gmail.com</p>

      <h2>1. What ETHIO TRANSPORT does</h2>
      <p>ETHIO TRANSPORT provides public-transport information and service tools for users in Ethiopia, including route and distance information, verified fare information when published by an authorized source, ticket-provider links, emergency contacts, problem reports, trip records, accessibility preferences, and low-data features.</p>

      <h2>2. Information you choose to provide</h2>
      <p>If you submit a problem report, you may provide your name, phone number, location, description, and GPS coordinates. If you save a trusted trip, you may provide an origin, destination, planned time, and notes. These features are optional.</p>

      <h2>3. Location</h2>
      <p>Location is used only when you request location-based features such as capturing a problem location or opening a map. The web application stores saved information locally on your device unless a feature explicitly submits it to the ETHIO TRANSPORT service.</p>

      <h2>4. Local storage and offline data</h2>
      <p>ETHIO TRANSPORT uses device storage for language preferences, saved trips, accessibility preferences, saved reports, and queued submissions needed for low-data/offline operation. Queued submissions are sent when connectivity returns.</p>

      <h2>5. Service providers and external links</h2>
      <p>Ticket booking, mapping, and other external services may open their own websites or applications. Their privacy practices are governed by those providers. ETHIO TRANSPORT does not control their privacy policies or payment processing.</p>

      <h2>6. Verified information</h2>
      <p>Transport information is designed to use official or authorized sources. A fare or other regulated value is not presented as verified when an active verified source record is unavailable.</p>

      <h2>7. Data security</h2>
      <p>ETHIO TRANSPORT uses HTTPS for its online service endpoints. Sensitive credentials are not requested by the public app interface. Users should avoid including passwords, financial credentials, or unnecessary sensitive personal information in free-text reports.</p>

      <h2>8. Data retention and deletion</h2>
      <p>Information saved only on your device can be removed by clearing the app's stored data or deleting the app. Information submitted to the ETHIO TRANSPORT online service is retained only as needed to receive, investigate, respond to, and maintain records of the submitted transport report or trip-proof service. You may contact the privacy contact below to request deletion of information that is no longer required for an active service, legal, security, or accountability purpose.</p>

      <h2>9. Contact</h2>
      <p>For privacy questions or deletion requests concerning information submitted through ETHIO TRANSPORT, contact Ezra Samuel Abebe at ezrasamuel2721@gmail.com.</p>

      <h2>10. Changes</h2>
      <p>This policy may be updated when the service changes. The latest revision date is shown at the top of this page.</p>

      <p style={{marginTop:40}}><Link href="/" style={{color:"#006b3c",fontWeight:700}}>Return to ETHIO TRANSPORT</Link></p>
    </main>
  );
}
