import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/providers/Providers";
import Navbar from "@/components/Navbar";
import { decimaMono } from "./fonts";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Facemelt - Leverage Trading AMM on Solana",
  description: "The first AMM on Solana featuring leverage trading",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${decimaMono.variable} font-mono antialiased bg-background text-foreground`}
      >
        <Providers>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-grow">
              {children}
            </main>
          </div>
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
