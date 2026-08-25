# Reference examples

> Minimal patterns you can copy when building on Atlas.

## Purpose

The `/examples` route group ships with the platform template. It is intentionally small:

- **Data fetching** — React Query hooks, query key factories, loading/empty/error/success states
- **Forms** — Zod validation, `useZodForm`, and server field error mapping

Delete `app/examples/`, `features/examples/`, and `app/api/examples/` when you start building your
product. The live Atlas showcase at [shipwithatlas.com](https://shipwithatlas.com) carries the full
demo surface.

## Routes

| Page        | Route            | What it shows                                          |
| ----------- | ---------------- | ------------------------------------------------------ |
| Overview    | `/examples`      | Links to reference pages                               |
| Data states | `/examples/data` | Mode switching via `?mode=success\|empty\|error\|slow` |
| Forms       | `/examples/form` | Create item with client + server validation            |

## API

In-memory mock routes (reset on server restart):

- `GET /api/examples/items?mode=...`
- `POST /api/examples/items`
- `PATCH /api/examples/items/[id]`

## OpenAPI reference

For typed external API consumers, see `apps/reference/src/features/users/` — hooks that call the
OpenAPI-generated client (`api.users.*`). The reference application wires these into full UI. See
[architecture ownership](architecture-ownership.md).

For the executable reference product journey, run `pnpm --filter @atlas/reference dev`.

## Related docs

- [API & data fetching](api.md)
- [Testing](testing.md)
- [Folder structure](folder-structure.md)
