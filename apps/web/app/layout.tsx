import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AJAR — Adaptive Jailbreak Auditor",
  description:
    "Automated red-teaming research tool. Authorized security research only.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
