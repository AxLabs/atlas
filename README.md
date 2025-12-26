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

```
atlas/
├── apps/web/           # Next.js application
├── packages/ui/        # Shared UI components
├── packages/config/    # Shared configuration
├── docs/               # Platform documentation
│   ├── how-we-build/   # Conventions and patterns
│   └── adr/            # Architecture decisions
└── tools/              # Build and dev tools
```

## Documentation

| Document                                                      | What You'll Learn                     |
| ------------------------------------------------------------- | ------------------------------------- |
| **[How We Build](docs/how-we-build/README.md)**               | Platform conventions, rules, patterns |
| **[Folder Structure](docs/how-we-build/folder-structure.md)** | Where code lives                      |
| **[Environment Variables](docs/how-we-build/env.md)**         | Adding and using env vars             |
| **[API & Data Fetching](docs/how-we-build/api.md)**           | React Query, API client               |
| **[Testing](docs/how-we-build/testing.md)**                   | Test setup and patterns               |
| **[Accessibility](docs/how-we-build/accessibility.md)**       | a11y rules                            |
| **[ADRs](docs/adr/README.md)**                                | Why we made specific choices          |
| **[Demo](docs/how-we-build/demo.md)**                         | Atlas Showcase demo section           |

## Common Tasks

### Add a new environment variable

→ [docs/how-we-build/env.md](docs/how-we-build/env.md#adding-new-environment-variables)

### Add a new API endpoint hook

→ [docs/how-we-build/api.md](docs/how-we-build/api.md)

### Add a new UI component

1. Create component in `packages/ui/src/components/`
2. Write tests (`*.test.tsx`)
3. Export from `packages/ui/src/index.ts`
4. Add Storybook story

### Run tests

```bash
pnpm test           # Unit tests
pnpm test:e2e       # E2E tests
pnpm storybook      # Component explorer
```

## Commands

```bash
pnpm dev            # Start development
pnpm build          # Production build
pnpm lint           # Run ESLint
pnpm typecheck      # TypeScript check
pnpm test           # Run tests
pnpm storybook      # UI component explorer
```

## Contributing

1. Read [How We Build](docs/how-we-build/README.md)
2. Create a feature branch
3. Ensure `pnpm lint && pnpm typecheck && pnpm test` pass
4. Open a PR

## License

MIT

---

**All platform conventions live in [docs/how-we-build/](docs/how-we-build/).**

**All architectural decisions are documented in [docs/adr/](docs/adr/).**
