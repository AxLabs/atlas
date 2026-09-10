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

Proven in CI for both browsers:

- **Select** — keyboard open, typeahead navigation, keyboard selection, and focus return to the
  trigger
- **Dialog** — keyboard focus stays on dialog controls, Escape close, and focus return to the
  trigger. CI does **not** assert wrap-around across Chromium and WebKit.
- **DropdownMenu / Tooltip / Form / Button** — the keyboard and association checks in
  `visual-tests/cross-browser.spec.ts`

```bash
pnpm --filter @atlas/ui test:storybook:cross-browser
```

### Change detection

The UI Quality job runs on every push to `main`, and on pull requests whose changed files can affect
Storybook quality enforcement. Classification lives in `scripts/ui-quality-paths.mjs` (not a
workflow-only grep) so a PR that only edits `scripts/storybook-critical-policy.mjs`, its tests,
fixtures, or the path classifier still runs the gate.

### Visual regression

Visual tests render static Storybook iframes with deterministic themes and viewports. Screenshots
target the protected component or portaled overlay (dialog, menu, listbox, tooltip) rather than the
full viewport where practical, so empty pixels do not dilute regression sensitivity. **Pixel
baselines are Chromium-only** and committed under `packages/ui/visual-tests/__snapshots__/`.
Comparison uses a tight `maxDiffPixelRatio` of `0.005` after canonical GitHub-hosted `ubuntu-24.04`
Chromium capture.

Element-scoped baselines prove pixel stability of the captured element only, not full-page layout:
`dialog-open` captures the dialog surface itself (not the backdrop/overlay dimming behind it), and
`select-open` captures only the listbox, so its desktop and mobile baselines can be pixel-identical
when the listbox content doesn't resize between viewports — that is expected, not a coverage gap.

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

**Canonical environment:** the only source of truth for committed baselines is the GitHub-hosted
`ubuntu-24.04` runner used by the `ui-quality` workflow (`playwright install --with-deps chromium`).
Element-scoped baselines are captured from Storybook static iframes with `locale: en-US`,
`timezoneId: UTC`, and `reducedMotion: reduce`.

Docker (including the Noble container below) is a **close Linux reproduction for local debugging
only** — it is not equivalent to the GitHub-hosted runner. Font hinting and other rasterization
details can still differ even with a matching Playwright version, which can produce baselines that
pass locally but diff in CI (or vice versa):

```bash
pw_version=$(pnpm --filter @atlas/ui exec playwright --version | awk '{print $2}')
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" -w /work/packages/ui \
  "mcr.microsoft.com/playwright:v${pw_version}-noble" \
  bash -lc 'corepack enable && pnpm build-storybook && pnpm test:visual:update'
```

**Do not commit baselines generated locally or in Docker.** Open a draft PR and let the `ui-quality`
workflow regenerate and confirm the diff on the canonical GitHub-hosted runner first; a committed
baseline update must ultimately match what that runner produces.

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
