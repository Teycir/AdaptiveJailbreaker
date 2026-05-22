import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adaptive Jailbreaker — Automated AI Red-Teaming",
  description: "Automated red-teaming research tool. Authorized security research only.",
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=Share+Tech+Mono&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-dark-bg text-zinc-100 font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
