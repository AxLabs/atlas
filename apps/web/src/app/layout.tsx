import "@atlas/ui/globals.css";

import { Toaster } from "@atlas/ui";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { MainProvider } from "@/providers";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Frontend Platform",
  description: "Enterprise frontend platform built with Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <MainProvider>
          {children}
          <Toaster />
        </MainProvider>
      </body>
    </html>
  );
}
