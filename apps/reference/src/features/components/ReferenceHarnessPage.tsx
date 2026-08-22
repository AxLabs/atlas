"use client";

import Link from "next/link";

import { useSession } from "@/lib/auth";

import { AuthorizationDemoPanel } from "./AuthorizationDemoPanel";
import { ReferenceHarnessPanel } from "./ReferenceHarnessPanel";

export function ReferenceHarnessPage() {
  const session = useSession();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Developer harness</h1>
        <p className="text-muted-foreground">
          Select deterministic auth personas and API scenarios without Google OAuth or external
          services. These controls are separate from the product-like reference application — use
          them to simulate states, then navigate the{" "}
          <Link href="/" className="underline">
            overview
          </Link>{" "}
          or{" "}
          <Link href="/users" className="underline">
            users
          </Link>{" "}
          flows.
        </p>
      </header>
      <ReferenceHarnessPanel session={session} />
      <AuthorizationDemoPanel session={session} />
      <p className="text-muted-foreground text-sm">
        <Link href="/authorization" className="underline">
          Server-protected route demo
        </Link>{" "}
        — requires <code>users.update</code> (reference-admin).
      </p>
    </div>
  );
}
