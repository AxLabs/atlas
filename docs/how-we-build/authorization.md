# Authorization

Atlas authenticates principals and authorizes **capabilities through typed permissions**. Server
enforcement is the security boundary; client checks control presentation only.

## Model

```text
authentication
    ↓
global typed capability
    ↓
optional consumer resource/domain policy
    ↓
server authorization decision
```

| Concept        | Answers                       | Location                                      |
| -------------- | ----------------------------- | --------------------------------------------- |
| Authentication | Who is this?                  | `lib/auth/`, session cookie                   |
| Principal      | Stable identity               | `lib/authz/principal.ts`                      |
| Authorization  | What may this principal do?   | `lib/authz/` (resolved, not stored in cookie) |
| Roles          | Consumer/reference input only | `lib/reference/auth/personas.ts`              |

**Do not check reference roles in product code.** Map roles to permissions in a consumer adapter,
then use the typed permission API.

## Permissions

Central registry in `lib/authz/permissions.ts`:

```typescript
import { permissions } from "@/lib/authz/permissions";

permissions.users.read; // "users.read"
permissions.users.create; // "users.create"
permissions.users.update; // "users.update"
permissions.users.delete; // "users.delete"
```

Add permissions as domains grow. Avoid scattered string literals.

## Consumer integration

Permissions are resolved at request time from the authenticated principal — not from client input
and not from the encrypted session cookie.

Register an application-specific resolver during server bootstrap:

```typescript
import { registerPermissionResolver } from "@/lib/authz/resolvers";

registerPermissionResolver("application", ({ principal, user }) => {
  // Derive from backend claims, application profile, or server-side policy.
  return [...];
});
```

In this repository, `lib/authz/setup.ts` calls `ensureAuthzSetup()` from server entry points. That
registers the reference harness adapter once — no side-effect imports in route handlers.

Possible permission sources for a real Atlas consumer:

- backend-provided claims or capability responses
- an application-owned user profile loaded server-side
- local consumer policy derived from authenticated identity

**Trust boundary:** do not trust arbitrary client-supplied role or permission values. A real backend
remains authoritative for backend-owned data and actions.

## Server enforcement (authoritative)

### Global capability

`requirePermission()` enforces authentication plus a global typed permission. Optional
`resourceType` / `resourceId` parameters are audit metadata only — they do not evaluate resource
policy.

```typescript
import { permissions } from "@/lib/authz/permissions";
import { requirePermission, authorizationErrorResponse } from "@/lib/authz/server";

export async function DELETE(request: NextRequest) {
  const correlationId = generateCorrelationId();

  try {
    await requirePermission(permissions.users.delete, {
      resourceType: "users",
      correlationId,
    });
  } catch (error) {
    return authorizationErrorResponse(error, correlationId) ?? NextResponse.error();
  }

  // ... perform protected operation
}
```

### Resource-aware guard

`requireResourcePermission()` composes global permission enforcement with an optional consumer
resource policy:

```text
global permission granted
    ↓
resource policy registered?
    ↓ no                          ↓ yes
allowed                    policy allows?
                               ↓ no      ↓ yes
                             denied    allowed
```

Resource policy may **further restrict** an already-granted global permission. It cannot mint
missing global capabilities.

```typescript
import { requireResourcePermission } from "@/lib/authz/server";

await requireResourcePermission(permissions.users.update, {
  resourceType: "users",
  resourceId: userId,
  correlationId,
});
```

| State                                      | HTTP | Error                         |
| ------------------------------------------ | ---- | ----------------------------- |
| Not signed in                              | 401  | `AuthenticationRequiredError` |
| Signed in, missing global permission       | 403  | `PermissionDeniedError`       |
| Signed in, global OK, resource policy deny | 403  | `PermissionDeniedError`       |

Protected surfaces in the reference harness:

- `/api/reference/users` — CRUD with permission checks
- `/api/reference/users/[userId]` PATCH — resource-aware update guard
- `/reference/authorization` — server component guarded by `users.update`

## Resource policy seam

Register a consumer policy once at bootstrap:

```typescript
import { registerResourcePolicy } from "@/lib/authz";

registerResourcePolicy(({ principal, resourceType, resourceId, action }) => {
  if (resourceType === "document" && action === permissions.users.update) {
    return principal.id === resourceId; // owner-only example
  }
  return true; // no additional restriction for other resources
});
```

Pure helpers:

- `evaluateResourcePolicy()` — raw consumer policy evaluation
- `canOnResource(ctx, action, resourceType, resourceId)` — complete decision (global permission +
  optional policy)

When no resource policy is registered, a granted global permission is sufficient.

## Client presentation gating (not security)

**Client-side authorization controls presentation only. It is not a security boundary.**

Use the canonical helpers — do not inspect `session.permissions` arrays directly in product code:

```tsx
import { Can, hasClientPermission, usePermission, permissions } from "@/lib/authz";

function UserActions({ sessionPermissions }: { sessionPermissions: readonly string[] | null }) {
  const canDelete = hasClientPermission(sessionPermissions, permissions.users.delete);

  return (
    <Can permission={permissions.users.delete} grantedPermissions={sessionPermissions}>
      <DeleteButton />
    </Can>
  );
}
```

Pass `grantedPermissions` to `Can` from an existing `useSession()` call to avoid duplicate session
fetches. Use `hasClientPermission(sessionPermissions, permission)` for non-component checks.
`usePermission(permission)` remains available when no parent session is present.

Permissions are resolved server-side and exposed via `/api/auth/me` (`SessionResponse.permissions`).

## Reference role adapter

Reference personas carry profile metadata (`roles`) that maps to permissions:

| Persona           | Effective permissions                                        |
| ----------------- | ------------------------------------------------------------ |
| `reference-user`  | `users.read`                                                 |
| `reference-admin` | `users.read`, `users.create`, `users.update`, `users.delete` |

Mapping lives in `lib/reference/auth/permissions.ts` and registers via `lib/authz/setup.ts`. Roles
never appear on `OAuthUser`.

The reference resource policy blocks updates to the protected admin account even when `users.update`
is granted globally — demonstrating the resource restriction seam.

## Resolver registration

Permission resolvers register by stable id and replace on duplicate registration:

```typescript
registerPermissionResolver("application", ({ principal, user }) => [...]);
```

Core authz does not import reference modules directly:

```text
core authz
    ↑
application composition (`lib/authz/setup.ts`)
    ↑
reference/consumer resolver
```

## Backend trust boundary

```text
frontend permission checks  →  UX + route/action enforcement in Atlas
backend/API authorization   →  authoritative protection of backend data
```

When Atlas calls a real backend, **that backend must validate authorization**. Checking a permission
in React does not secure an external API.

The reference API enforces deterministic policy because it is part of the reference harness, not
because frontend gating is sufficient.

## Denied-action audit

Denied sensitive actions log structured events via `lib/authz/audit.ts`:

```json
{
  "event": "authorization.denied",
  "principalId": "reference-user",
  "permission": "users.delete",
  "resourceType": "users",
  "result": "denied",
  "correlationId": "..."
}
```

Tokens, cookies, and authorization headers are never logged.

## Session shape

`SessionResponse` includes resolved `permissions` and `principalId`. These are derived at request
time — not persisted in the encrypted session cookie.

## Related

- [Reference harness](./reference-harness.md) — deterministic personas and scenarios
- [API & data fetching](./api.md) — client API patterns
- Architecture ownership — #41 authorization vs #40 auth harness
