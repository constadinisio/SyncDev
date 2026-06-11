import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./Providers";

export const metadata: Metadata = {
  title: "SyncDev",
  description: "Real-time collaborative code editor powered by Yjs CRDTs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface-50 text-surface-800 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
