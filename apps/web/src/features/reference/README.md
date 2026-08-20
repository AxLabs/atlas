# Reference feature modules

Code in this directory demonstrates Atlas feature architecture patterns. It is **not product
functionality** and has **no consuming UI** in the reference application.

Consumers may:

- Copy these modules as a starting point for their own features
- Delete them once they have their own implementations
- Use them as the canonical target for `atlas generate feature` (future, #37)

Do not import reference modules from product features. Reference modules may import platform
infrastructure from `@/lib/*` and `@atlas/ui`.
