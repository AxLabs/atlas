# Atlas

Enterprise-grade frontend platform monorepo built with Next.js, TypeScript, Tailwind CSS, and modern
tooling.

## Architecture

This is a **soft monorepo** using pnpm workspaces and Turborepo, designed for stability,
maintainability, and team productivity.

### Structure

```
atlas/
├── apps/
│   └── web/              # Next.js App Router application
├── packages/
│   ├── ui/               # Shared UI component library
│   └── config/           # Shared configuration (ESLint, TS, Jest, Prettier)
├── .github/
│   └── workflows/        # CI/CD workflows
└── docs/                 # Platform documentation
```

## Quick Start

### Prerequisites

- **Node.js** >= 22.0.0 (LTS)
- **pnpm** >= 10.0.0

> **⚠️ Package Manager Policy**: Atlas enforces pnpm as the only supported package manager. npm,
> yarn, and bun are not supported. See [Toolchain Policy](docs/TOOLCHAIN_POLICY.md) for details.

### Installation

```bash
# Enable Corepack (one-time setup)
corepack enable

# Install dependencies
pnpm install

# Setup environment variables
cp apps/web/.env.example apps/web/.env.local
# Fill in values, then validate:
pnpm --filter @atlas/web validate:env

# Start development server
pnpm dev
```

The web app will be available at [http://localhost:3000](http://localhost:3000).

> **Environment Variables**: See [Environment Variables Guide](docs/ENVIRONMENT_VARIABLES.md) for
> complete documentation on setup, validation, and best practices.

## Workspace Packages

### Apps

- **`@atlas/web`** - Main Next.js application
  - App Router with `/src` directory
  - Feature-based organization recommended
  - Full provider setup (Theme, React Query, Toast)
  - Environment validation with Zod

### Packages

- **`@atlas/ui`** - Shared UI components

  - Built with Tailwind CSS, CVA, and clsx
  - Components: Button, Card, Alert, Skeleton, EmptyState, ErrorMessage, and more
  - Full test coverage with Jest + RTL
  - Tailwind preset export for consumption
  - **Interactive documentation with Storybook** - Run `pnpm storybook` to view all components

- **`@atlas/config`** - Shared configurations
  - ESLint config (TypeScript, React, a11y, import sorting)
  - TypeScript configs (base, Next.js, React library)
  - Prettier config (with Tailwind plugin)
  - Jest preset for React components

## Development

### Available Commands

```bash
# Development
pnpm dev                  # Start all apps in dev mode
pnpm build                # Build all apps and packages
pnpm start                # Start production server (web app)
pnpm storybook            # Start Storybook for UI components

# Code Quality
pnpm lint                 # Run ESLint across workspace
pnpm lint:fix             # Auto-fix ESLint issues
pnpm format               # Format all files with Prettier
pnpm format:check         # Check formatting without writing
pnpm typecheck            # Run TypeScript type checking

# Testing
pnpm test                 # Run unit tests
pnpm test:watch           # Run tests in watch mode
pnpm test:e2e             # Run Playwright E2E tests

# Documentation
pnpm build-storybook      # Build static Storybook documentation

# Maintenance
pnpm clean                # Clean all build artifacts and node_modules
```

### Working on Features

We recommend **feature-sliced design** in `apps/web/src/features/`:

```
src/
├── app/                  # Next.js App Router pages
├── features/             # Feature modules
│   └── my-feature/
│       ├── components/   # Feature-specific components
│       ├── hooks/        # Feature-specific hooks
│       ├── api/          # API calls for this feature
│       └── index.ts      # Public exports
├── lib/                  # Shared utilities
└── providers/            # Global providers
```

### Adding a New Component to UI Package

1. Create component in `packages/ui/src/components/`
2. Write tests alongside (`.test.tsx`)
3. Export from `packages/ui/src/index.ts`
4. Run `pnpm test` to verify

### Adding a New App

```bash
# Create new app directory
mkdir -p apps/new-app

# Copy structure from apps/web
# Update pnpm-workspace.yaml if needed (already includes apps/*)
```

## Testing

### Unit Tests (Jest + React Testing Library)

- Located in `packages/ui/src/**/*.test.tsx`
- Run with `pnpm test`
- Coverage configured in `packages/config/jest.config.js`

### E2E Tests (Playwright)

- Located in `apps/web/e2e/`
- Run with `pnpm test:e2e`
- Smoke tests cover critical user paths

## Component Documentation (Storybook)

Atlas UI components are documented and showcased using **Storybook**, providing:

- **Interactive component playground** - Test components with different props and states
- **Automatic documentation** - Props tables and usage examples
- **Dark mode testing** - Toggle between light and dark themes
- **Accessibility testing** - Built-in a11y checks for WCAG compliance
- **Responsive testing** - View components at different viewport sizes

### Running Storybook

```bash
# Start Storybook development server
pnpm storybook

# Available at http://localhost:6006
```

### Building Storybook

```bash
# Build static documentation site
pnpm build-storybook

# Output: packages/ui/storybook-static/
```

See [Storybook README](packages/ui/.storybook/README.md) for more details on writing stories and
deployment.

## Styling

### Tailwind CSS

- Using Tailwind CSS v4 with `@tailwindcss/postcss`
- Design tokens defined in `packages/ui/src/styles/globals.css` (CSS variables)
- Dark mode via `class` strategy
- Configuration is CSS-based - simply import `@atlas/ui/styles` in your app

## Quality Gates

All commits must pass:

1. **Pre-commit** (Husky + lint-staged):

   - Prettier formatting
   - ESLint auto-fix on staged files

2. **Pre-push** (Husky):

   - TypeScript type checking
   - Unit tests

3. **CI Pipeline** (GitHub Actions):
   - Lint
   - Format check
   - Type check
   - Unit tests
   - Build
   - E2E tests

## Documentation

- **[Toolchain Policy](docs/TOOLCHAIN_POLICY.md)** - Package manager enforcement and setup guide
- **[Platform Principles](docs/platform-principles.md)** - Code organization, component boundaries,
  testing strategies
- **[Environment Variables](docs/ENVIRONMENT_VARIABLES.md)** - Complete guide to setup, validation,
  and security
- **[Atlas Context](docs/ATLAS_CONTEXT.md)** - Platform philosophy and goals

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes with clear, atomic commits
3. Ensure all quality gates pass: `pnpm lint && pnpm typecheck && pnpm test`
4. Push and open a PR

## License

MIT

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Turborepo Docs](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
