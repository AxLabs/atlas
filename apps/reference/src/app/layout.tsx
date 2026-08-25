import "@atlas/ui/globals.css";

import { Inter } from "next/font/google";

import { getThemeBootScriptContent } from "@atlas/ui/theme-boot";

import { GlobalErrorHandler } from "@/components/GlobalErrorHandler";
import { ReferenceShell } from "@/features";
import { getNonce } from "@/lib/security/nonce";
import { MainProvider } from "@/providers";
import { DataProviderLayout } from "@/providers/data-provider-layout";

import type { Metadata } from "next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "Atlas Reference Application",
  description:
    "Executable reference application demonstrating Atlas architecture in a realistic product",
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
          <DataProviderLayout>
            <ReferenceShell>{children}</ReferenceShell>
          </DataProviderLayout>
        </MainProvider>
      </body>
    </html>
  );
}
