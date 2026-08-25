"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createAtlasCookieConsentConfig } from "./config";
import {
  dispatchConsentChangeEvent,
  readAnalyticsConsent,
  readMarketingConsent,
  readPreferencesConsent,
  setCookieConsentModule,
  withCookieConsent,
} from "./utils";

import type { ConsentContextValue, ConsentProviderProps, ConsentStatus } from "./types";

const ConsentContext = createContext<ConsentContextValue | null>(null);

const DISABLED_CONSENT_STATUS: ConsentStatus = {
  isEnabled: false,
  hasResolvedConsent: true,
  analyticsGranted: false,
  marketingGranted: false,
  preferencesGranted: false,
};

function isDevelopment(): boolean {
  return typeof process !== "undefined" && process.env.NODE_ENV === "development";
}

function syncConsentState(
  setStatus: (status: ConsentStatus) => void,
  isEnabled: boolean,
  hasResolvedConsent: boolean
): void {
  setStatus({
    isEnabled,
    hasResolvedConsent,
    analyticsGranted: readAnalyticsConsent(),
    marketingGranted: readMarketingConsent(),
    preferencesGranted: readPreferencesConsent(),
  });
  dispatchConsentChangeEvent();
}

export function ConsentProvider({
  config,
  children,
  onAnalyticsConsentChange,
  debug = false,
}: ConsentProviderProps) {
  const isEnabled = config.enabled;
  const initStarted = useRef(false);
  const onAnalyticsConsentChangeRef = useRef(onAnalyticsConsentChange);

  const [status, setStatus] = useState<ConsentStatus>(() =>
    isEnabled
      ? {
          isEnabled: true,
          hasResolvedConsent: false,
          analyticsGranted: false,
          marketingGranted: false,
          preferencesGranted: false,
        }
      : DISABLED_CONSENT_STATUS
  );

  useEffect(() => {
    onAnalyticsConsentChangeRef.current = onAnalyticsConsentChange;
  }, [onAnalyticsConsentChange]);

  const notifyAnalyticsConsent = useCallback((granted: boolean) => {
    onAnalyticsConsentChangeRef.current?.(granted);
  }, []);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    if (initStarted.current) {
      return;
    }
    initStarted.current = true;

    let cancelled = false;

    async function initializeCookieConsent() {
      try {
        await import("./styles.css");

        const CookieConsent = await import("vanilla-cookieconsent");
        if (cancelled) {
          return;
        }

        setCookieConsentModule(CookieConsent);

        const cookieConfig = createAtlasCookieConsentConfig(config);

        const handleConsentChange = () => {
          const analyticsGranted = readAnalyticsConsent();
          syncConsentState(setStatus, true, true);
          notifyAnalyticsConsent(analyticsGranted);
        };

        await CookieConsent.run({
          ...cookieConfig,
          onFirstConsent: handleConsentChange,
          onConsent: handleConsentChange,
          onChange: handleConsentChange,
        });

        if (cancelled) {
          return;
        }

        const hasExistingConsent = CookieConsent.validConsent();
        syncConsentState(setStatus, true, hasExistingConsent);

        if (hasExistingConsent) {
          notifyAnalyticsConsent(readAnalyticsConsent());
        }
      } catch (error) {
        if (debug || isDevelopment()) {
          // eslint-disable-next-line no-console
          console.error("[@atlas/consent] Failed to initialize CookieConsent:", error);
        }
        if (!cancelled) {
          setStatus((prev) => ({ ...prev, hasResolvedConsent: true }));
        }
      }
    }

    void initializeCookieConsent();

    return () => {
      cancelled = true;
    };
  }, [config, debug, isEnabled, notifyAnalyticsConsent]);

  const openPreferences = useCallback(() => {
    if (!isEnabled) {
      return;
    }

    withCookieConsent((cc) => {
      cc.showPreferences();
    });
  }, [isEnabled]);

  const acceptAll = useCallback(() => {
    if (!isEnabled) {
      return;
    }

    withCookieConsent((cc) => {
      cc.acceptCategory("all");
      queueMicrotask(() => {
        syncConsentState(setStatus, true, true);
        notifyAnalyticsConsent(readAnalyticsConsent());
      });
    });
  }, [isEnabled, notifyAnalyticsConsent]);

  const rejectAll = useCallback(() => {
    if (!isEnabled) {
      return;
    }

    withCookieConsent((cc) => {
      cc.acceptCategory([]);
      queueMicrotask(() => {
        syncConsentState(setStatus, true, true);
        notifyAnalyticsConsent(readAnalyticsConsent());
      });
    });
  }, [isEnabled, notifyAnalyticsConsent]);

  const resetConsent = useCallback(() => {
    if (!isEnabled) {
      return;
    }

    withCookieConsent((cc) => {
      cc.reset(true);
      syncConsentState(setStatus, true, false);
      notifyAnalyticsConsent(false);
    });
  }, [isEnabled, notifyAnalyticsConsent]);

  const value = useMemo<ConsentContextValue>(
    () => ({
      ...status,
      openPreferences,
      acceptAll,
      rejectAll,
      resetConsent,
    }),
    [status, openPreferences, acceptAll, rejectAll, resetConsent]
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error("useConsent must be used within a ConsentProvider");
  }
  return context;
}
