"use client";

import Link from "next/link";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@atlas/ui";

import { FeatureFlags, FeatureGuard, useFlag, useKillSwitch } from "@/lib/feature-flags";

export function ReferenceFeatureFlagDemo() {
  const isEnabled = useFlag(FeatureFlags.EXAMPLE_FEATURE);
  const isKilled = useKillSwitch(FeatureFlags.EXAMPLE_FEATURE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature flags</CardTitle>
        <CardDescription>
          <code>example_feature</code> gates an optional export action on the users list. Toggle via{" "}
          <Link href="/__flags" className="underline">
            flag overrides
          </Link>{" "}
          or <code>?ff_example_feature=1</code> in development.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant={isEnabled ? "default" : "outline"}>
            Flag: {isEnabled ? "enabled" : "disabled"}
          </Badge>
          {isKilled ? <Badge variant="destructive">Kill switch active</Badge> : null}
        </div>

        <FeatureGuard
          feature={FeatureFlags.EXAMPLE_FEATURE}
          fallback={
            <Alert>
              <AlertTitle>Export unavailable</AlertTitle>
              <AlertDescription>
                Enable <code>example_feature</code> to show the export action on the users list.
              </AlertDescription>
            </Alert>
          }
          killedFallback={
            <Alert variant="destructive">
              <AlertTitle>Export disabled by kill switch</AlertTitle>
              <AlertDescription>
                <code>kill_example_feature</code> forcibly disables this capability regardless of
                other sources.
              </AlertDescription>
            </Alert>
          }
        >
          <Alert>
            <AlertTitle>Export enabled</AlertTitle>
            <AlertDescription>
              The users list shows an export action when this flag is on. Server routes must also
              enforce flags at execution boundaries.
            </AlertDescription>
          </Alert>
        </FeatureGuard>
      </CardContent>
    </Card>
  );
}
