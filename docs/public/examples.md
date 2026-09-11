# Examples

> Minimal reference patterns included in the platform template.

---

## Purpose

Atlas ships with a small `/examples` section so you can see core patterns working in real code.
These pages are **not** a full product demo — they are copy-friendly references meant to be removed
once you start building.

For a comprehensive live showcase, see [shipwithatlas.com](https://shipwithatlas.com).

---

## Pages

### Data fetching (`/examples/data`)

Demonstrates React Query with intentional UI states:

| Mode    | URL                           | Behavior                              |
| ------- | ----------------------------- | ------------------------------------- |
| Success | `/examples/data?mode=success` | Renders sample items                  |
| Empty   | `/examples/data?mode=empty`   | Designed empty state                  |
| Error   | `/examples/data?mode=error`   | Error fallback with correlation ID    |
| Slow    | `/examples/data?mode=slow`    | Extended loading for skeleton testing |

### Forms (`/examples/form`)

Demonstrates Zod + React Hook Form with server validation error mapping via
`applyServerFieldErrors`.

---

## When to delete

After forking Atlas for a new product:

1. Remove `app/examples/`
2. Remove `features/examples/`
3. Remove `app/api/examples/`
4. Update the homepage CTA in `app/page.tsx`

Study `apps/reference/src/features/users/` for OpenAPI-backed APIs in the reference application, or
remove `apps/reference/` once you have your own feature modules.
