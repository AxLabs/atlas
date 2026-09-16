# Third-Party Notices

Atlas (`@atlas/monorepo`) is licensed under [Apache-2.0](LICENSE). This file records **copied or
adapted third-party source** and other attribution that is prudent for public redistribution. It
does **not** list every npm dependency — run `pnpm licenses:report` for the dependency license
inventory.

> Engineering evidence only — not legal advice or a compliance certification.

## shadcn/ui component source (`packages/ui`)

Many files under `packages/ui/src/components/ui/` were generated or refreshed from
[shadcn/ui](https://ui.shadcn.com) using the locked Base UI Vega preset (`components.json`, preset
`bJzBPQGZc`), including native-DOM templates that do not import `@base-ui/react`. Atlas has modified
styling tokens, control geometry, behavioral wrappers, and monorepo integration since generation.
See [provenance.md](docs/how-we-build/provenance.md) for the file-level audit.

| Upstream                                         | License | Atlas use                                                                                                                 | Notice                              |
| ------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| [shadcn/ui](https://github.com/shadcn-ui/ui)     | MIT     | Copied/adapted shadcn-generated or refreshed component source in `packages/ui/src/components/ui/` (see provenance record) | MIT notice below                    |
| [@base-ui/react](https://github.com/mui/base-ui) | MIT     | **Dependency only** — imported primitives, not copied source                                                              | Covered by npm dependency inventory |
| [Lucide](https://lucide.dev)                     | ISC     | **Dependency only** — icon imports                                                                                        | Covered by npm dependency inventory |

### shadcn/ui MIT License (component source provenance)

```text
MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Source: https://github.com/shadcn-ui/ui/blob/main/LICENSE.md (retrieved 2026-08-27)

Individual component files do not repeat this header unless required; this notice covers
shadcn-generated or refreshed component source under `packages/ui/src/components/ui/`, as identified
in [provenance.md](docs/how-we-build/provenance.md). Atlas-authored compositions in that directory
(`empty-state`, `error-fallback`, `loader`, `theme-toggle`) are Apache-2.0 and not covered by this
MIT notice.

## Historical Radix-era UI source (Git history only)

Before commit `3099c4b` (`feat(ui): reset @atlas/ui onto shadcn Base UI Vega preset (#42)`), many UI
primitives under `packages/ui/src/components/ui/` imported `@radix-ui/*` via shadcn's Radix-era
templates. Current HEAD uses `@base-ui/react` instead. If public Git history includes that period,
historical blobs remain recoverable.

| Upstream                                                   | License | Period                    | Notice                                                                              |
| ---------------------------------------------------------- | ------- | ------------------------- | ----------------------------------------------------------------------------------- |
| [Radix UI Primitives](https://www.radix-ui.com/primitives) | MIT     | `abbc212` … pre-`3099c4b` | Historical shadcn-generated wrappers; MIT-compatible with Apache-2.0 redistribution |

See [provenance.md](docs/how-we-build/provenance.md) for audit commands and classification.

## Generated code

| Generator                                                          | Output                                   | License / attribution                                          |
| ------------------------------------------------------------------ | ---------------------------------------- | -------------------------------------------------------------- |
| [openapi-typescript](https://github.com/drwpow/openapi-typescript) | `apps/*/src/lib/api/contracts/schema.ts` | MIT dependency; generated output carries generator header only |
| shadcn CLI                                                         | `packages/ui/src/components/ui/*`        | shadcn/ui MIT (see above)                                      |
| `@blitzcraftlabs/atlas` generators                                 | feature/page scaffolds                   | Apache-2.0 (Atlas-authored templates)                          |

## Fonts

Applications use **Inter** via `next/font/google` (`import { Inter } from "next/font/google"` in
`apps/web` and `apps/reference`). Atlas does **not** commit Inter font binaries to Git. During the
build, Next.js obtains the font and self-hosts the resulting font assets in the built application —
there is no runtime download from Google Fonts in the current Next.js model.

| Field                   | Value                                                    |
| ----------------------- | -------------------------------------------------------- |
| Font                    | Inter                                                    |
| License                 | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |
| Source                  | `next/font/google`                                       |
| Committed to repository | No                                                       |
| Present in build output | Yes — self-hosted font files in deployed artifacts       |

Built artifacts may contain redistributed Inter font software. SIL OFL-1.1 attribution/license
preservation requirements should be respected in distributions containing those generated font
assets. Whether additional OFL notice text is required for a specific deployment packaging model is
a **legal-review item** (see [provenance.md](docs/how-we-build/provenance.md)).

## Assets at HEAD

No binary image, font, or icon files are tracked in Git at HEAD. Historical design-system PNG
screenshots exist only in Git history (see provenance doc).

## Dependency license inventory

Reproducible enumeration:

```bash
pnpm install --frozen-lockfile
pnpm licenses:check      # policy gate
pnpm licenses:report     # human-readable full inventory
node scripts/audit-licenses.mjs --report --json
```

Policy: `scripts/license-policy.mjs`. Reviewed exceptions:
[`license-exceptions.json`](license-exceptions.json).

## Trademark note

Third-party names (GitHub, Vercel, shadcn, Base UI, Radix, Next.js, etc.) appear in documentation
for descriptive purposes. This file does not grant trademark rights.
