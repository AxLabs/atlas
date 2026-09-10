# Storybook for Atlas UI

Storybook is the Atlas design system's isolated development and **CI quality surface** for
`@atlas/ui`.

## Quick start

```bash
# From the monorepo root
pnpm storybook

# Build the static artifact consumed by CI
pnpm storybook:build
# or
pnpm --filter @atlas/ui build-storybook
```

Development server: http://localhost:6006

Static output: `packages/ui/storybook-static/` (gitignored; produced in CI and local builds).

## Quality gates

Atlas enforces four complementary layers in the **UI Quality** GitHub Actions job:

| Layer                        | Command                                                | What it proves                                              |
| ---------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| Storybook build              | `pnpm --filter @atlas/ui build-storybook`              | Every story compiles and renders into the static artifact   |
| Critical story policy        | `node scripts/storybook-critical-policy.mjs`           | Protected stories retain tags, play, and axe requirements   |
| Interaction + axe            | `pnpm --filter @atlas/ui test:storybook`               | Critical stories run `play` functions and axe checks        |
| Cross-browser keyboard/focus | `pnpm --filter @atlas/ui test:storybook:cross-browser` | Chromium + WebKit exercise high-risk compositions           |
| Visual regression            | `pnpm --filter @atlas/ui test:visual`                  | Chromium element-scoped pixel baselines for the risk matrix |

Run the full local UI-quality bundle:

```bash
pnpm --filter @atlas/ui test:ui-quality
```

### Interaction and accessibility tests

`test:storybook` serves the **built** Storybook (`storybook-static`) and runs
`@storybook/test-runner` with `axe-playwright`.

- Only stories tagged `critical` are executed (see `.storybook/test-runner.ts`).
- The critical matrix is enforced by `critical-stories.json` and
  `node scripts/storybook-critical-policy.mjs` (runs in CI before the test runner).
- Accessibility exceptions are documented in `a11y-exceptions.json` (see `a11y-exceptions.md`).
- Do not globally disable axe rules or set `parameters.a11y.disable = true` on protected stories.

```bash
pnpm --filter @atlas/ui build-storybook
pnpm --filter @atlas/ui test:storybook
```

### Cross-browser checks

`test:storybook:cross-browser` targets the same static artifact with Playwright (Chromium + WebKit).
These tests focus on keyboard/focus seams Atlas owns; they do not duplicate the full story catalog.

```bash
pnpm --filter @atlas/ui test:storybook:cross-browser
```

### Visual regression

Visual tests render static Storybook iframes with deterministic themes and viewports. Screenshots
target the protected component or portaled overlay (dialog, menu, listbox, tooltip) rather than the
full viewport where practical, so empty pixels do not dilute regression sensitivity. **Pixel
baselines are Chromium-only** and committed under `packages/ui/visual-tests/__snapshots__/`.
Comparison uses a tight `maxDiffPixelRatio` of `0.005` after canonical GitHub-hosted `ubuntu-24.04`
Chromium capture.

```bash
pnpm --filter @atlas/ui build-storybook
pnpm --filter @atlas/ui test:visual
```

#### Updating baselines (maintainers only)

Never update baselines to silence CI. Review the diff, confirm the visual change is intentional,
then:

```bash
pnpm --filter @atlas/ui build-storybook
pnpm --filter @atlas/ui test:visual:update
```

**Canonical environment:** generate baselines on Linux with the same Playwright version as CI
(`ubuntu-24.04` + `playwright install --with-deps chromium`). Element-scoped baselines are captured
from Storybook static iframes with `locale: en-US`, `timezoneId: UTC`, and `reducedMotion: reduce`.
For a containerized update matching CI:

```bash
pw_version=$(pnpm --filter @atlas/ui exec playwright --version | awk '{print $2}')
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" -w /work/packages/ui \
  "mcr.microsoft.com/playwright:v${pw_version}-noble" \
  bash -lc 'corepack enable && pnpm build-storybook && pnpm test:visual:update'
```

CI uploads `test-results/`, `playwright-report-visual/`, and `playwright-report-storybook/` when
visual tests fail.

## Writing critical stories

Add or update entries in `critical-stories.json` when changing the protected matrix. Tag
representative stories with `critical` to include them in interaction/axe CI:

```tsx
export const KeyboardInteraction: Story = {
  tags: ["critical"],
  play: async ({ canvasElement }) => {
    // use screen.* for portaled content (Dialog, Select listbox, menus)
  },
};
```

Prioritize Atlas-owned seams for Base UI-backed primitives (trigger composition, focus return, theme
styling) rather than re-testing upstream internals.

## Visual matrix policy

- **Themes:** light + dark for protected states
- **Responsive reference:** 390×844 where layout matters (Dialog, Select, DropdownMenu, Form,
  Empty/Error)
- **Pixel baselines:** Chromium only (WebKit is interaction-tested, not pixel-gated)
- **Network:** no remote fonts, analytics, or external image hosts in gated stories

## Addons

- `@storybook/addon-essentials`
- `@storybook/addon-interactions`
- `@storybook/addon-a11y`
- `@storybook/addon-themes` (light/dark via `withThemeByClassName`)

## Visual regression vs Chromatic

Atlas uses **committed Playwright baselines** instead of Chromatic so forks and OSS contributors can
run the same gate without tokens or paid services. The unused `@chromatic-com/storybook` dependency
was removed.

## Related docs

- [Testing](../../docs/how-we-build/testing.md)
- [Testing risk matrix](../../docs/how-we-build/testing-risk-matrix.md)
- [Accessibility](../../docs/how-we-build/accessibility.md)
