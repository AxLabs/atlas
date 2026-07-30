# Self-hosted CI overlay

Optional module for teams running Atlas on a **self-hosted runner fleet** with persistent disk
caches.

The default `.github/workflows/ci.yml` runs on `ubuntu-latest` and needs no host setup. This overlay
switches jobs to `[self-hosted, ci]` and enables persistent pnpm/Turbo stores under `/var/cache/ci`.

## Enable

```bash
pnpm ci:self-hosted:enable
```

Then set the repository variable (Settings → Actions → Variables):

| Name                      | Value         |
| ------------------------- | ------------- |
| `ATLAS_CI_RUNNER_PROFILE` | `self-hosted` |

Bootstrap each runner host once:

```bash
sudo mkdir -p /var/cache/ci
sudo chown -R <runner-user>:<runner-user> /var/cache/ci
```

## Disable

```bash
pnpm ci:self-hosted:disable
```

Delete `ATLAS_CI_RUNNER_PROFILE` or set it to `github-hosted`.

## What changes

| Profile                   | `runs-on`           | pnpm cache                        | Turbo cache                  |
| ------------------------- | ------------------- | --------------------------------- | ---------------------------- |
| `github-hosted` (default) | `ubuntu-latest`     | GitHub Actions `cache: pnpm`      | Per-job local `.turbo`       |
| `self-hosted`             | `[self-hosted, ci]` | `/var/cache/ci/pnpm-store/<repo>` | `/var/cache/ci/turbo/<repo>` |

Postgres seeding and isolated checkout directories are **not** part of this overlay. Consumer apps
that need DB-backed CI checks should add their own scripts (see Aviatopia's `infra/docker/scripts/`
as a reference).

## Documentation

See [docs/how-we-build/ci.md](../../docs/how-we-build/ci.md).
