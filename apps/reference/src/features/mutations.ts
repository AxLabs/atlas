/**
 * Reference harness control mutations.
 *
 * Persist persona/scenario/reset independently of the users preview query.
 */

"use client";

import { useMutation } from "@tanstack/react-query";

import { apiPost, normalizeApiError } from "@/lib/api";

import type { ApiError } from "@/lib/api";
import type { ReferenceAuthPersona, ReferenceUsersScenario } from "@/lib/reference/scenario-types";

export type HarnessControlVariables =
  | { kind: "persona"; persona: ReferenceAuthPersona; scenario: ReferenceUsersScenario }
  | { kind: "scenario"; persona: ReferenceAuthPersona; scenario: ReferenceUsersScenario }
  | { kind: "reset" };

export function useHarnessControlMutation(refreshSession: () => Promise<void>) {
  return useMutation<HarnessControlVariables, ApiError, HarnessControlVariables>({
    mutationKey: ["reference", "harness-control"],
    scope: { id: "reference-harness-control" },
    mutationFn: async (variables) => {
      try {
        if (variables.kind === "reset") {
          await apiPost("/api/reset");
          return variables;
        }

        await apiPost("/api/auth/session", {
          persona: variables.persona,
          scenario: { users: variables.scenario },
        });
        await refreshSession();
        return variables;
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
  });
}
