# Atlas

> Enterprise-grade frontend platform for building production-ready web applications—with qualified,
> evidence-backed claims documented in the [claims register](../audit/claims-register.md).

---

## What is Atlas?

Atlas is a **forkable frontend platform template**. It is **open source under Apache License 2.0**.
The canonical repository is [`blitzcraftlabs/atlas`](https://github.com/blitzcraftlabs/atlas).
Anyone can clone, fork, and evaluate it.

The platform provides opinionated patterns so teams can ship production applications without
reinventing infrastructure for authentication, data fetching, validation, theming, accessibility,
and observability.

Start from the clean starter (`apps/web`), explore the executable reference application
(`apps/reference`), then delete `/examples` and build on the platform primitives in `lib/`,
`providers/`, and `packages/ui`.

### Two applications

| Application      | Role                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| `apps/web`       | Clean consumer starter — removable `/examples` pattern pages only    |
| `apps/reference` | Executable finished reference product — full Atlas architecture demo |

The `/examples` routes in the starter demonstrate isolated patterns (data states, forms). Run
`apps/reference` to see how those patterns compose in a realistic application with auth, API
integration, and product features.

```bash
pnpm --filter @atlas/reference dev
```

Reference application URL: `http://localhost:3001` (developer harness at `/harness`).

---

## Who is Atlas for?

- **Product teams** who want to ship features, not build infrastructure
- **Frontend engineers** who value type safety and consistent patterns
- **Organizations** adopting Atlas as a public Apache-2.0 template

Atlas is a public open-source starter. Commercial engineering or support is optional and separate
from using the source.

---

## Documentation

| Document                                                            | What You'll Learn                          |
| ------------------------------------------------------------------- | ------------------------------------------ |
| [Quickstart](quickstart.md)                                         | What to expect when running Atlas          |
| [Architecture](architecture.md)                                     | System design and mental model             |
| [Examples](examples.md)                                             | Reference patterns in the template         |
| [Capabilities](capabilities.md)                                     | What Atlas solves and why it matters       |
| [Decisions](decisions.md)                                           | Key engineering choices and tradeoffs      |
| [FAQ](faq.md)                                                       | Common questions answered                  |
| [Releases & Governance](../how-we-build/releases-and-governance.md) | Versioning, licensing, support (canonical) |

---

## Reference examples

The template includes `/examples` — thin pages for data states and forms. Delete them when you start
building. The interactive showcase is maintained at [shipwithatlas.com](https://shipwithatlas.com).

See [Examples](examples.md).

---

## Production history (summary)

Atlas has been exercised through real products. Use these categories exactly:

| Category                  | Products                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Built from Atlas**      | Aviatopia; BlitzCraft Studio (Publishing Platform); Ax402 Clients; thedanielmark-site; xgas-station-app; bridge-indexer-frontend |
| **Migrated toward Atlas** | gitmyabi-app; cha-ching-app                                                                                                      |

Per-product metrics, chronology, and endorsements are not fully published in this repository. See
the [claims register](../audit/claims-register.md) for qualified terminology and evidence limits.
