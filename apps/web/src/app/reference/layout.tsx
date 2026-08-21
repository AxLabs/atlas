import { notFound } from "next/navigation";

import { getServerConfig } from "@/config/server";
import { DataProviderLayout } from "@/providers/data-provider-layout";

export default function ReferenceLayout({ children }: { children: React.ReactNode }) {
  const config = getServerConfig();

  if (!config.reference.enabled) {
    notFound();
  }

  return <DataProviderLayout>{children}</DataProviderLayout>;
}
