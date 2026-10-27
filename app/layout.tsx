import type { Metadata } from "next";
import "./globals.css";
import ServiceWorkerRegister from "./ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "ETHIO TRANSPORT",
  description: "Ethiopia's public transport information and service platform",
  manifest: "/manifest.webmanifest",
  themeColor: "#006b3c",
  icons: { icon: "/icons/icon.svg" },
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="am"><body><ServiceWorkerRegister />{children}</body></html>;
}
