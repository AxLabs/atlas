import { notFound } from "next/navigation";

import { getServerConfig } from "@/config/server";

export default function ReferenceLayout({ children }: { children: React.ReactNode }) {
  const config = getServerConfig();

  if (!config.reference.enabled) {
    notFound();
  }

  return children;
}
