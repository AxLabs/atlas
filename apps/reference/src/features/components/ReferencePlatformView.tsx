"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
import { apiGet } from "@/lib/api";
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

interface SecurityHeadersResponse {
  summary: {
    cspMode: string;
    hstsEnabled: boolean;
    frameAncestors: string;
    xFrameOptions: string;
    baselineHeaderCount: number;
  };
  expectedCspHeader: string | null;
  observedRequestHeaders: Record<string, string>;
  note: string;
}

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium sm:text-right">{value}</span>
    </div>
  );
}

export function ReferencePlatformView() {
  const session = useSession();
  const clientConfig = useConfig();
  const consent = useConsent();
  const { data: platformData, isLoading, isError, error, refetch } = usePlatformDiagnostics();
  const [securityHeaders, setSecurityHeaders] = useState<SecurityHeadersResponse | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  const loadSecurityHeaders = useCallback(async () => {
    setSecurityError(null);
    try {
      const response = await apiGet<SecurityHeadersResponse>("/api/reference/security-headers");
      setSecurityHeaders(response);
    } catch (loadError) {
      setSecurityError(loadError instanceof Error ? loadError.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    if (session.status === "authenticated") {
      void loadSecurityHeaders();
    }
  }, [session.status, loadSecurityHeaders]);

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
          <StatusRow label="Session sampled" value={isReportingActive() ? "yes" : "no"} />
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
              enabled.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sentry</CardTitle>
          <CardDescription>
            Configuration state — no credentials required in reference mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatusRow
            label="Sentry"
            value={clientConfig.sentry.enabled ? "configured" : "not configured"}
          />
          <StatusRow
            label="Environment"
            value={clientConfig.sentry.environment ?? runtime?.environment ?? "—"}
          />
          <StatusRow
            label="Release"
            value={clientConfig.sentry.release ?? runtime?.sentry.release ?? "—"}
          />
          <StatusRow
            label="Google OAuth"
            value={runtime?.authIntegration.googleOAuthConfigured ? "configured" : "not configured"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security headers / CSP</CardTitle>
          <CardDescription>Interpreted configuration and runtime header evidence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {security ? (
            <>
              <StatusRow label="CSP mode" value={security.cspMode} />
              <StatusRow label="HSTS" value={security.hstsEnabled ? "enabled" : "disabled"} />
              <StatusRow label="Frame ancestors" value={security.frameAncestors} />
              <StatusRow label="X-Frame-Options" value={security.xFrameOptions} />
            </>
          ) : null}
          {securityHeaders ? (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Expected CSP header: {securityHeaders.expectedCspHeader ?? "none (CSP off)"}
              </p>
              {Object.keys(securityHeaders.observedRequestHeaders).length > 0 ? (
                <ul className="space-y-1">
                  {Object.entries(securityHeaders.observedRequestHeaders).map(([key, value]) => (
                    <li key={key}>
                      <code>{key}</code>: <span className="break-all">{value}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No security headers on inbound API request.</p>
              )}
              <p className="text-muted-foreground text-xs">{securityHeaders.note}</p>
            </div>
          ) : null}
          {securityError ? <p className="text-destructive text-sm">{securityError}</p> : null}
          <Button type="button" variant="outline" size="sm" onClick={() => loadSecurityHeaders()}>
            Refresh header evidence
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
