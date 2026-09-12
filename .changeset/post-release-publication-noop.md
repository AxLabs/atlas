---
"@atlas/cli": patch
---

Fix release publication after an existing canonical release so post-release `main` commits no-op
when the published tag is a proven ancestor instead of attempting to retag it.
