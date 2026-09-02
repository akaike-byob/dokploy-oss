# Upstream tracking

This fork tracks Dokploy `main`, the branch carrying the released version tags. It is level with:

```
f67fab0675652f8a819e6962f1e510ea0e2ee53b   # v0.30.5
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
git fetch upstream main
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
git fetch upstream main
git diff --binary <BASE>..upstream/main -- . ':(exclude)*/proprietary/*' > /tmp/upstream.patch
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
- `apps/dokploy/esbuild.config.ts` - builds `setup.ts` into `dist/setup.mjs` and this fork's
  `provision-host.ts` into `dist/provision-host.mjs`, so the published image can run the app's own
  host bootstrap. `install.sh` depends on both.
- `packages/server/src/lib/auth.ts` - sets `requireLocalEmailVerified` to `IS_CLOUD`. better-auth
  defaults it to true and then refuses to link a social identity to an existing account whose email
  is unverified. A self-hosted panel disables email verification, so every local account stays
  unverified and every first Google or SSO sign-in would fail with "account not linked".
  It also grants the registered SSO issuers' origins on `/sso` paths, from
  `lib/sso-trusted-origins.ts`. The SSO plugin will not fetch a discovery document from an origin
  missing from `trustedOrigins`, and Dokploy keeps that list on the owner's user row with no UI to
  edit it, so no external identity provider could otherwise be registered at all.
  It also rebuilds the social providers from the credentials stored in `socialAuthProvider` on the
  endpoints that resolve one, from `lib/social-auth-providers.ts`. better-auth builds its provider
  list once, out of the options the instance was created with, so credentials registered from the
  panel would otherwise take effect only after a restart.
- `LICENSE.MD`, and `NOTICE` - carry the full Apache-2.0 text and the statement of changes that
  Apache-2.0 section 4 requires of a public distribution. `LICENSE_PROPRIETARY.md` is absent, since
  no code it applies to is present.
- `packages/server/src/services/settings.ts`, `apps/dokploy/server/api/routers/settings.ts`,
  `apps/dokploy/server/server.ts` - take the panel's image and version from
  `services/panel-build.ts` instead of hardcoding `dokploy/dokploy` and reading `package.json`.
  Upstream's "Update Available" button runs `docker service update --image dokploy/dokploy:<v>`,
  which on a fork replaces the running panel with upstream and silently undoes it.
- `apps/dokploy/components/layouts/side.tsx` - drops the "Enterprise" badge. It rendered whenever
  the licence check reported access, which here is always, and this fork has no such tier.
- `Dockerfile` - installs dependencies from the manifests before copying the sources, so a source
  change no longer reruns `pnpm install` and its native compilation, and takes `PANEL_VERSION`
  and the repository URLs as build arguments declared after the expensive layers.
  `NEXT_PUBLIC_PANEL_REPO_URL` has to be one of them: Next.js inlines it into the client bundle
  as it compiles, so it cannot be changed on a running container.
- `apps/dokploy/drizzle/` and its `meta/_journal.json` - carry one migration of this fork's own,
  `0191_loud_carmella_unuscione`, for the `socialAuthProvider` table. Upstream numbers its
  migrations sequentially, so a sync brings files that collide with it. Two things need doing.

  Renumber this fork's migration to sit after the last one the sync brought, renaming both
  `<tag>.sql` and `meta/<idx>_snapshot.json`, and rebuild that snapshot as upstream's newest
  snapshot plus this fork's table, with `prevId` set to the id of the snapshot before it. The
  numbers cannot simply coexist: `meta/0181_snapshot.json` is one filename whoever wrote it.

  Keep the `when` of this fork's migration exactly as generated, at 1787171678956, and check that
  every migration the sync brought carries a later one. Drizzle applies a migration only when
  `folderMillis` exceeds the single newest `created_at` in `drizzle.__drizzle_migrations`, read
  once before the loop and never during it, so the index and the array order decide nothing. A
  panel that already ran this fork's migration holds that timestamp as its newest, which skips the
  fork's entry a second time and applies every upstream one above it. If a sync ever brings a
  migration timestamped below it, raise that one to just above, and never lower a timestamp a
  released image already applied.
- `packages/server/src/utils/filesystem/directory.ts`,
  `packages/server/src/utils/builders/docker-file.ts`,
  `apps/dokploy/components/dashboard/application/build/show.tsx` - an empty `dockerContextPath`
  builds from the Dockerfile's own directory, and the form's placeholder says so rather than
  claiming `.`.

  Upstream made an empty value mean the repository root, in
  [PR #5231](https://github.com/Dokploy/dokploy/pull/5231), merged into v0.30.5. Every application
  configured before that field existed has an empty value, so the change moves what `COPY` resolves
  against and the build fails on the first line naming a file beside the Dockerfile. The panel says
  nothing; the deploy simply stops working.

  This is a defect upstream has not yet noticed rather than a decision it made. The pull request
  came from a first-time contributor who read the input's placeholder, `default: .`, and changed the
  code to match the text instead of the text to match the code. It carries no linked issue and no
  maintainer review. Its `pr-check (test)` job failed on the merged commit, because upstream's own
  `application.real.test.ts` builds `deno/Dockerfile` from the examples repository and that build
  needs the Dockerfile's directory as context; it was merged anyway, and v0.30.5 was tagged hours
  later the same day. A second contributor has since reported on the pull request that `canary` is
  red for everyone and asked for the fallback to be reverted.

  Drop this divergence once upstream reverts, and check first that the revert is real rather than a
  test loosened around the new behaviour. If upstream instead keeps the repository root on purpose,
  taking it needs a migration that writes the Dockerfile's directory into `dockerContextPath` for
  every application still holding an empty one, so no deploy changes meaning.
- `.github/workflows/` - upstream's release automation publishes to Dokploy's own registries and
  pushes to Dokploy's other repositories, so it is absent, and so is `upgrade-integration-test.yml`,
  which upgrades between upstream's published image tags. `image.yml` publishes this fork's image to
  Docker Hub; `pull-request.yml` is upstream's, unchanged.

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
Apache-licensed `packages/server/src/lib/auth.ts`.

Register the Google OAuth client under **Settings -> SSO -> Google Sign-In**. It is stored in the
`socialAuthProvider` table and applies to the next sign-in, so a panel already running gains the
button without a restart.

Credentials may also be supplied as environment variables, which is how a panel provisioned before
it had an admin gets its first client:

```
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
```

Anything registered from the panel wins over the environment for that provider. GitHub is
configurable through the environment only; the storage and the override are generic, so giving it
the same panel form is a matter of rendering one.

The OAuth redirect URI is `https://<panel-domain>/api/auth/callback/google`. A button appears only
when its provider has an OAuth client from either source.

A Google identity links to an existing account with the same email address. Creating a new account
through Google is still subject to the panel's own rule that, once an owner exists, only an invited
user may register.

## Relationship to upstream

This is a modified fork, not affiliated with or endorsed by Dokploy Technology, Inc. Apache
License 2.0 §4(b) requires modified files to carry notice of the change; the modifications relative
to the base commit above are the record of that. "Dokploy" is upstream's name and is not claimed
here.
