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
- **Dialog** — keyboard navigation between dialog controls (Cancel → Continue → boundary probe),
  Escape close, and focus return to the trigger. The boundary probe confirms focus cannot escape the
  modal; it accepts Base UI focus-guard sentinel elements and does not require a strict first/last
  wrap assertion (to avoid cross-engine flakiness).
- **DropdownMenu** — keyboard open, item navigation, activation of the intended item (proven via
  observable `onSelect` state), and focus return to the trigger
- **Tooltip** — keyboard focus shows the tooltip; Escape dismisses it and returns focus to trigger
- **Form** — Tab reaches the enabled input in expected order; error state (aria-invalid, accessible
  description) survives keyboard interaction; disabled fields are not keyboard-focusable via Tab
- **Button** — native button semantics and disabled state

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

Element-scoped baselines prove pixel stability of the captured element only, not full-page layout.
Coverage notes:

- `dialog-open` captures the dialog surface itself (not the backdrop/overlay dimming behind it).
- `select-open` captures only the listbox; its desktop and mobile baselines can be pixel-identical
  when the listbox content doesn't resize between viewports — that is expected.
- `empty-state` and `error-fallback` use a responsive container (`width: 100%; max-width: 640px`) so
  mobile baselines capture actual responsive rendering at 390 px rather than overflow from a fixed
  500 px wrapper.
- `Select`, `Dialog`, `DropdownMenu`, and `Tooltip` visual screenshots capture the trigger or
  overlay element individually. Full-composition screenshots (trigger + open overlay in one frame)
  are not included because the backdrop/portal z-stacking makes them layout-sensitive and prone to
  flakiness; this is a documented coverage boundary, not a gap — the open portal surface is
  exercised by the `AxeOpen*` Storybook interaction stories (axe audit) and the cross-browser
  Playwright tests (keyboard interaction).

```bash
pnpm --filter @atlas/ui build-storybook
pnpm --filter @atlas/ui test:visual
```

#### Updating baselines (maintainers only)

Never update baselines to silence CI. Review the diff, confirm the visual change is intentional,
then follow the canonical procedure below.

**Canonical baseline-update procedure** (the only accepted source of truth):

1. Trigger the **Update Visual Baselines** workflow manually via the GitHub Actions UI
   (`Actions → Update Visual Baselines → Run workflow`). This runs on the same `ubuntu-24.04`
   GitHub-hosted runner as regular UI Quality CI.
2. Wait for the workflow to complete. Download the `candidate-visual-baselines-<run-id>` artifact
   from the workflow run summary.
3. **Review every PNG carefully.** Confirm each visual change is intentional.
4. Copy the reviewed PNGs into `packages/ui/visual-tests/__snapshots__/visual.spec.ts/`.
5. Commit the reviewed PNGs on a branch and open a PR.
6. The regular `ui-quality` workflow verifies the new baselines on that PR.

The update workflow does **not** auto-commit or auto-approve visual changes — a human review step is
required before any baseline lands on `main`.

**Do not capture baselines locally or in Docker.** Font hinting and other rasterization details
differ from the GitHub-hosted runner even with the same Playwright version; locally-captured
baselines can pass locally but diff in CI (or vice versa).

CI uploads `test-results/`, `playwright-report-visual/`, and `playwright-report-storybook/` when
visual tests fail (HTML reports are generated only in CI via the `CI=true` environment variable).

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
