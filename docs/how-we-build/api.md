# API & Data Fetching

> No fetch spaghetti. All HTTP requests go through the central API client.

## The Rules

| Rule                                | Enforcement                    |
| ----------------------------------- | ------------------------------ |
| **No `fetch()` in UI code**         | ESLint blocks it               |
| **Use React Query for client data** | Standard hooks pattern         |
| **All types from OpenAPI**          | Generated, not hand-written    |
| **Standard error shape**            | `ApiError` with correlation ID |
| **Query keys from factories**       | Consistent cache invalidation  |

## Architecture

```
src/lib/
├── api/
│   ├── client.ts           # Central HTTP client
│   ├── errors.ts           # ApiError class
│   ├── correlation.ts      # Request tracing
│   ├── contracts/
│   │   ├── schema.ts       # Generated OpenAPI types
│   │   └── index.ts        # Typed API client
│   └── index.ts
│
└── react-query/
    ├── provider.tsx        # QueryClient configuration
    ├── keys.ts             # Query key factories
    ├── patterns.ts         # Mutation helpers
    └── index.ts
```

## Generated vs platform vs consumer

| Layer           | Location                                                                              | Ownership                                      |
| --------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| OpenAPI spec    | `openapi/openapi.json`                                                                | Consumer replaces with their API contract      |
| Generated types | `lib/api/contracts/schema.ts`                                                         | **Generated** — run `api:gen`; never hand-edit |
| Typed client    | `lib/api/contracts/index.ts`                                                          | **Platform** — wraps generated types           |
| HTTP client     | `lib/api/client.ts`                                                                   | **Platform** — fetch gateway, retries, errors  |
| Feature hooks   | `features/<name>/` (product) or `apps/reference/src/features/<name>/` (reference app) | **Consumer** or **reference application**      |

See [architecture ownership](architecture-ownership.md) for the full classification.

## Using React Query Hooks

Client feature hooks use `useTypedApiClient()` so requests keep the generated OpenAPI contract while
using the runtime API base URL from `useConfig()`:

```
runtime config (useConfig)
      ↓
useTypedApiClient() → createApi(baseUrl)
      ↓
typed OpenAPI client (api.users.*)
      ↓
central apiRequest gateway
      ↓
React Query feature hooks
```

### Queries

```typescript
// apps/reference/src/features/users/queries.ts
import { useQuery } from "@tanstack/react-query";
import { normalizeApiError, useTypedApiClient } from "@/lib/api";
import { userKeys } from "./keys";

export function useUserList(params?: { page?: number }) {
  const api = useTypedApiClient();

  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: async () => {
      try {
        return await api.users.list(params);
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
  });
}

export function useUser(id: string) {
  const api = useTypedApiClient();

  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: async () => {
      try {
        return await api.users.get(id);
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
  });
}
```

### Mutations

```typescript
// apps/reference/src/features/users/mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { normalizeApiError, useTypedApiClient } from "@/lib/api";
import { userKeys } from "./keys";

export function useCreateUser() {
  const queryClient = useQueryClient();
  const api = useTypedApiClient();

  return useMutation({
    mutationFn: async (data: CreateUserRequest) => {
      try {
        return await api.users.create(data);
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
    onSuccess: () => {
      // Invalidate all user list queries
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
```

### In Components

```tsx
import { useUserList, useCreateUser } from "@/features/users";
import { getUserFacingMessage } from "@/lib/api";

function UserList() {
  const { data, error, isLoading } = useUserList();
  const createUser = useCreateUser();

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message={getUserFacingMessage(error)} />;

  return (
    <ul>
      {data.data.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

## Query Key Conventions

Use the factory pattern for consistent keys:

```typescript
// apps/reference/src/features/users/keys.ts
import { createQueryKeys } from "@/lib/react-query";

export const userKeys = createQueryKeys("users");

// Usage:
userKeys.all(); // ['users']
userKeys.lists(); // ['users', 'list']
userKeys.list({ page: 1 }); // ['users', 'list', { page: 1 }]
userKeys.details(); // ['users', 'detail']
userKeys.detail("user-123"); // ['users', 'detail', 'user-123']
```

**Why?**

- Consistent invalidation patterns
- No typos in string keys
- IDE autocomplete

## Error Handling

### Standard Error Shape

```typescript
interface ApiErrorShape {
  code: string; // Machine-readable: 'VALIDATION_ERROR'
  message: string; // Technical message (for logs)
  userMessage?: string; // Safe for UI display
  correlationId?: string; // Request tracing
  details?: unknown; // Additional context
}
```

### Using Errors

```typescript
import { getUserFacingMessage, ApiError, isApiErrorWithCode } from "@/lib/api";

try {
  await api.users.create(data);
} catch (error) {
  // Always safe for UI
  const message = getUserFacingMessage(error);
  toast.error(message);

  // Specific error handling
  if (isApiErrorWithCode(error, "VALIDATION_ERROR")) {
    // Handle validation specifically
  }

  // For logging
  if (error instanceof ApiError) {
    console.error("API Error:", error.shape.correlationId);
  }
}
```

## OpenAPI Contract

Types are generated from `openapi/openapi.json` into each application's
`src/lib/api/contracts/schema.ts`:

```bash
# Regenerate both consumer copies after spec changes (Atlas maintainers)
pnpm api:gen

# Verify committed schemas match the spec (CI runs this)
pnpm api:check

# Per-workspace regeneration (only when debugging one app)
pnpm --filter @atlas/web api:gen
pnpm --filter @atlas/reference api:gen
```

After changing `openapi/openapi.json`, always run root `pnpm api:gen` so both `apps/web` and
`apps/reference` stay synchronized.

### Using Generated Types

```typescript
import type { components } from "@/lib/api/contracts";

type User = components["schemas"]["User"];
type CreateUserRequest = components["schemas"]["CreateUserRequest"];
```

## What Not To Do

```typescript
// ❌ Direct fetch in components
async function MyComponent() {
  const res = await fetch("/api/users"); // BLOCKED BY ESLINT
}

// ❌ Inline query keys
useQuery({ queryKey: ["users", "list"] }); // Use factory

// ❌ Hand-written types
interface User {
  id: string;
  name: string;
} // Use OpenAPI types

// ❌ Swallowing errors
try {
  await api.users.get(id);
} catch (e) {
  /* silence */
}
```

## Server-Side Data Fetching

### In Server Components

```typescript
import { serverApiRequest } from '@/lib/api/server';

export default async function UserPage({ params }: { params: { id: string } }) {
  const user = await serverApiRequest<User>(`/users/${params.id}`);
  return <div>{user.name}</div>;
}
```

### In Route Handlers

Route handlers ARE API boundaries — `fetch()` is allowed:

```typescript
// app/api/proxy/route.ts
export async function GET() {
  // ✅ This is allowed in route handlers
  const res = await fetch("https://external-api.com/data");
  return Response.json(await res.json());
}
```

## React Query Defaults

Configured in `src/lib/react-query/provider.tsx`:

| Setting                | Value | Why                           |
| ---------------------- | ----- | ----------------------------- |
| `staleTime`            | 60s   | Reduce unnecessary refetches  |
| `gcTime`               | 10min | Keep data for back navigation |
| `refetchOnWindowFocus` | false | Reduce noise                  |
| `retry`                | Smart | Only retry transient failures |

**Retried:**

- Network errors
- 408, 429, 502, 503, 504

**Not retried:**

- 400, 401, 403, 404, 422

## Related

- [ADR: Data Fetching Pattern](../adr/0003-data-fetching-react-query.md)
- [OpenAPI README](../../openapi/README.md)
