"use client";

import Link from "next/link";

import { useSession } from "@/lib/auth";

import { AuthorizationDemoPanel } from "./AuthorizationDemoPanel";
import { ReferenceHarnessPanel } from "./ReferenceHarnessPanel";

export function ReferencePageClient() {
  const session = useSession();

  return (
    <>
      <ReferenceHarnessPanel session={session} />
      <AuthorizationDemoPanel session={session} />
      <p className="text-muted-foreground text-sm">
        <Link href="/reference/authorization" className="underline">
          Server-protected route demo
        </Link>{" "}
        — requires <code>users.update</code> (reference-admin).
      </p>
    </>
  );
}
