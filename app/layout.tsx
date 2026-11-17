import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Merchant Lens", description: "Order history analytics for merchant teams" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
