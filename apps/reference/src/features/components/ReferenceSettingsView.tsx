"use client";

import { useConsent } from "@atlas/consent";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  useTheme,
} from "@atlas/ui";

import { useSession } from "@/lib/auth";
import { t } from "@/lib/i18n";

import { ReferenceAuthRequired } from "./ReferenceAuthRequired";
import { ReferenceLoadingState } from "./ReferenceLoadingState";

type ThemeChoice = "light" | "dark" | "system";

const THEME_OPTIONS: ThemeChoice[] = ["light", "dark", "system"];

function themeOptionLabel(option: ThemeChoice): string {
  if (option === "light") return "Light";
  if (option === "dark") return "Dark";
  return "System";
}

export function ReferenceSettingsView() {
  const session = useSession();
  const { preference, setPreference } = useTheme();
  const consent = useConsent();

  if (session.status === "loading") {
    return <ReferenceLoadingState />;
  }

  if (session.status === "unauthenticated") {
    return <ReferenceAuthRequired />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="text-muted-foreground">{t("settings.description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.appearance")}</CardTitle>
          <CardDescription>{t("settings.appearanceDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("settings.appearance")}>
            {THEME_OPTIONS.map((option) => (
              <Button
                key={option}
                type="button"
                variant={preference === option ? "default" : "outline"}
                size="sm"
                className={cn(preference === option && "ring-ring ring-2 ring-offset-2")}
                onClick={() => setPreference(option)}
                aria-pressed={preference === option}
              >
                {themeOptionLabel(option)}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            Current preference: <code>{preference}</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.privacy")}</CardTitle>
          <CardDescription>{t("settings.privacyDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Consent layer:</span>
            <Badge variant={consent.isEnabled ? "default" : "outline"}>
              {consent.isEnabled ? t("settings.consentEnabled") : t("settings.consentDisabled")}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("settings.analyticsConsent")}:</span>
            <Badge variant={consent.analyticsGranted ? "default" : "outline"}>
              {consent.analyticsGranted ? "Granted" : "Denied"}
            </Badge>
            {!consent.hasResolvedConsent && consent.isEnabled ? (
              <Badge variant="secondary">Pending resolution</Badge>
            ) : null}
          </div>

          {consent.isEnabled ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => consent.openPreferences()}
              >
                {t("settings.openPreferences")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => consent.acceptAll()}>
                {t("settings.acceptAll")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => consent.rejectAll()}>
                {t("settings.rejectAll")}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Consent is disabled in this environment. Set{" "}
              <code>NEXT_PUBLIC_CONSENT_ENABLED=true</code> to exercise preferences on this page.
              Analytics uses the noop adapter when no vendor credentials are configured.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.locale")}</CardTitle>
          <CardDescription>{t("settings.localeDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium">{t("settings.localeValue")}</p>
          <p className="text-muted-foreground mt-2 text-sm">
            Strings use the <code>t()</code> convention from <code>@/lib/i18n</code>. Locale
            switching is intentionally not implemented in this reference application.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
