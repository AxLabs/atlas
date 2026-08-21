/**
 * Demonstrates permission-aware UI and server enforcement (#41).
 *
 * Client gating is presentation only — protected API calls enforce on the server.
 */

"use client";

import { useCallback, useState } from "react";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@atlas/ui";

import { apiDelete, apiGet } from "@/lib/api";
import { getUserFacingMessage } from "@/lib/api/errors";
import { permissions } from "@/lib/authz";
import { REFERENCE_PERSONA_IDS } from "@/lib/reference/auth/personas";

import type { UseSessionReturn } from "@/lib/auth";

interface AuthorizationDemoPanelProps {
  session: UseSessionReturn;
}

export function AuthorizationDemoPanel({ session }: AuthorizationDemoPanelProps) {
  const { status, permissions: sessionPermissions, refresh } = session;
  const canDelete = sessionPermissions?.includes(permissions.users.delete) ?? false;
  const [apiResult, setApiResult] = useState<string | null>(null);

  const attemptProtectedDelete = useCallback(async () => {
    setApiResult(null);
    try {
      await apiDelete(`/api/reference/users/${REFERENCE_PERSONA_IDS.user}`);
      setApiResult("Delete succeeded (server allowed the request).");
      await refresh();
    } catch (error) {
      setApiResult(`Delete denied or failed: ${getUserFacingMessage(error)}`);
    }
  }, [refresh]);

  const listUsers = useCallback(async () => {
    setApiResult(null);
    try {
      const response = await apiGet<{ data: { id: string; name: string }[] }>(
        "/api/reference/users"
      );
      setApiResult(`Listed ${response.data.length} user(s) — server allowed read.`);
    } catch (error) {
      setApiResult(`List failed: ${getUserFacingMessage(error)}`);
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Authorization demo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Session: <strong>{status}</strong>
          {sessionPermissions ? ` — ${sessionPermissions.length} permission(s)` : ""}
        </p>

        {sessionPermissions && sessionPermissions.length > 0 ? (
          <ul className="text-muted-foreground list-inside list-disc text-sm">
            {sessionPermissions.map((permission) => (
              <li key={permission}>
                <code>{permission}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No permissions resolved.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={listUsers}>
            List users (server-protected read)
          </Button>

          {canDelete ? (
            <Button variant="destructive" size="sm" onClick={attemptProtectedDelete}>
              Delete reference user (UI gated)
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Delete user (hidden — no permission)
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={attemptProtectedDelete}>
            Direct delete API call (bypasses UI gate)
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">
          UI gating ({canDelete ? "allowed" : "denied"} for delete) is presentation only. The direct
          API button proves server enforcement — reference-user receives 403 even when UI is
          bypassed.
        </p>

        {apiResult ? <p className="text-sm">{apiResult}</p> : null}
      </CardContent>
    </Card>
  );
}
