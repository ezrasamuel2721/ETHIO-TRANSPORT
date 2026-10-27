import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ETHIO TRANSPORT",
  description: "Ethiopia's public transport information and service platform",
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="am"><body>{children}</body></html>;
}
