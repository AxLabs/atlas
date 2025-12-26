# Atlas

Enterprise-grade frontend platform built with Next.js, TypeScript, and Tailwind CSS.

## What is Atlas?

Atlas is a **soft monorepo** for building production-ready web applications. It provides:

- **Next.js App Router** with TypeScript strict mode
- **Tailwind CSS v4** with CSS-first theming
- **React Query** for type-safe data fetching
- **Shared UI library** with accessibility built in
- **Enterprise tooling**: ESLint, Prettier, Jest, Playwright

## Quick Start

```bash
# Prerequisites: Node.js >= 22, pnpm >= 10
corepack enable

# Install dependencies
pnpm install

# Setup environment
cp apps/web/.env.example apps/web/.env.local
# Fill in values, then:
pnpm --filter @atlas/web validate:env

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

````
atlas/
├── apps/web/           # Next.js application
├── packages/ui/        # Shared UI components
?o# Atlas

Enterprise-grade frontend platform built with Next.js, TypeSlatform documentation
?## What is Atlas?

Atlas is a **soft monorepo** for bu─ adr/            # Architecture decisions
└pe
- **Next.js App Router** with TypeScript strict mode
- cumentation

| Document | What You'- **Tailwind CSS v4** w-------------------|
| **[How - **React Query** for type-safe datad)** | Platform conventions, rules, patterns |
| **[Fol- **Enterprie](docs/how-we-build/folder-structure.md
## Quick Start

```bash
# Prerequisiment Variables](docs/how-we-build/env.md)** | Addcoreand using env vars |
| **[API & Data Fetching](docs/how-pnpm install

# Set| React Query, API client |
| **[Testi# Fill in values, then:
pnpmg.md)** | Test setup and patterns |
| **[Accessibility](docs/how-we-build/accessibility.md)** | a11y rules |
| **
## Project Structure

````

atlasr/README.md)\*\* | Why we made specific choices |

## Com├── packages/ui/environment variable

→ [docs/how-we-build/env.md](docs/how-we-build/env.md#addin Ente-enviro?## What is Atlas?

Atlas is a **soft monorepo** for bu─ adr/ #](docs/how-we-build/api.md└pe

- **Next.js App Router** with TypeScript strict modete in \`packages/ui/src/components/\`

2. Write tests (\`\*.test.tsx\`)
3. Export f | Docpackages/ui/src/index.ts\`
4. Add Storybook story

### Run tests

```bash
p| **[Fol           # Unit tests
pnpm test:e2e       # E2E tests
pnpm storybook      # Compon## Quics
```

## Commands

```bash
pnpm dev            # Start development
pnpm build          # Production build
pnpm lint           # Run ESLint
pnpm typecheck      # Ty
# Seipt check
pnpm test           # Run tests
pnpm storybook      # UI component pnpmg.md)**# Contributing

1. Read [How We Build](docs/how-we-build/README| **
## Project Structure

`nch
3. Ensure \`pnpm lint && pnpm typecheck && pnpm test\` pass
4. Open a PR

## License

MIT

---

**All platform conventions liv
→ [docs/how-we-build/env.md](docwe-build/).**
**All architectural decisions are documented in [docs/adr/](d
Atlasr/).**
```
