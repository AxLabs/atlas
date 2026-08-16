# Compose Examples

This directory contains Docker Compose patterns for teams extending Atlas.

## Files

| File                   | Purpose                                     |
| ---------------------- | ------------------------------------------- |
| [infra.yml](infra.yml) | Database + cache scaffold for consumer apps |

## Usage

These examples are **not active by default**. Atlas is a pure frontend platform and requires no
infrastructure to run.

The infrastructure example binds Postgres and Redis to `127.0.0.1` so development credentials are
not exposed on every network interface.

See [docs/how-we-build/local-dev-composition.md](../../docs/how-we-build/local-dev-composition.md)
for complete guidance.
