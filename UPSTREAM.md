# Upstream tracking

This fork starts from Dokploy `canary` at:

```
ef0272a4ecd886a7e62cd3b65dd22a010cd36b62
```

## Why the history starts fresh

Upstream is dual-licensed (`LICENSE.MD`): everything outside a `/proprietary` directory is Apache
License 2.0, everything under one is the Dokploy Source Available License, which forbids
redistribution.

This fork carries only the Apache-licensed portion. The three proprietary directories are absent:

```
apps/dokploy/components/proprietary/
apps/dokploy/server/api/routers/proprietary/
packages/server/src/services/proprietary/
```

Deleting them in a later commit would not be enough, because every earlier commit would still serve
them. So history begins at a single commit of the already-stripped tree, and no source-available
file has ever existed in this repository.

## Syncing upstream changes

Add the remote once:

```sh
git remote add upstream https://github.com/Dokploy/dokploy.git
git fetch upstream canary
```

**Never merge upstream into a published branch, and never rebase one onto upstream.** Git uploads
every object reachable from the branch tip, so either operation makes upstream's entire history
reachable and republishes the source-available files this fork exists to exclude. The merge result
looks clean in the working tree while the history is not.

Cherry-picking is safe from that angle, since the new commit's only parent is the current tip, but
check that the commit does not touch a proprietary path before taking it.

Sync by applying a filtered patch instead:

```sh
# BASE is the commit recorded above; NEW is the upstream commit to move to.
git fetch upstream canary
git diff --binary <BASE>..upstream/canary -- . ':(exclude)*/proprietary/*' > /tmp/upstream.patch
git apply --3way /tmp/upstream.patch
```

`--binary` is required: the tree contains files git treats as binary, and without it the patch is
rejected as a whole, since `git apply` is atomic.

Do the sync on a scratch branch first, confirm both typechecks pass, then update the base commit
recorded at the top of this file so the next sync diffs from the right place.

## Push hygiene

This clone keeps upstream's objects locally so patches can be generated. Only `main` is safe to
publish. Push it by name and never with `--all` or `--mirror`, which would carry local branches that
do contain upstream history.

Before any push to a new remote, confirm no upstream source-available blob is reachable. The
directories named `proprietary` in this repository hold this fork's own replacement modules (see
below), so the check lists what is reachable and expects only those paths:

```sh
git rev-list --objects main | grep proprietary | awk '{print $2}' | sort -u
```

Every path it prints must be a file listed in one of the three replacement READMEs.

## Replacement modules

Upstream's Apache-licensed code imports its enterprise features from three directories named
`proprietary`. Those imports are part of the Apache-licensed files, so stripping the enterprise code
leaves them dangling.

This fork answers them with its own implementations placed at the same module paths:

```
apps/dokploy/components/proprietary/
apps/dokploy/server/api/routers/proprietary/
packages/server/src/services/proprietary/
```

Each directory carries a README describing the contract it implements. The code there is original
work for this fork and carries no source-available code or terms; the directory name is upstream's
module path, nothing more.

The point of reusing those paths is upgradability. Because the sync patch excludes
`*/proprietary/*`, upstream changes never touch these files and these files never conflict with a
patch, while every upstream file that imports them resolves without being edited. The diff against
upstream outside those directories stays close to empty, which is what makes a sync a fast-forward
rather than a merge exercise.

Upstream files edited here, and therefore the only places a sync can conflict:

- `apps/dokploy/pages/index.tsx`, `apps/dokploy/pages/register.tsx` - drop a cloud-only condition so
  the Google and GitHub sign-in buttons render on a self-hosted panel. The buttons decide for
  themselves whether to appear, based on whether the provider is configured.
- `apps/dokploy/esbuild.config.ts` - builds `setup.ts` into `dist/setup.mjs`, so the published image
  can run the app's own host bootstrap. `install.sh` depends on this.
- `LICENSE.MD`, and `NOTICE` - carry the full Apache-2.0 text and the statement of changes that
  Apache-2.0 section 4 requires of a public distribution. `LICENSE_PROPRIETARY.md` is absent, since
  no code it applies to is present.
- `.github/workflows/` - upstream's release automation publishes to Dokploy's own registries and
  pushes to Dokploy's other repositories, so it is absent. `image.yml` publishes this fork's image
  to GHCR; `pull-request.yml` is upstream's, unchanged.

Take upstream's changes to any of these deliberately rather than by default.

After a sync, re-check that imports still resolve:

```sh
cd apps/dokploy && ./node_modules/.bin/tsc --noEmit
cd packages/server && ./node_modules/.bin/tsc --noEmit
```

If a sync adds an import from a `proprietary` path that nothing here provides, add the symbol to the
matching replacement module.

## Panel sign-in

Google and GitHub sign-in run on better-auth's own social providers, configured in the
Apache-licensed `packages/server/src/lib/auth.ts`. Set the credentials as environment variables on
the panel:

```
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
```

The OAuth redirect URI is `https://<panel-domain>/api/auth/callback/google`. A button appears only
when its provider's credentials are set.

A Google identity links to an existing account with the same email address. Creating a new account
through Google is still subject to the panel's own rule that, once an owner exists, only an invited
user may register.

## Relationship to upstream

This is a modified fork, not affiliated with or endorsed by Dokploy Technology, Inc. Apache
License 2.0 §4(b) requires modified files to carry notice of the change; the modifications relative
to the base commit above are the record of that. "Dokploy" is upstream's name and is not claimed
here.
