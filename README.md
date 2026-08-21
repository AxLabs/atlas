# Atlas

Enterprise-grade frontend platform built with Next.js, TypeScript, and Tailwind CSS.

## What is Atlas?

Atlas is a **forkable frontend platform template** for building production-ready web applications.
Selected clients, invited collaborators, and authorized evaluators receive repository access under
engagement or evaluation terms. It is not a general public open-source offering.

The platform provides opinionated patterns for authentication, data fetching, validation, theming,
accessibility, and observability—so teams can focus on shipping product.

Authorized clients fork or branch the repository, explore the minimal `/examples` reference pages,
delete them, and build on the platform primitives in `lib/`, `providers/`, and `packages/ui`.

---

## Documentation

| Audience                                               | Documentation                                                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **External** (evaluation, onboarding, architecture)    | **[Public Docs](docs/public/README.md)**                                                                    |
| **Contributors** (maintainers, clients, collaborators) | [CONTRIBUTING.md](CONTRIBUTING.md), [How We Build](docs/how-we-build/README.md), [ADRs](docs/adr/README.md) |

### Public Documentation

- [Overview](docs/public/README.md) — What Atlas is and who it's for
- [Quickstart](docs/public/quickstart.md) — What to expect when running Atlas
- [Architecture](docs/public/architecture.md) — System design and mental model
- [Examples](docs/public/examples.md) — Minimal reference patterns in the template
- [Capabilities](docs/public/capabilities.md) — What Atlas solves and why
- [Decisions](docs/public/decisions.md) — Key engineering choices
- [FAQ](docs/public/faq.md) — Common questions answered

### Reference examples (in-repo)

| Route            | What it demonstrates                            |
| ---------------- | ----------------------------------------------- |
| `/examples`      | Overview of included reference patterns         |
| `/examples/data` | React Query, loading/empty/error/success states |
| `/examples/form` | Zod validation and server field error mapping   |

Delete these when you start building your product. The interactive showcase lives at
[shipwithatlas.com](https://shipwithatlas.com)
([blitzcraftlabs/atlas-showcase](https://github.com/blitzcraftlabs/atlas-showcase)).

---

## Quick Start

Requires repository access. See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
# Prerequisites: Node.js >= 22, pnpm >= 10
corepack enable

# Install dependencies
pnpm install

# Setup environment
cp apps/web/.env.example apps/web/.env.local
pnpm validate:env

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
├── docs/
│   ├── public/         # External-facing documentation
│   ├── how-we-build/   # Internal conventions and patterns
│   └── adr/            # Architecture decisions
└── tools/              # Build and dev tools
```

---

## Internal Documentation

| Document                                                                  | What You'll Learn                     |
| ------------------------------------------------------------------------- | ------------------------------------- |
| **[CONTRIBUTING.md](CONTRIBUTING.md)**                                    | Access model, PRs, validation         |
| **[How We Build](docs/how-we-build/README.md)**                           | Platform conventions, rules, patterns |
| **[Folder Structure](docs/how-we-build/folder-structure.md)**             | Where code lives                      |
| **[Environment Variables](docs/how-we-build/env.md)**                     | Adding and using env vars             |
| **[API & Data Fetching](docs/how-we-build/api.md)**                       | React Query, API client               |
| **[Testing](docs/how-we-build/testing.md)**                               | Test setup and patterns               |
| **[Accessibility](docs/how-we-build/accessibility.md)**                   | a11y rules                            |
| **[Examples](docs/how-we-build/examples.md)**                             | Reference pages in the template       |
| **[Claims register](docs/audit/claims-register.md)**                      | Material claims and evidence          |
| **[Releases & Governance](docs/how-we-build/releases-and-governance.md)** | Versioning, licensing, releases       |
| **[ADRs](docs/adr/README.md)**                                            | Why we made specific choices          |

---

## Common Tasks

### Add a new environment variable

→ [docs/how-we-build/env.md](docs/how-we-build/env.md#adding-a-new-environment-variable)

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

---

## Commands

```bash
pnpm dev            # Start development
pnpm build          # Production build
pnpm lint           # Run ESLint
pnpm typecheck      # TypeScript check
pnpm test           # Run tests
pnpm docs:check     # Validate internal documentation links
pnpm governance:check  # Release/licensing policy invariants
pnpm storybook      # UI component explorer
```

---

## Contributing

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for access model, branch practices, validation, and PR
expectations.

---

## License and access

Atlas is **licensed under Apache License 2.0** ([`LICENSE`](LICENSE)). Public repository
availability and the first canonical GitHub Release are part of issue
[#24](https://github.com/blitzcraftlabs/atlas/issues/24). Repository access today remains
engagement-based for clients and collaborators.

Release governance: [Releases and Governance](docs/how-we-build/releases-and-governance.md).
