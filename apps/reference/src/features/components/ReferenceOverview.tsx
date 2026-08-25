"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@atlas/ui";

import { analytics } from "@/lib/analytics";
import { useSession } from "@/lib/auth";

import { ReferenceAuthRequired } from "./ReferenceAuthRequired";
import { ReferenceCapabilityMap } from "./ReferenceCapabilityMap";
import { ReferenceLoadingState } from "./ReferenceLoadingState";

export function ReferenceOverview() {
  const session = useSession();
  const { status, user } = session;

  useEffect(() => {
    analytics.page("Reference overview", { path: "/" });
    analytics.track("nav.page_view", { path: "/" });
  }, []);

  if (status === "loading") {
    return <ReferenceLoadingState />;
  }

  if (status === "unauthenticated" || !user) {
    return <ReferenceAuthRequired />;
  }

  const personaLabel =
    user.email === "reference.admin@atlas.local" ? "reference-admin" : "reference-user";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Reference application</h1>
        <p className="text-muted-foreground">
          Executable proof of Atlas runtime application capabilities. Users CRUD is the primary
          domain example; platform routes expose cross-cutting infrastructure without fake SaaS
          domains.
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
            <Badge variant="outline">{personaLabel}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Switch personas in the{" "}
            <Link href="/harness" className="underline">
              harness
            </Link>
            . Runtime diagnostics live on{" "}
            <Link href="/platform" className="underline">
              Platform
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Capability map</h2>
        <p className="text-muted-foreground text-sm">
          What this application demonstrates — each linked capability maps to a real route or
          behavior. CLI, Doctor, generators, CI, and Storybook are validated outside this app.
        </p>
      </div>

      <ReferenceCapabilityMap />
    </div>
  );
}
