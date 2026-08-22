# Reference feature modules

Code in this directory is the **Atlas reference application** — a coherent, locally runnable
consumer journey that demonstrates how product teams should build on Atlas. It is **not shipped as
product functionality**.

## Structure

| Path                                  | Role                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `components/ReferenceShell.tsx`       | App-owned layout (desktop sidebar + mobile sheet nav, breadcrumbs, user area) |
| `components/ReferenceHarnessPage.tsx` | Developer persona/scenario controls                                           |
| `components/ReferenceOverview.tsx`    | Product-like landing page                                                     |
| `users/`                              | Typed OpenAPI users resource (hooks + UI)                                     |

The harness (`/reference/harness`) is intentionally separate from the product journey (`/reference`,
`/reference/users`, etc.).

Consumers may copy, adapt, or delete this code when building their own product.

Do not import reference modules from product features. Reference modules may import platform
infrastructure from `@/lib/*` and `@atlas/ui`.
