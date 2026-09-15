---
"@atlas/cli": patch
---

Skip source files that disappear between enumeration and read during undeclared-dependency scans so
Doctor stays resilient to concurrent generator fixtures without weakening real import detection.
