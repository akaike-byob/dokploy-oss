---
name: sync-upstream
description: Review and sync this Apache-only Dokploy fork to the latest stable upstream release, preserve fork divergences, test the result, and open a pull request. Use for requests such as "sync upstream", "update from Dokploy", or "bring in the latest release".
---

# Sync upstream

Read `UPSTREAM.md` completely before changing files. Treat it as the source of truth for licensing, patch filters, fork divergences, migration handling, checks, and push safety.

1. Confirm a clean worktree. Inspect remotes, current branch, latest stable upstream tag, and the base commit recorded in `UPSTREAM.md`. Add or refresh the `upstream` remote when needed.
2. Review every upstream commit and changed file between the recorded base and target tag. Exclude prereleases and the upstream default `canary` branch unless the user names one.
3. Ask before applying any backward-incompatible self-hosted behavior change. New optional resources, additive capabilities, bug fixes that preserve existing use, UI-only changes, and cloud-only changes are not blockers. State affected existing configuration or data and the old and new outcomes.
4. Generate a binary patch under `scratch/`. Exclude `*/proprietary/*` and upstream release workflows. Never merge or rebase upstream history.
5. Apply with `git apply --3way`. Resolve conflicts by preserving both the upstream change and every documented fork contract. Do not copy upstream proprietary code.
6. Renumber the fork migration after upstream migrations. Keep its released timestamp unchanged. Rebuild its snapshot on upstream's newest snapshot and update `UPSTREAM.md`.
7. Review the applied diff for regressions, unsafe shell or filesystem operations, tenant authorization gaps, migration errors, proprietary imports, cloud-only network activity, hardcoded upstream image or repository links, and undocumented drift. Add focused regression tests for defects found.
8. Run `git diff --check`, formatting and lint checks, both typechecks or builds named in `UPSTREAM.md`, then the full Dokploy test suite. Root-cause every failure. Compare suspicious failures with the pre-sync branch.
9. Update `UPSTREAM.md` with the target commit and any remaining divergence. Confirm reachable `proprietary` paths match the replacement READMEs.
10. Commit, push the current branch by name, and open a PR against `main`. Never use `--all` or `--mirror`. Include upstream range, excluded paths, compatibility review, preserved divergences, defects fixed, and exact check results.

Stop before push or PR creation if authentication is unavailable. Report the exact login command.
