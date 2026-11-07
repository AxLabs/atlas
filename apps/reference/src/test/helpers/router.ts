/**
 * Next.js Router Test Mocks
 *
 * Standardized mocks for Next.js App Router (next/navigation).
 * Use these to avoid implementing router mocks in every test.
 */

import { jest } from "@jest/globals";

// Exported mocks carry explicit `jest.Mock` annotations from `@jest/globals`. Inferred types would
// reference `jest-mock` by its install location, which TS2742 rejects as non-portable whenever the
// package manager does not hoist `jest-mock` where this workspace can resolve it.
type VoidMock = jest.Mock<() => void>;

interface MockRouterState {
  pathname: string;
  searchParams: URLSearchParams;
  push: VoidMock;
  replace: VoidMock;
  refresh: VoidMock;
  back: VoidMock;
  forward: VoidMock;
  prefetch: VoidMock;
}

type MockRouter = Pick<
  MockRouterState,
  "push" | "replace" | "refresh" | "back" | "forward" | "prefetch"
>;

/**
 * Mock router state that can be modified per test.
 */
export const mockRouterState: MockRouterState = {
  pathname: "/",
  searchParams: new URLSearchParams(),
  push: jest.fn<() => void>(),
  replace: jest.fn<() => void>(),
  refresh: jest.fn<() => void>(),
  back: jest.fn<() => void>(),
  forward: jest.fn<() => void>(),
  prefetch: jest.fn<() => void>(),
};

/**
 * Reset router state to defaults.
 * Call this in beforeEach to ensure test isolation.
 */
export function resetRouterMocks() {
  mockRouterState.pathname = "/";
  mockRouterState.searchParams = new URLSearchParams();
  mockRouterState.push.mockClear();
  mockRouterState.replace.mockClear();
  mockRouterState.refresh.mockClear();
  mockRouterState.back.mockClear();
  mockRouterState.forward.mockClear();
  mockRouterState.prefetch.mockClear();
}

/**
 * Mock implementation of useRouter from next/navigation.
 *
 * @example
 * ```ts
 * jest.mock('next/navigation', () => ({
 *   useRouter: mockUseRouter,
 *   usePathname: mockUsePathname,
 *   useSearchParams: mockUseSearchParams,
 * }));
 * ```
 */
export const mockUseRouter: jest.Mock<() => MockRouter> = jest.fn(() => ({
  push: mockRouterState.push,
  replace: mockRouterState.replace,
  refresh: mockRouterState.refresh,
  back: mockRouterState.back,
  forward: mockRouterState.forward,
  prefetch: mockRouterState.prefetch,
}));

/**
 * Mock implementation of usePathname from next/navigation.
 */
export const mockUsePathname: jest.Mock<() => string> = jest.fn(() => mockRouterState.pathname);

/**
 * Mock implementation of useSearchParams from next/navigation.
 */
export const mockUseSearchParams: jest.Mock<() => URLSearchParams> = jest.fn(
  () => mockRouterState.searchParams
);

/**
 * Mock implementation of useParams from next/navigation.
 */
export const mockUseParams: jest.Mock<() => Record<string, string | string[]>> = jest.fn(
  () => ({})
);

/**
 * Mock implementation of redirect from next/navigation.
 */
export const mockRedirect: jest.Mock<(url: string) => never> = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT: ${url}`);
});

/**
 * Mock implementation of notFound from next/navigation.
 */
export const mockNotFound: jest.Mock<() => never> = jest.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

/**
 * Setup Next.js navigation mocks.
 * Call this in your global test setup file or individual test files.
 *
 * @example
 * ```ts
 * // In jest.setup.js
 * import { setupRouterMocks } from '@/test/helpers/router';
 * setupRouterMocks();
 * ```
 */
export function setupRouterMocks() {
  jest.mock("next/navigation", () => ({
    useRouter: mockUseRouter,
    usePathname: mockUsePathname,
    useSearchParams: mockUseSearchParams,
    useParams: mockUseParams,
    redirect: mockRedirect,
    notFound: mockNotFound,
  }));
}

/**
 * Helper to set pathname for tests.
 *
 * @example
 * ```ts
 * setMockPathname('/users/123');
 * ```
 */
export function setMockPathname(pathname: string) {
  mockRouterState.pathname = pathname;
}

/**
 * Helper to set search params for tests.
 *
 * @example
 * ```ts
 * setMockSearchParams({ page: '2', filter: 'active' });
 * ```
 */
export function setMockSearchParams(params: Record<string, string>) {
  mockRouterState.searchParams = new URLSearchParams(params);
}
