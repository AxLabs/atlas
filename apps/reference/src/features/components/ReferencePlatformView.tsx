"use client";

import Link from "next/link";
import { useCallback } from "react";

import { useConsent } from "@atlas/consent";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@atlas/ui";

import { useConfig } from "@/config";
import { analytics, getAnalyticsStatus } from "@/lib/analytics";
import { useSession } from "@/lib/auth";
import { hasClientPermission, permissions } from "@/lib/authz";
import { t } from "@/lib/i18n";
import { notify } from "@/lib/notifications";
import { getLatestWebVitals, isReportingActive } from "@/lib/telemetry/webVitals";

import { usePlatformDiagnostics } from "../queries";

import { ReferenceAuthRequired } from "./ReferenceAuthRequired";
import { ReferenceFeatureFlagDemo } from "./ReferenceFeatureFlagDemo";
import { ReferenceLoadingState } from "./ReferenceLoadingState";
import { ReferenceObservabilityDemo } from "./ReferenceObservabilityDemo";

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium sm:text-right">{value}</span>
    </div>
  );
}

function SentryStatusRows({
  label,
  status,
}: {
  label: string;
  status: { configured: boolean; environment: string | null; release: string | null };
}) {
  return (
    <>
      <StatusRow
        label={`${label} Sentry`}
        value={status.configured ? "configured" : "not configured"}
      />
      <StatusRow label={`${label} environment`} value={status.environment ?? "—"} />
      <StatusRow label={`${label} release`} value={status.release ?? "—"} />
    </>
  );
}

