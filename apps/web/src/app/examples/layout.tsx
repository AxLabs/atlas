import dynamic from "next/dynamic";
import { Suspense } from "react";

import { SkeletonList } from "@atlas/ui";

import { DataProviderLayout } from "@/providers/data-provider-layout";

const ExamplesShell = dynamic(
  () => import("./components/ExamplesShell").then((mod) => mod.ExamplesShell),
  {
    loading: () => (
      <div className="container mx-auto p-8">
        <SkeletonList count={3} />
      </div>
    ),
  }
);

export const metadata = {
  title: "Atlas Examples",
  description: "Reference patterns for data fetching and forms",
};

export default function ExamplesLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProviderLayout>
      <ExamplesShell>
        <Suspense fallback={<SkeletonList count={3} />}>{children}</Suspense>
      </ExamplesShell>
    </DataProviderLayout>
  );
}
