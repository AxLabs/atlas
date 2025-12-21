// Add custom jest matchers from jest-dom
require("@testing-library/jest-dom");

// Mock Next.js environment variables
process.env.NEXT_PUBLIC_APP_NAME = "atlas-web";
process.env.NEXT_PUBLIC_APP_ENV = "test";
process.env.NEXT_PUBLIC_BUILD_ID = "test-build";
process.env.NEXT_PUBLIC_WEB_VITALS_ENABLED = "true";
process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE = "1";
process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT = "/api/telemetry/web-vitals";

// Mock sessionStorage
const sessionStorageData = {};
global.sessionStorage = {
  getItem: jest.fn((key) => sessionStorageData[key] || null),
  setItem: jest.fn((key, value) => {
    sessionStorageData[key] = value;
  }),
  removeItem: jest.fn((key) => {
    delete sessionStorageData[key];
  }),
  clear: jest.fn(() => {
    Object.keys(sessionStorageData).forEach((key) => delete sessionStorageData[key]);
  }),
};

// Mock navigator
global.navigator = {
  ...global.navigator,
  sendBeacon: jest.fn(() => true),
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

// Mock window and location for browser tests
global.window = {
  location: {
    origin: "http://localhost:3000",
    href: "http://localhost:3000/",
    pathname: "/",
  },
};

// Mock URL constructor for browser environment
global.URL = class URL {
  constructor(url, base) {
    const fullUrl = url.startsWith("http") ? url : base + url;
    const parsed = new (require("url").URL)(fullUrl);
    this.href = parsed.href;
    this.origin = parsed.origin;
    this.protocol = parsed.protocol;
    this.host = parsed.host;
    this.hostname = parsed.hostname;
    this.port = parsed.port;
    this.pathname = parsed.pathname;
    this.search = parsed.search;
    this.hash = parsed.hash;
  }
};

// Mock Next.js headers for API route tests
jest.mock("next/headers", () => ({
  headers: jest.fn(() => ({
    get: jest.fn(),
  })),
}));

// Suppress console logs during tests for cleaner output
// You can comment these out if you need to debug
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};