export function ReferencePlatformView() {
  const session = useSession();
  const clientConfig = useConfig();
  const consent = useConsent();
  const { data: platformData, isLoading, isError, error, refetch } = usePlatformDiagnostics();

  const emitAnalyticsEvent = useCallback(() => {
    analytics.track("feature.used", { feature: "reference-platform-analytics-demo" });
    notify.success("Reference analytics event emitted", {
      description: getAnalyticsStatus().enabled
        ? "Event sent through the analytics contract."
        : "Contract invoked; noop adapter or consent may suppress vendor delivery.",
    });
  }, []);

  if (session.status === "loading" || isLoading) {
    return <ReferenceLoadingState />;
  }

  if (session.status === "unauthenticated") {
    return <ReferenceAuthRequired />;
  }

  const analyticsStatus = getAnalyticsStatus();
  const webVitalsLatest = getLatestWebVitals();
  const runtime = platformData?.runtime;
  const security = platformData?.security;
  const sessionPermissions = session.permissions ?? [];
  const personaLabel = (() => {
    if (session.user?.email === "reference.admin@atlas.local") {
      return "reference-admin";
    }
    if (session.user?.email) {
      return "reference-user";
    }
    return "anonymous";
  })();

  const consentStatusLabel = (() => {
    if (consent.analyticsGranted) {
      return "granted";
    }
    if (consent.isEnabled && !consent.hasResolvedConsent) {
      return "unknown";
    }
    return "denied";
  })();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("platform.title")}</h1>
        <p className="text-muted-foreground">{t("platform.description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Runtime</CardTitle>
          <CardDescription>Safe public configuration via validated config facade.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isError ? (
            <p className="text-destructive text-sm">
              {error?.shape?.userMessage ?? "Failed to load runtime diagnostics."}
              <Button
                type="button"
                variant="link"
                className="ml-2 h-auto p-0"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </p>
          ) : null}
          {runtime ? (
            <>
              <StatusRow label="Application" value={<code>{runtime.application}</code>} />
              <StatusRow label="Environment" value={runtime.environment} />
              <StatusRow
                label="App URL"
                value={<code className="break-all">{runtime.appUrl}</code>}
              />
              <StatusRow label="API mode" value={runtime.apiMode} />
              <StatusRow label="Build ID" value={runtime.buildId ?? "—"} />
              <StatusRow
                label="Reference mode"
                value={runtime.referenceMode ? "enabled" : "disabled"}
              />
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>Current session and reference persona.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatusRow label="Session" value={session.status} />
          <StatusRow label="Persona" value={personaLabel} />
          <StatusRow label="Email" value={session.user?.email ?? "—"} />
          <p className="text-muted-foreground text-sm">
            Change personas in the{" "}
            <Link href="/harness" className="underline">
              harness
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authorization</CardTitle>
          <CardDescription>Resolved permissions for the current principal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionPermissions.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {sessionPermissions.map((permission) => (
                <li key={permission}>
                  <Badge variant="secondary">
                    <code>{permission}</code>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No permissions resolved.</p>
          )}
          <p className="text-muted-foreground text-sm">
            Full enforcement demo:{" "}
            <Link href="/authorization" className="underline">
              Authorization
            </Link>
          </p>
          <div className="text-sm">
            <span className="text-muted-foreground">users.delete (client): </span>
            <Badge
              variant={
                hasClientPermission(sessionPermissions, permissions.users.delete)
                  ? "default"
                  : "outline"
              }
            >
              {hasClientPermission(sessionPermissions, permissions.users.delete)
                ? "granted"
                : "denied"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <ReferenceFeatureFlagDemo />

      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
          <CardDescription>
            Effective adapter and consent state from the public contract.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusRow
            label="Adapters"
            value={
              analyticsStatus.adapters.length > 0 ? analyticsStatus.adapters.join(", ") : "noop"
            }
          />
          <StatusRow label="Consent" value={consentStatusLabel} />
          <StatusRow label="Debug" value={analyticsStatus.debug ? "enabled" : "disabled"} />
          <StatusRow label="Effective" value={analyticsStatus.enabled ? "enabled" : "disabled"} />
          <StatusRow
            label="PostHog configured"
            value={runtime?.analytics.posthogConfigured ? "yes" : "no"}
          />
          <StatusRow label="GA configured" value={runtime?.analytics.gaConfigured ? "yes" : "no"} />
          <Button type="button" variant="outline" onClick={emitAnalyticsEvent}>
            Emit reference analytics event
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consent</CardTitle>
          <CardDescription>Effective consent state from @atlas/consent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatusRow label="Layer enabled" value={consent.isEnabled ? "yes" : "no"} />
          <StatusRow label="Analytics granted" value={consent.analyticsGranted ? "yes" : "no"} />
          <p className="text-muted-foreground text-sm">
            Manage preferences on{" "}
            <Link href="/settings" className="underline">
              Settings
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <ReferenceObservabilityDemo />

      <Card>
        <CardHeader>
          <CardTitle>Web Vitals</CardTitle>
          <CardDescription>Reporter configuration and optional local observations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatusRow
            label="Reporting"
            value={clientConfig.webVitals.enabled ? "enabled" : "disabled"}
          />
          <StatusRow label="Sample rate" value={String(clientConfig.webVitals.sampleRate)} />
          <StatusRow
            label="Endpoint"
            value={<code className="break-all">{clientConfig.webVitals.endpoint}</code>}
          />
          <StatusRow label="Session active" value={isReportingActive() ? "yes" : "no"} />
          {Object.keys(webVitalsLatest).length > 0 ? (
            <ul className="space-y-1 text-sm">
              {Object.entries(webVitalsLatest).map(([name, metric]) => (
                <li key={name}>
                  <code>{name}</code>: {metric.value} ({metric.rating})
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No local measurements yet. Navigate the app to collect vitals when reporting is
              enabled and the session is sampled.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sentry</CardTitle>
          <CardDescription>
            Client and server configuration state — no credentials are shown.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {runtime ? (
            <>
              <SentryStatusRows label="Client" status={runtime.sentry.client} />
              <SentryStatusRows label="Server" status={runtime.sentry.server} />
            </>
          ) : (
            <>
              <StatusRow
                label="Client Sentry"
                value={clientConfig.sentry.enabled ? "configured" : "not configured"}
              />
              <StatusRow
                label="Client environment"
                value={clientConfig.sentry.environment ?? clientConfig.app.env}
              />
              <StatusRow
                label="Client release"
                value={clientConfig.sentry.release ?? clientConfig.app.buildId ?? "—"}
              />
            </>
          )}
          <StatusRow
            label="Google OAuth"
            value={runtime?.authIntegration.googleOAuthConfigured ? "configured" : "not configured"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security policy</CardTitle>
          <CardDescription>
            Interpreted security configuration from validated runtime policy — not observed response
            headers. Automated E2E verifies actual HTTP response headers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {security ? (
            <>
              <StatusRow label="CSP mode" value={security.cspMode} />
              <StatusRow label="HSTS" value={security.hstsEnabled ? "enabled" : "disabled"} />
              <StatusRow label="Frame ancestors" value={security.frameAncestors} />
              <StatusRow label="X-Frame-Options" value={security.xFrameOptions} />
              <StatusRow label="Referrer-Policy" value={security.referrerPolicy} />
              <StatusRow label="Permissions-Policy" value={security.permissionsPolicy} />
              <StatusRow
                label="Baseline headers"
                value={`${security.baselineHeaderCount} configured`}
              />
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Security policy unavailable.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
