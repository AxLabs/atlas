# Accessibility

> Semantic HTML, keyboard support, visible focus. No exceptions.

## The Rules

| Rule                           | Enforcement                                       |
| ------------------------------ | ------------------------------------------------- |
| **Use semantic HTML**          | `<button>`, `<a>`, not clickable `<div>`          |
| **All images need alt**        | ESLint jsx-a11y/alt-text                          |
| **All inputs need labels**     | Visible label or aria-label                       |
| **Focus must be visible**      | `focus-visible:ring-*` utilities                  |
| **jsx-a11y baseline**          | ESLint errors for listed rules (not full WCAG CI) |
| **Never `outline-none` alone** | Must pair with visible focus style                |

## ESLint Baseline

We use `eslint-plugin-jsx-a11y` to catch common issues. These rules error:

- `alt-text` — Images must have alt
- `anchor-is-valid` — Links need href or button behavior
- `click-events-have-key-events` — Clickable elements need keyboard support
- `no-static-element-interactions` — No click handlers on divs/spans
- `label-has-associated-control` — Inputs need labels

## Common Fixes

### ❌ Clickable div → ✅ Button

```tsx
// ❌ Bad
<div onClick={handleClick}>Click me</div>

// ✅ Good
<button onClick={handleClick}>Click me</button>
```

### ❌ Missing alt → ✅ Alt text

```tsx
// ❌ Bad
<img src="/logo.png" />

// ✅ Good (meaningful)
<img src="/logo.png" alt="Atlas company logo" />

// ✅ Good (decorative)
<img src="/divider.png" alt="" />
```

### ❌ Input without label → ✅ Labeled input

```tsx
// ❌ Bad
<input type="email" placeholder="Email" />

// ✅ Good (visible label)
<label htmlFor="email">Email</label>
<input id="email" type="email" />

// ✅ Good (aria-label for icon-only inputs)
<input type="search" aria-label="Search users" />
```

### ❌ Hidden focus → ✅ Visible focus

```tsx
// ❌ Bad
<button className="outline-none">Click</button>

// ✅ Good
<button className="outline-none focus-visible:ring-2 focus-visible:ring-primary">
  Click
</button>
```

## Keyboard Patterns

### Interactive Elements

| Element | Expected Behavior                  |
| ------- | ---------------------------------- |
| Button  | Enter/Space activates              |
| Link    | Enter navigates                    |
| Select  | Arrow keys navigate, Enter selects |
| Modal   | Escape closes, Tab trapped inside  |
| Menu    | Arrow keys navigate, Escape closes |

### Focus Management

```tsx
// ✅ Use our Dialog component — it handles focus
import { Dialog, DialogContent, DialogTrigger } from "@atlas/ui";

<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    {/* Focus is trapped here */}
    {/* Escape closes */}
    {/* Focus returns to trigger on close */}
  </DialogContent>
</Dialog>;
```

## Form Accessibility

### Required Fields

```tsx
<label htmlFor="email">
  Email <span aria-hidden="true">*</span>
</label>
<input
  id="email"
  type="email"
  required
  aria-required="true"
/>
```

### Error Messages

```tsx
<label htmlFor="email">Email</label>
<input
  id="email"
  type="email"
  aria-invalid={hasError}
  aria-describedby={hasError ? 'email-error' : undefined}
/>
{hasError && (
  <span id="email-error" role="alert">
    Please enter a valid email
  </span>
)}
```

### Disabled State

```tsx
<button disabled={isSubmitting} aria-disabled={isSubmitting}>
  {isSubmitting ? "Submitting..." : "Submit"}
</button>
```

## Loading States

```tsx
// ✅ Announce to screen readers
{
  isLoading && (
    <div role="status" aria-live="polite">
      <Spinner />
      <span className="sr-only">Loading users...</span>
    </div>
  );
}

// ✅ Error states
{
  error && <div role="alert">{error.message}</div>;
}
```

## Component Library

