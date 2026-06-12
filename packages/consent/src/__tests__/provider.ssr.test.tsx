/**
 * @jest-environment node
 */

import { renderToString } from "react-dom/server";

import { ConsentProvider } from "../provider";

const mockRun = jest.fn().mockResolvedValue(undefined);

jest.mock("vanilla-cookieconsent", () => ({
  run: (...args: unknown[]) => mockRun(...args),
  showPreferences: jest.fn(),
  acceptCategory: jest.fn(),
  reset: jest.fn(),
  validConsent: jest.fn().mockReturnValue(false),
  acceptedCategory: jest.fn().mockReturnValue(false),
  acceptedService: jest.fn().mockReturnValue(false),
}));

jest.mock("../styles.css", () => ({}));

describe("ConsentProvider SSR", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not initialize CookieConsent on the server", () => {
    const html = renderToString(
      <ConsentProvider
        config={{
          enabled: true,
          mode: "opt-in",
          revision: 1,
          appName: "Atlas",
          categories: { analytics: { enabled: true } },
        }}
      >
        <div>child</div>
      </ConsentProvider>
    );

    expect(html).toContain("child");
    expect(mockRun).not.toHaveBeenCalled();
  });
});
