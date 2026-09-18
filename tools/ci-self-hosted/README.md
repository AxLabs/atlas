# Self-hosted CI overlay

Optional module for BlitzCraft Labs maintainers running Atlas on a **trusted self-hosted runner
group** with persistent disk caches.

The default `.github/workflows/ci.yml` runs on `ubuntu-latest` and needs no host setup. This overlay
routes trusted same-repository work through the main-pinned reusable workflow
`.github/workflows/trusted-self-hosted.yml` and persistent pnpm/Turbo stores under `/var/cache/ci`.

Fork pull requests and downstream forks always stay on GitHub-hosted runners.

## Enable

```bash
pnpm ci:self-hosted:enable
```

Then set repository variables (Settings → Actions → Variables):

| Name                      | Value                     |
| ------------------------- | ------------------------- |
| `ATLAS_CI_RUNNER_PROFILE` | `self-hosted`             |
| `ATLAS_CI_RUNNER_GROUP`   | unset (optional override) |

`ATLAS_CI_RUNNER_GROUP` is optional when the default group name (`Blitzcraft Trusted CI`) matches
your organization setup.

Register runners in the `Blitzcraft Trusted CI` runner group with the `ci` label. Bootstrap each
runner host once:

```bash
sudo mkdir -p /var/cache/ci
sudo chown -R <runner-user>:<runner-user> /var/cache/ci
```

Configure the organization runner-group workflow allowlist to include exactly:

`blitzcraftlabs/atlas/.github/workflows/trusted-self-hosted.yml@refs/heads/main`

## Disable

```bash
pnpm ci:self-hosted:disable
```

Delete `ATLAS_CI_RUNNER_PROFILE` or set it to `github-hosted`.

## What changes

| Profile                   | Execution path                                                    | pnpm cache                        | Turbo cache                  |
| ------------------------- | ----------------------------------------------------------------- | --------------------------------- | ---------------------------- |
| `github-hosted` (default) | `ubuntu-latest` / `ubuntu-24.04` in caller workflows              | GitHub Actions `cache: pnpm`      | Per-job local `.turbo`       |
| `self-hosted`             | Main-pinned `trusted-self-hosted.yml` → runner group + `ci` label | `/var/cache/ci/pnpm-store/<repo>` | `/var/cache/ci/turbo/<repo>` |

Postgres seeding and isolated checkout directories are **not** part of this overlay. Consumer apps
that need DB-backed CI checks should add their own scripts (see Aviatopia's `infra/docker/scripts/`
as a reference).

## Documentation

See [docs/how-we-build/ci.md](../../docs/how-we-build/ci.md).
