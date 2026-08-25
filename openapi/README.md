# OpenAPI Contract Generation

This directory contains the OpenAPI specification for the Atlas API.

## Files

- `openapi.json` - OpenAPI 3.0 specification (source of truth for API contracts)

## Generating TypeScript Types

From the monorepo root (regenerates **both** consumer applications):

```bash
pnpm api:gen
```

This generates TypeScript types from the OpenAPI spec into each application:

- **Input**: `openapi/openapi.json`
- **Output**:
  - `apps/web/src/lib/api/contracts/schema.ts`
  - `apps/reference/src/lib/api/contracts/schema.ts`

CI enforces freshness with:

```bash
pnpm api:check
```

Per-workspace commands exist for debugging one app only — do not use them as the normal maintainer
workflow after changing the shared spec:

```bash
pnpm --filter @atlas/web api:gen
pnpm --filter @atlas/reference api:gen
```

The Atlas project contract (`atlas.config.json`) identifies the starter application's generated
schema as the canonical contract artifact. The reference application owns a second copy because it
is an independent consumer application. Root `api:gen` and CI `api:check` keep both synchronized.

## Updating the API Contract

1. **Edit the spec**: Update `openapi.json` to match backend changes
2. **Regenerate types**: Run `pnpm api:gen` from the monorepo root
3. **Commit both files**: The spec AND both generated schemas must be committed together
4. **TypeScript will catch breaking changes**: Compile errors indicate contract changes

## Example API Spec

The current spec includes example endpoints:

- `GET /health` - Health check
- `GET /users` - List users (with pagination & search)
- `POST /users` - Create user
- `GET /users/{userId}` - Get user by ID
- `PATCH /users/{userId}` - Update user
- `DELETE /users/{userId}` - Delete user

All error responses follow the standard `ApiError` shape defined in components.

## Integration

Generated types are used by the typed API client:

```ts
import { useTypedApiClient } from "@/lib/api";

// Client components — runtime base URL from useConfig()
function UserList() {
  const api = useTypedApiClient();
  const users = await api.users.list({ page: 1, pageSize: 20 });
}

// Server-side — bind to configured base URL
import { createApi } from "@/lib/api/contracts";
import { getApiBaseUrl } from "@/lib/api/config";

const api = createApi(await getApiBaseUrl());
const user = await api.users.get("user-123");
```

## Updating for Your Backend

1. Replace example endpoints with your actual API
2. Update server URLs to match your environments
3. Define all request/response schemas
4. Ensure error responses match the `ApiError` component schema
5. Run `pnpm api:gen` to update types
6. Commit `openapi.json` and generated `schema.ts` files

## Tools

- **Generator**: [openapi-typescript](https://github.com/openapi-ts/openapi-typescript)
- **Validator**: Use [Swagger Editor](https://editor.swagger.io/) to validate the spec
- **Mock Server** (optional): Use [Prism](https://stoplight.io/open-source/prism) for local API
  mocking

## Notes

- The spec should be committed to version control
- Generated types should also be committed (not gitignored)
- This ensures deterministic builds without requiring a running backend
- When the backend API changes, update the spec first, then regenerate
