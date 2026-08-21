import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zeteo | Lost & Found",
  description: "Zeteo is a campus lost and found platform for reporting, discovering, claiming, and returning lost items.",
  openGraph: {
    title: "Zeteo | Lost & Found",
    description: "Zeteo is a campus lost and found platform for reporting, discovering, claiming, and returning lost items.",
    siteName: "Zeteo",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
