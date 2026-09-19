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
