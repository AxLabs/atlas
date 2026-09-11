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

## Architecture layers

```text
core authorization (`lib/authz/**`)
    ↑
application composition (`lib/application/authz.ts`)
    ↑
permission resolver / resource policy integrations
      ├── reference harness (reference mode only)
      └── real application consumer adapters
```

### Core (`lib/authz/**`)

Owns typed permissions, principal, authorization context, server guards, policy interfaces, resolver
registry, and client presentation helpers. Core authz does **not** import reference modules and does
**not** bootstrap consumer integrations.

### Application composition (`lib/application/authz.ts`)

Owns which resolvers and resource policies are installed, and environment/mode-specific integration.
Server entry points import configured helpers from here — for example `requirePermission`,
`requireResourcePermission`, and `enrichSessionResponse` — which call
`ensureApplicationAuthzConfigured()` before delegating to core authz.

### Reference harness (`lib/reference/auth/**`)

Owns deterministic role → permission mapping and reference resource restrictions. Registers only
when reference mode is enabled (`isReferenceModeEnabled()`). Reference resource policy is scoped to
reference principals — it does not affect unrelated application identities.

### Real consumers

Own application/backend permission mapping and application resource restrictions. Register via the
same core registry APIs during application composition.

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

Register an application-specific resolver during application composition:

```typescript
import { registerPermissionResolver } from "@/lib/authz/resolvers";

registerPermissionResolver("application", ({ principal, user }) => {
  // Derive from backend claims, application profile, or server-side policy.
  return [...];
});
```

In this repository, `lib/application/authz.ts` registers the reference harness adapter when
reference mode is enabled — no side-effect imports in route handlers.

Possible permission sources for a real Atlas consumer:

- backend-provided claims or capability responses
- an application-owned user profile loaded server-side
- local consumer policy derived from authenticated identity

**Trust boundary:** do not trust arbitrary client-supplied role or permission values. A real backend
remains authoritative for backend-owned data and actions.

## Server enforcement (authoritative)

Import configured guards from `@/lib/application/authz` in route handlers, server components, and
session orchestration. Core `@/lib/authz/server` functions assume resolvers and policies are already
registered.

### Global capability

`requirePermission()` enforces authentication plus a global typed permission. Optional
`resourceType` / `resourceId` parameters are audit metadata only — they do not evaluate resource
policy.

```typescript
import { permissions } from "@/lib/authz/permissions";
import { requirePermission, authorizationErrorResponse } from "@/lib/application/authz";

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

`requireResourcePermission()` composes global permission enforcement with optional consumer resource
policy:

```text
global permission granted
    ↓
resource policy registered?
    ↓ no                          ↓ yes
allowed                    all policies allow?
                               ↓ no      ↓ yes
                             denied    allowed
```

Resource policy may **further restrict** an already-granted global permission. It cannot mint
missing global capabilities.

```typescript
import { requireResourcePermission } from "@/lib/application/authz";

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

Protected surfaces in the reference application (`apps/reference`):

- `/api/users` — CRUD with permission checks
- `/api/users/[userId]` PATCH — resource-aware update guard
- `/authorization` — server component guarded by `users.update`

## Resource policy seam

Register named consumer policies during application composition:

```typescript
import { registerResourcePolicy } from "@/lib/authz";

registerResourcePolicy("application", ({ principal, resourceType, resourceId, action }) => {
  if (resourceType === "document" && action === permissions.users.update) {
    return principal.id === resourceId; // owner-only example
  }
  return true; // no additional restriction for other resources
});
```

Multiple registered policies compose conservatively: **all applicable policies must allow**.

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

Mapping lives in `lib/reference/auth/permissions.ts` and registers via `lib/application/authz.ts`
when reference mode is enabled. Roles never appear on `OAuthUser`.

The reference resource policy blocks updates to the protected admin account even when `users.update`
is granted globally — demonstrating the resource restriction seam. The policy applies only to
reference principals.

## Resolver registration

Permission resolvers register by stable id and replace on duplicate registration:

```typescript
registerPermissionResolver("application", ({ principal, user }) => [...]);
registerResourcePolicy("application", (ctx) => true);
```

Dependency direction:

```text
core authz
    ↑
application composition (`lib/application/authz.ts`)
    ↑
reference/consumer resolver and policy
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
- Architecture ownership — authorization vs the reference auth harness