`@atlas/ui` interactive primitives primarily use Base UI through shadcn-generated component shells,
with native-DOM shadcn components where appropriate. Atlas wrappers preserve upstream accessibility
semantics:

- **Dialog** — Base UI focus trapping and Escape handling
- **DropdownMenu** — Accessible upstream menu primitives with keyboard navigation
- **Select** — Accessible upstream select primitives with keyboard-native behavior
- **Tooltip** — Screen reader accessible upstream tooltip behavior

**Use these instead of building custom solutions.**

## Testing Accessibility

Atlas uses **layered** accessibility verification. None of these layers alone proves WCAG
certification.

| Layer                              | What it catches                             | CI gate                                                             |
| ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| ESLint `jsx-a11y`                  | Common markup mistakes in app code          | `pnpm lint`                                                         |
| Storybook axe (`critical` stories) | Representative composition violations       | `pnpm --filter @atlas/ui test:storybook`                            |
| Storybook interactions             | Keyboard/focus seams on critical primitives | `pnpm --filter @atlas/ui test:storybook` + cross-browser Playwright |
| Jest / RTL                         | Form association, owned wrappers            | `pnpm test:risk-coverage`                                           |
| Manual checklist (below)           | Screen reader, zoom, contrast review        | PR review for complex UI                                            |

### Manual checklist

Use this checklist when shipping a **new complex component**, a **material interaction change**, or
a **major design-system release**:

1. Keyboard-only navigation through the full flow
2. Visible focus on every interactive control
3. Logical focus order and focus restoration after dialogs/menus
4. Screen-reader accessible names and state announcements
5. Form labels, errors, and `aria-invalid` / `aria-describedby` wiring
6. Dialog/modal escape and focus trap behavior
7. Zoom/reflow at 200% without loss of content or controls
8. Reduced-motion behavior where animations communicate state
9. Touch target size on mobile layouts (reference 390×844)
10. Light and dark contrast review for text and controls

This is guidance for human review, not a certification checklist.

### Manual keyboard smoke test

Before submitting a PR with interaction changes:

1. Tab through all interactive elements
2. Verify focus is visible
3. Test Enter/Space on buttons
4. Test Escape on modals/menus
5. Test Arrow keys in menus

### Storybook automation

Representative `critical` Storybook compositions are checked with axe and interaction tests in the
**UI Quality** workflow. See `packages/ui/.storybook/README.md`.

The Storybook Accessibility addon tab remains useful for local exploration but is not the CI gate.

### Screen Reader Testing (Optional)

- **macOS**: VoiceOver (Cmd + F5)
- **Windows**: NVDA (free)

## What Not To Do

```tsx
// ❌ Link without href
<a onClick={handleClick}>Click</a>

// ❌ Button for navigation
<button onClick={() => router.push('/page')}>Go</button>

// ❌ Div with click handler
<div onClick={handleClick} role="button">Click</div>

// ❌ Removing focus without replacement
<button className="outline-none">Bad</button>

// ❌ Using :focus instead of :focus-visible
<button className="focus:ring-2">Also bad</button>
```

```tsx
// ✅ Link for navigation
<Link href="/page">Go to page</Link>

// ✅ Button for actions
<button onClick={handleAction}>Do thing</button>

// ✅ Focus-visible for custom focus styles
<button className="outline-none focus-visible:ring-2 focus-visible:ring-primary">
  Good
</button>
```

## Quick Reference

| Need               | Do This                             |
| ------------------ | ----------------------------------- |
| Action             | `<button>`                          |
| Navigation         | `<Link>` or `<a href="">`           |
| Image with meaning | `<img alt="description">`           |
| Decorative image   | `<img alt="">`                      |
| Form input         | `<input>` with `<label>`            |
| Icon button        | `<button aria-label="description">` |
| Loading state      | `<div role="status">`               |
| Error message      | `<div role="alert">`                |
| Focus style        | `focus-visible:ring-*`              |

## Resources

- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM](https://webaim.org/)
- [jsx-a11y Rules](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y#supported-rules)
