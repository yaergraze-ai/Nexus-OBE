import type { Metadata } from "next";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NEXUS OBE · Portal Akademik", template: "%s | NEXUS OBE" },
  description: "Smart Academic & Outcome-Based Education Portal · Fakultas Teknik",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
