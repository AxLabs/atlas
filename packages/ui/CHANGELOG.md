# @atlas/ui

## 1.1.0

## 1.0.1

## 1.0.0

## 0.5.0

## 0.4.0

### Patch Changes

- aaebdf3: Declare `@types/node` on `@atlas/ui` and include Node in the UI typecheck tsconfig so
  generated projects do not depend on source-monorepo hoisting or omitted Vite types.

## 0.3.0

## 0.2.1

## 0.2.0

### Patch Changes

- dbafd6b: Improve search input styling, badge alignment, and server-safe theme boot constants.

  - Suppress native WebKit search controls on `Input` when `type="search"` so apps can provide a
    single explicit clear button.
  - Center badge text with `leading-none` and give `xs` badges a stable fixed height.
  - Export server-safe theme constants and a shared boot script helper for root layouts.
