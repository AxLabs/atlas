import "@atlas/ui/globals.css";

import { Inter } from "next/font/google";

import { getThemeBootScriptContent } from "@atlas/ui/theme-boot";

import { GlobalErrorHandler } from "@/components/GlobalErrorHandler";
import { getNonce } from "@/lib/security/nonce";
import { MainProvider } from "@/providers";

import type { Metadata } from "next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "Frontend Platform",
  description: "Enterprise frontend platform built with Next.js",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = await getNonce();

  return (
    <html lang="en" suppressHydrationWarning className={`font-sans ${inter.variable}`}>
      <head>
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: getThemeBootScriptContent(),
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <MainProvider nonce={nonce}>
          <GlobalErrorHandler />
          {children}
        </MainProvider>
      </body>
    </html>
  );
}
