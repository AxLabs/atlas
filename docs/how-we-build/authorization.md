# Authorization

Atlas authenticates principals and authorizes **capabilities through typed permissions**. Server
enforcement is the security boundary; client checks control presentation only.

## Model

```text
authentication  →  principal  →  authorization context  →  permission checks
       ↓                                                              ↓
  session cookie                                    server enforcement (authoritative)
                                                            ↓
                                              optional client presentation gating
```

| Concept        | Answers                       | Location                                      |
| -------------- | ----------------------------- | --------------------------------------------- |
| Authentication | Who is this?                  | `lib/auth/`, session cookie                   |
| Principal      | Stable identity               | `lib/authz/principal.ts`                      |
| Authorization  | What may this principal do?   | `lib/authz/` (resolved, not stored in cookie) |
| Roles          | Consumer/reference input only | `lib/reference/auth/personas.ts`              |

**Do not check reference roles in product code.** Map roles to permissions in a reference adapter,
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

## Server enforcement (authoritative)

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

| State             | HTTP | Error                         |
| ----------------- | ---- | ----------------------------- |
| Not signed in     | 401  | `AuthenticationRequiredError` |
| Signed in, denied | 403  | `PermissionDeniedError`       |

Protected surfaces in the reference harness:

- `/api/reference/users` — CRUD with permission checks
- `/reference/authorization` — server component guarded by `users.update`

## Client presentation gating (not security)

**Client-side authorization controls presentation only. It is not a security boundary.**

```tsx
import { Can, usePermission, permissions } from "@/lib/authz";

function UserActions() {
  const canDelete = usePermission(permissions.users.delete);

  return (
    <Can permission={permissions.users.delete}>
      <DeleteButton />
    </Can>
  );
}
```

Permissions are resolved server-side and exposed via `/api/auth/me` (`SessionResponse.permissions`).

## Reference role adapter

Reference personas carry profile metadata (`roles`) that maps to permissions:

| Persona           | Effective permissions                                        |
| ----------------- | ------------------------------------------------------------ |
| `reference-user`  | `users.read`                                                 |
| `reference-admin` | `users.read`, `users.create`, `users.update`, `users.delete` |

Mapping lives in `lib/reference/auth/permissions.ts` and registers via
`lib/reference/auth/register.ts`. Roles never appear on `OAuthUser`.

## Resource policy seam

Global capabilities are typed centrally. Resource ownership stays with the consumer/backend:

```typescript
import { registerResourcePolicy, canOnResource } from "@/lib/authz";

registerResourcePolicy(({ principal, resourceType, resourceId, action }) => {
  if (resourceType === "document" && action === permissions.users.update) {
    return principal.id === resourceId; // owner-only example
  }
  return false;
});
```

This is an extension point — not a policy DSL or IAM engine.

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
