import { render, screen, waitFor } from "@testing-library/react";

import { ConsentProvider, useConsent } from "../provider";
import { CONSENT_CATEGORIES } from "../types";

const mockRun = jest.fn().mockResolvedValue(undefined);
const mockShowPreferences = jest.fn();
const mockAcceptCategory = jest.fn();
const mockReset = jest.fn();
const mockValidConsent = jest.fn().mockReturnValue(false);
const mockAcceptedCategory = jest.fn().mockReturnValue(false);

jest.mock("vanilla-cookieconsent", () => ({
  run: (...args: unknown[]) => mockRun(...args),
  showPreferences: () => mockShowPreferences(),
  acceptCategory: (...args: unknown[]) => mockAcceptCategory(...args),
  reset: (...args: unknown[]) => mockReset(...args),
  validConsent: () => mockValidConsent(),
  acceptedCategory: (category: string) => mockAcceptedCategory(category),
  acceptedService: jest.fn().mockReturnValue(false),
}));

jest.mock("../styles.css", () => ({}));

function ConsentProbe() {
  const consent = useConsent();
  return (
    <div>
      <span data-testid="enabled">{String(consent.isEnabled)}</span>
      <span data-testid="resolved">{String(consent.hasResolvedConsent)}</span>
      <span data-testid="analytics">{String(consent.analyticsGranted)}</span>
      <button type="button" onClick={() => consent.openPreferences()}>
        Open preferences
      </button>
    </div>
  );
}

const enabledConfig = {
  enabled: true,
  mode: "opt-in" as const,
  revision: 1,
  appName: "Atlas",
  categories: {
    analytics: {
      enabled: true,
      services: {
        postHog: true,
      },
    },
  },
};

describe("ConsentProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidConsent.mockReturnValue(false);
    mockAcceptedCategory.mockReturnValue(false);
  });

  it("renders children with disabled config and skips initialization", () => {
    render(
      <ConsentProvider
        config={{
          enabled: false,
          appName: "Atlas",
        }}
      >
        <ConsentProbe />
      </ConsentProvider>
    );

    expect(screen.getByText("Open preferences")).toBeInTheDocument();
    expect(screen.getByTestId("enabled")).toHaveTextContent("false");
    expect(screen.getByTestId("resolved")).toHaveTextContent("true");
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("initializes CookieConsent once when enabled", async () => {
    render(
      <ConsentProvider config={enabledConfig}>
        <ConsentProbe />
      </ConsentProvider>
    );

    await waitFor(() => {
      expect(mockRun).toHaveBeenCalledTimes(1);
    });

    expect(mockRun.mock.calls[0]?.[0]).toMatchObject({
      mode: "opt-in",
      autoShow: true,
      categories: expect.objectContaining({
        [CONSENT_CATEGORIES.necessary]: expect.objectContaining({ readOnly: true }),
      }),
    });
  });

  it("maps analytics consent to callbacks", async () => {
    const onAnalyticsConsentChange = jest.fn();

    mockRun.mockImplementation(async (config: { onConsent?: () => void }) => {
      mockAcceptedCategory.mockReturnValue(true);
      config.onConsent?.();
    });

    render(
      <ConsentProvider config={enabledConfig} onAnalyticsConsentChange={onAnalyticsConsentChange}>
        <ConsentProbe />
      </ConsentProvider>
    );

    await waitFor(() => {
      expect(onAnalyticsConsentChange).toHaveBeenCalledWith(true);
    });

    expect(screen.getByTestId("analytics")).toHaveTextContent("true");
  });

  it("maps rejected analytics consent to false", async () => {
    const onAnalyticsConsentChange = jest.fn();

    mockRun.mockImplementation(async (config: { onConsent?: () => void }) => {
      mockAcceptedCategory.mockReturnValue(false);
      config.onConsent?.();
    });

    render(
      <ConsentProvider config={enabledConfig} onAnalyticsConsentChange={onAnalyticsConsentChange}>
        <ConsentProbe />
      </ConsentProvider>
    );

    await waitFor(() => {
      expect(onAnalyticsConsentChange).toHaveBeenCalledWith(false);
    });
  });

  it("openPreferences calls CookieConsent.showPreferences", async () => {
    render(
      <ConsentProvider config={enabledConfig}>
        <ConsentProbe />
      </ConsentProvider>
    );

    await waitFor(() => {
      expect(mockRun).toHaveBeenCalled();
    });

    screen.getByText("Open preferences").click();

    await waitFor(() => {
      expect(mockShowPreferences).toHaveBeenCalled();
    });
  });
});
