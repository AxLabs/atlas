"use client";

import Link from "next/link";
import { useEffect } from "react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@atlas/ui";

import { analytics } from "@/lib/analytics";
import { useSession } from "@/lib/auth";
import { hasClientPermission, permissions } from "@/lib/authz";

import { ReferenceAuthRequired } from "./ReferenceAuthRequired";
import { ReferenceFeatureFlagDemo } from "./ReferenceFeatureFlagDemo";
import { ReferenceObservabilityDemo } from "./ReferenceObservabilityDemo";

export function ReferenceOverview() {
  const session = useSession();
  const { status, user, permissions: sessionPermissions } = session;

  useEffect(() => {
    analytics.page("Reference overview", { path: "/reference" });
    analytics.track("nav.page_view", { path: "/reference" });
  }, []);

  if (status === "loading") {
    return <p className="text-muted-foreground text-sm">Loading session…</p>;
  }

  if (status === "unauthenticated" || !user) {
    return <ReferenceAuthRequired />;
  }

  const canReadUsers = hasClientPermission(sessionPermissions, permissions.users.read);
  const canCreateUsers = hasClientPermission(sessionPermissions, permissions.users.create);
  const canUpdateUsers = hasClientPermission(sessionPermissions, permissions.users.update);
  const canDeleteUsers = hasClientPermission(sessionPermissions, permissions.users.delete);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Reference application</h1>
        <p className="text-muted-foreground">
          A coherent Atlas consumer journey — typed API contracts, React Query, forms,
          authorization, and deterministic failure states without external services.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current persona</CardTitle>
          <CardDescription>
            Session uses the same contract as production auth integrations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{user.name}</span>
            <Badge variant="secondary">{user.email}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Switch personas in the{" "}
            <Link href="/reference/harness" className="underline">
              harness
            </Link>{" "}
            to compare reference-user and reference-admin behavior.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capabilities</CardTitle>
          <CardDescription>
            Resolved permissions for this session (presentation only).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2 text-sm">
            <CapabilityRow label="View users" allowed={canReadUsers} />
            <CapabilityRow label="Create users" allowed={canCreateUsers} />
            <CapabilityRow label="Update users" allowed={canUpdateUsers} />
            <CapabilityRow label="Delete users" allowed={canDeleteUsers} />
          </ul>
          {canReadUsers ? (
            <Button render={<Link href="/reference/users" />}>Go to users</Button>
          ) : null}
        </CardContent>
      </Card>

      <ReferenceFeatureFlagDemo />
      <ReferenceObservabilityDemo />
    </div>
  );
}

function CapabilityRow({ label, allowed }: { label: string; allowed: boolean }) {
  return (
    <li className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <Badge variant={allowed ? "default" : "outline"}>{allowed ? "Allowed" : "Denied"}</Badge>
    </li>
  );
}
