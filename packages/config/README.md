# @atlas/config

Shared tooling configuration for the Atlas monorepo.

## Why this package exists

`@atlas/config` centralizes ESLint, TypeScript, Jest, and Prettier settings so every workspace
package shares the same quality baseline without duplicating config files.

| Export                                   | Purpose                          |
| ---------------------------------------- | -------------------------------- |
| `@atlas/config/eslint`                   | ESLint flat config base          |
| `@atlas/config/typescript`               | Base TypeScript compiler options |
| `@atlas/config/typescript/nextjs`        | Next.js app tsconfig extends     |
| `@atlas/config/typescript/react-library` | Package library tsconfig extends |
| `@atlas/config/prettier`                 | Prettier formatting rules        |
| `@atlas/config/jest`                     | Jest base configuration          |

## What it does not own

- Application code or runtime behavior
- Environment variables or deployment configuration
- Package public APIs (`@atlas/ui`, `@atlas/consent`)

This is a **devDependency-only** tooling boundary. It does not ship to production.

See [architecture ownership](../../docs/how-we-build/architecture-ownership.md).
