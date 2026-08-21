/**
 * Developer controls for reference auth personas and API scenarios.
 */

"use client";

import { useCallback, useState } from "react";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorFallback,
} from "@atlas/ui";

import { apiPost } from "@/lib/api";

import { useReferenceStatus, useReferenceUserList } from "../queries";

import type { UseSessionReturn } from "@/lib/auth";
import type { ReferenceAuthPersona, ReferenceUsersScenario } from "@/lib/reference/scenario-types";

const PERSONAS: ReferenceAuthPersona[] = ["anonymous", "reference-user", "reference-admin"];

interface ReferenceHarnessPanelProps {
  session: UseSessionReturn;
}

export function ReferenceHarnessPanel({ session }: ReferenceHarnessPanelProps) {
  const { status, user, refresh } = session;
  const { data: referenceStatus, isLoading, isError, error, refetch } = useReferenceStatus();
  const [selectedScenario, setSelectedScenario] = useState<ReferenceUsersScenario>("success");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const {
    data: usersData,
    isLoading: usersLoading,
    isError: usersError,
    error: usersQueryError,
    refetch: refetchUsers,
  } = useReferenceUserList(selectedScenario);

  const setPersona = useCallback(
    async (persona: ReferenceAuthPersona) => {
      setActionMessage(null);
      try {
        await apiPost("/api/reference/auth/session", {
          persona,
          scenario: { users: selectedScenario },
        });
        await refresh();
        await refetchUsers();
        setActionMessage(`Persona set to ${persona}`);
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : "Failed to set persona");
      }
    },
    [refresh, refetchUsers, selectedScenario]
  );

  const resetReference = useCallback(async () => {
    setActionMessage(null);
    try {
      await apiPost("/api/reference/reset");
      await refetchUsers();
      setActionMessage("Reference state reset");
    } catch {
      setActionMessage("Reset failed");
    }
  }, [refetchUsers]);

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading reference status…</p>;
  }

  if (isError) {
    return (
      <ErrorFallback
        title="Reference status unavailable"
        description={error?.shape?.userMessage ?? "Could not load reference harness status."}
        onRetry={() => refetch()}
      />
    );
  }

  if (!referenceStatus?.enabled) {
    return (
      <EmptyState
        title="Reference mode is not enabled"
        description="Set ATLAS_REFERENCE_MODE=true and NEXT_PUBLIC_API_URL=/api/reference in .env.local, then restart the dev server."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Auth persona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Session status: <strong>{status}</strong>
            {user ? ` — ${user.email}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {PERSONAS.map((persona) => (
              <Button key={persona} variant="outline" size="sm" onClick={() => setPersona(persona)}>
                {persona}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users API scenario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(referenceStatus.usersScenarios ?? []).map((scenario) => (
              <Button
                key={scenario}
                variant={selectedScenario === scenario ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedScenario(scenario as ReferenceUsersScenario)}
              >
                {scenario}
              </Button>
            ))}
          </div>

          {usersLoading && <p className="text-muted-foreground text-sm">Loading users…</p>}
          {!usersLoading && usersError && (
            <ErrorFallback
              title="Users request failed"
              description={usersQueryError?.shape?.userMessage ?? "Request failed"}
              onRetry={() => refetchUsers()}
            />
          )}
          {!usersLoading && !usersError && usersData && (
            <ul className="space-y-1 text-sm">
              {usersData.data.map((entry) => (
                <li key={entry.id}>
                  {entry.name} ({entry.email})
                </li>
              ))}
              {usersData.data.length === 0 ? (
                <li className="text-muted-foreground">No users</li>
              ) : null}
            </ul>
          )}

          <Button variant="outline" size="sm" onClick={resetReference}>
            Reset reference state
          </Button>
        </CardContent>
      </Card>

      {actionMessage ? <p className="text-muted-foreground text-sm">{actionMessage}</p> : null}
    </div>
  );
}
