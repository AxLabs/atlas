# Reference: OpenAPI-backed users feature

Canonical typed-resource pattern for Atlas — React Query hooks **and** consuming UI for the
reference application.

## Hooks

- `useUserList`, `useUser` — queries via `useTypedApiClient()` → `api.users.*`
- `useCreateUser`, `useUpdateUser`, `useDeleteUser` — mutations with cache invalidation

## UI

- `UserListView` — table with loading, empty, error, and retry states; user names link to detail
- `UserDetailView` — detail with permission-gated edit/delete
- `UserForm` — create/edit with Zod, `useZodForm`, and `applyServerFieldErrors`

Routes under `app/reference/users/**` compose these components (thin pages).

## Scenarios

API behavior is controlled by the harness (`/reference/harness`) via the `atlas_reference_scenario`
cookie — do not fake failure states inside components.
