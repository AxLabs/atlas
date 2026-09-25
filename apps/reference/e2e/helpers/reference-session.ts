import { expect, type Page } from "@playwright/test";

import type { ReferenceAuthPersona, ReferenceUsersScenario } from "@/lib/reference/scenario-types";

/**
 * Establish reference persona/scenario cookies through the real session API.
 * Uses the browser-context request client so cookies stay isolated per Page/context.
 */
export async function setReferenceSession(
  page: Page,
  persona: ReferenceAuthPersona,
  usersScenario: ReferenceUsersScenario = "success"
): Promise<void> {
  const response = await page.request.post("/api/auth/session", {
    data: {
      persona,
      scenario: { users: usersScenario },
    },
  });

  expect(
    response.ok(),
    `Failed to set reference session (${persona}/${usersScenario}): ${response.status()}`
  ).toBeTruthy();
}

function isAuthMeResponse(response: {
  request: () => { method: () => string };
  url: () => string;
}) {
  return response.request().method() === "GET" && response.url().includes("/api/auth/me");
}

/**
 * Wait until client-side `useSession()` finishes hydrating.
 * Permission-gated UI (for example the users list actions) renders only after this.
 */
export async function waitForReferenceSessionReady(page: Page): Promise<void> {
  await expect(page.getByRole("status", { name: "Loading session" })).toBeHidden();
}

/**
 * Navigate and wait for the page's `useSession()` hook to finish hydrating.
 */
export async function gotoWithReferenceSessionReady(page: Page, path: string): Promise<void> {
  await Promise.all([
    page.waitForResponse((response) => isAuthMeResponse(response)),
    page.goto(path),
  ]);
  await waitForReferenceSessionReady(page);
}
