---
"@atlas/ui": patch
---

Improve search input styling, badge alignment, and server-safe theme boot constants.

- Suppress native WebKit search controls on `Input` when `type="search"` so apps can provide a
  single explicit clear button.
- Center badge text with `leading-none` and give `xs` badges a stable fixed height.
- Export server-safe theme constants and a shared boot script helper for root layouts.
