/**
 * Demo Section Layout
 *
 * Provides a consistent layout for all demo pages with sidebar navigation.
 * DemoShell and React Query are loaded only for demo routes.
 *
 * @module app/demo/layout
 */

import dynamic from "next/dynamic";
import { Suspense } from "react";

import { SkeletonList } from "@atlas/ui";

import { DataProviderLayout } from "@/providers/data-provider-layout";

const DemoShell = dynamic(() => import("./components/DemoShell").then((mod) => mod.DemoShell), {
  loading: () => (
    <div className="container mx-auto p-8">
      <SkeletonList count={3} />
    </div>
  ),
});

export const metadata = {
  title: "Atlas Showcase | Demo",
  description: "Demonstration of Atlas platform patterns and primitives",
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProviderLayout>
      <DemoShell>
        <Suspense fallback={<SkeletonList count={3} />}>{children}</Suspense>
      </DemoShell>
    </DataProviderLayout>
  );
}
