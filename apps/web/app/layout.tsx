import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AJAR — Adaptive Jailbreak Auditor & Red-teamer",
  description: "Automated AI red-teaming research tool. Authorized security research only.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased" style={{ background: "var(--dark-bg)", color: "var(--dark-text)", fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}>
        <div className="scan-line" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
