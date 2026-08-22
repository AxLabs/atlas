"use client";

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@atlas/ui";

import { ReferenceAuthRequired } from "@/features/components/ReferenceAuthRequired";
import { useSession } from "@/lib/auth";
import { hasClientPermission, permissions } from "@/lib/authz";

export function ReferenceProfileView() {
  const { status, user, provider, principalId, permissions: sessionPermissions } = useSession();

  if (status === "loading") {
    return <p className="text-muted-foreground text-sm">Loading session…</p>;
  }

  if (status === "unauthenticated" || !user) {
    return <ReferenceAuthRequired />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Session data from the standard <code>/api/auth/me</code> contract — the same path
          production integrations use.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ProfileRow label="Provider" value={provider ?? "—"} />
          <ProfileRow label="Principal ID" value={principalId ?? "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resolved permissions</CardTitle>
          <CardDescription>
            Presentation gating only — server routes enforce independently.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessionPermissions && sessionPermissions.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {sessionPermissions.map((permission) => (
                <li key={permission}>
                  <Badge variant="secondary">
                    <code>{permission}</code>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No permissions resolved.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capability check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <CapabilityRow
            label="users.read"
            allowed={hasClientPermission(sessionPermissions, permissions.users.read)}
          />
          <CapabilityRow
            label="users.create"
            allowed={hasClientPermission(sessionPermissions, permissions.users.create)}
          />
          <CapabilityRow
            label="users.update"
            allowed={hasClientPermission(sessionPermissions, permissions.users.update)}
          />
          <CapabilityRow
            label="users.delete"
            allowed={hasClientPermission(sessionPermissions, permissions.users.delete)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs sm:text-sm">{value}</span>
    </div>
  );
}

function CapabilityRow({ label, allowed }: { label: string; allowed: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <code>{label}</code>
      <Badge variant={allowed ? "default" : "outline"}>{allowed ? "granted" : "denied"}</Badge>
    </div>
  );
}
