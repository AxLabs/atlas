# Atlas migrations

Migration guides for **breaking Atlas changes**. Each guide documents what changed, who is affected,
and concrete upgrade steps.

For policy, see
[Releases and Governance](../how-we-build/releases-and-governance.md#breaking-changes-and-migrations).

## Index

| Atlas version | Guide | Summary                 |
| ------------- | ----- | ----------------------- |
| —             | —     | No migration guides yet |

## Template

When adding a migration guide, copy this structure:

```markdown
# Migration: <short title>

**Atlas version:** X.Y.Z **Status:** Active | Completed **Owner:** @github-handle

## Summary

One paragraph: what changed and why.

## Who is affected

- Fork maintainers who …
- Teams using …

## Affected surfaces

- [ ] Reusable package APIs (`@atlas/ui`, etc.)
- [ ] Scaffold / template code
- [ ] Configuration / env vars
- [ ] CI workflows
- [ ] Runtime behaviour
- [ ] Documentation / conventions

## Migration steps

1. …
2. …

## Compatibility

- Required Node / pnpm versions: …
- Known constraints: …

## Deprecation timeline

| Date / release | Behaviour                |
| -------------- | ------------------------ |
| X.Y.Z          | Old behaviour deprecated |
| X.Y.Z          | Old behaviour removed    |
```
