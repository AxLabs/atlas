import "@thedanielmark/ui/styles";

import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { MainProvider } from "@/providers";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={inter.className}>
        <MainProvider>{children}</MainProvider>
      </body>
    </html>
  );
}
