"use client";

/**
 * Consent demo page — local testing for @atlas/consent integration.
 */

import { Cookie, RefreshCw, Settings, Zap } from "lucide-react";

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

import { analytics } from "@/lib/analytics";
import { getConsentConfig } from "@/lib/consent/config";

export default function ConsentDemoPage() {
  const consent = useConsent();
  const consentConfig = getConsentConfig();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Consent</h1>
        <p className="text-muted-foreground mt-2">
          Inspect consent state and test analytics gating. Enable with{" "}
          <code className="text-sm">NEXT_PUBLIC_CONSENT_ENABLED=true</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cookie className="h-5 w-5" />
            Current state
          </CardTitle>
          <CardDescription>Live values from useConsent()</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span>Consent layer enabled</span>
            <Badge variant={consent.isEnabled ? "default" : "secondary"}>
              {consent.isEnabled ? "yes" : "no"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Config enabled (env)</span>
            <Badge variant={consentConfig.enabled ? "default" : "secondary"}>
              {consentConfig.enabled ? "yes" : "no"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Consent resolved</span>
            <Badge variant={consent.hasResolvedConsent ? "default" : "outline"}>
              {consent.hasResolvedConsent ? "yes" : "no"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Analytics granted</span>
            <Badge variant={consent.analyticsGranted ? "default" : "destructive"}>
              {consent.analyticsGranted ? "yes" : "no"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Marketing granted</span>
            <Badge variant={consent.marketingGranted ? "default" : "secondary"}>
              {consent.marketingGranted ? "yes" : "no"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Preferences granted</span>
            <Badge variant={consent.preferencesGranted ? "default" : "secondary"}>
              {consent.preferencesGranted ? "yes" : "no"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Test consent UI and analytics integration</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => consent.openPreferences()}>
            <Settings className="mr-2 h-4 w-4" />
            Open preferences
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              analytics.track("custom.event", {
                name: "demo_consent_test",
                data: { source: "demo/consent" },
              });
            }}
          >
            <Zap className="mr-2 h-4 w-4" />
            Track test analytics event
          </Button>
          <Button type="button" variant="outline" onClick={() => consent.resetConsent()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset consent
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
