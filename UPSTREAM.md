# Upstream tracking

This fork tracks Dokploy `main`, the branch carrying the released version tags. It is level with:

```
3ac1c8f2e025d7db7696542eb2770e08f598214c   # v0.31.0
```

## Why the history starts fresh

Upstream is dual-licensed (`LICENSE.MD`): everything outside a `/proprietary` directory is Apache
License 2.0, everything under one is the Dokploy Source Available License, which forbids
redistribution.

This fork carries only the Apache-licensed portion. Upstream's files in these three directories are
absent, and this fork's own replacement modules sit at the same paths:

```
apps/dokploy/components/proprietary/
apps/dokploy/server/api/routers/proprietary/
packages/server/src/services/proprietary/
```

Deleting them in a later commit would not be enough, because every earlier commit would still serve
them. So history begins at a single commit of the already-stripped tree. That root commit,
`f6a104216`, still carries upstream's `LICENSE_PROPRIETARY.md`, the text of the licence and no code
under it, and `32833733b` deletes the file. No other source-available file exists in this history.

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
git diff --binary <BASE>..upstream/main -- . ':(exclude)*/proprietary/*' ':(exclude).github/workflows/*' > /tmp/upstream.patch
git apply --3way /tmp/upstream.patch
```

`--binary` is required: the tree contains files git treats as binary, and without it the patch is
rejected as a whole, since `git apply` is atomic.

Do the sync on a scratch branch first, confirm both typechecks pass, then update the base commit
recorded at the top of this file so the next sync diffs from the right place.

## Reviewing what a sync brings

A sync is a review, not a transfer. Upstream merges pull requests from first-time contributors on
an AI reviewer's approval, sometimes over a failing test job, and tags a release the same day. A
patch that applies without a conflict says only that the text lines up, and a defect that reaches
a release reaches this fork's users through the image published from `main`.

Read the change before taking it:

```sh
git log --oneline --no-merges <BASE>..<NEW>          # every subject
git log --merges <BASE>..<NEW>                       # the pull requests behind them
git diff <BASE>..<NEW> -- <path>                     # anything a subject makes you doubt
```

What each pass is looking for:

- **Behaviour that changes for data already in the database.** A new default, a widened enum, a
  column whose absence used to mean one thing, a permission that gates what was ungated. Ask what
  an existing row does under the new code, not what a fresh install does. An empty
  `dockerContextPath` is the standing example, and reading the diff is what found it.
- **The pull request behind a suspicious commit.** `gh api repos/Dokploy/dokploy/pulls/<n>` gives
  the description and the discussion; `gh api repos/Dokploy/dokploy/commits/<sha>/check-runs` gives
  what CI said about the commit that was merged. A red `pr-check (test)`, no linked issue and no
  maintainer comment together mean nobody upstream has checked the change either.
- **New imports from a `proprietary` path**, which the replacement modules have to answer.
- **Anything reaching the network from a self-hosted panel.** Upstream builds for its cloud too.
  Analytics, billing and onboarding belong behind `settings.isCloud`; confirm each one is.

Then run the full suite, not the typechecks alone:

```sh
cd packages/server && pnpm build
cd ../../apps/dokploy && pnpm test --run
```

Root-cause every red test. "The real Docker tests are flaky on a laptop" is a guess until it is
checked, and the way to check is to run the same file on `main` before the sync: if it passes there
and fails here, the sync brought a defect, whatever the failure looks like. The suite also runs real
builds against a network, so a genuine environment failure looks like a timeout or a clone error,
and it clears on a second run of that file alone. A failure that reproduces is upstream's code.

Take a change only once you can say what it does. Anything left over goes in the divergence list
below with the reason and the condition for dropping it.

## Push hygiene

This clone keeps upstream's objects locally so patches can be generated. Fork branches and
`*-akaike.*` tags are safe to publish, because none of them reaches upstream's history. A bare `v*`
tag and every `refs/remotes/upstream/*` ref are upstream's, so `git push origin v0.31.0` publishes
upstream's history with its source-available files. Push fork refs by name, and never use `--all`,
`--mirror`, `--tags` or `--follow-tags`.

`git fetch upstream main` follows upstream's tags into this clone. Use `--no-tags` unless a sync needs
a tag. Nothing enforces these rules: Git hooks are per clone, and this repository ships none. A
pre-push hook that refuses any ref reaching `48bf9a162` would enforce them on one clone.

Before any push to a new remote, confirm no upstream source-available blob is reachable. The
directories named `proprietary` in this repository hold this fork's own replacement modules (see
below), so the check lists what is reachable and expects only those paths:

```sh
git rev-list --objects main | grep -i proprietary | awk '{print $2}' | sort -u
```

Every path it prints must be `LICENSE_PROPRIETARY.md` from the root commit, or a file this fork
wrote under one of the three replacement directories.

This check compares names only. It passes a copied upstream file at a fork path, and it reads only
`main`. Before publishing a ref, also compare its blob ids with those of upstream's refs, excluding
this fork's tags. Blob ids find exact copies only, so read any new module for overlap with upstream
through the contract it implements, never through upstream's text.

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

The two server directories carry a README describing the contract they implement. The code there is
original
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
  host bootstrap. `install.sh` runs `dist/provision-host.mjs`.
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
  It also reads SSO enforcement from `isSsoEnforced`, listed with the fixes below.
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
  `0199_loud_carmella_unuscione`, for the `socialAuthProvider` table. Upstream numbers its
  migrations sequentially, so a sync brings files that collide with it. Two things need doing.

  Renumber this fork's migration to sit after the last one the sync brought, renaming both
  `<tag>.sql` and `meta/<idx>_snapshot.json`, and rebuild that snapshot as upstream's newest
  snapshot plus this fork's table and its `socialAuthProviderId` enum, with `prevId` set to the id
  of the snapshot before it. The
  numbers cannot simply coexist: `meta/0181_snapshot.json` is one filename whoever wrote it.

  Keep the `when` of this fork's migration exactly as generated, at 1787171678956, and check that
  every migration the sync brought carries a later one. Drizzle applies a migration only when
  `folderMillis` exceeds the single newest `created_at` in `drizzle.__drizzle_migrations`, read
  once before the loop and never during it, so the index and the array order decide nothing. A
  panel that ran this fork's migration holds a newest stamp at or above that timestamp, which
  skips the fork's entry a second time and applies every upstream one above it. If a sync ever
  brings a migration timestamped below it, raise that one to just above, and never lower a timestamp
  a released image already applied.

  Migrations 0181 to 0185 carry this fork's stamps, 1787171678957 to 1787171678961, because upstream's
  sit below the fork's own. Taking upstream's journal lowers them, and a panel on
  `v0.29.15-akaike.18` then skips 0181 and fails at 0188. Restore them after every sync.
  `apps/dokploy/__test__/migrations/journal-timestamps.test.ts` fails if a released image would skip
  a migration; add each new release to its table.
- `packages/server/src/utils/builders/docker-file.ts` - passes the build context as `.`, after the
  `cd` into it, and quotes the Dockerfile path and build stage. Upstream's build line joins these
  unquoted, so a space stops the build and a shell metacharacter runs on the host. Drop this once
  upstream quotes the build line.
- `apps/dokploy/components/dashboard/application/build/show.tsx` - the context path placeholder says
  an empty value means the Dockerfile's directory. Upstream's says `default: .`, which is not what
  its code does. Drop this once upstream corrects the text.
- `.github/workflows/` - upstream's release automation publishes to Dokploy's own registries and
  pushes to Dokploy's other repositories, so it is absent, and so is `upgrade-integration-test.yml`,
  which upgrades between upstream's published image tags. `image.yml` publishes this fork's image to
  Docker Hub; `pull-request.yml` is upstream's, unchanged.
- `apps/dokploy/pages/_error.tsx`, `apps/dokploy/components/layouts/onboarding-layout.tsx`,
  `apps/dokploy/components/dashboard/settings/web-server/update-server.tsx`,
  `apps/dokploy/components/dashboard/onboarding/onboarding-wizard.tsx`,
  `apps/dokploy/server/api/routers/notification.ts` and the templates in
  `packages/server/src/emails/emails/` - point their repository, releases, issues and logo links at
  this fork, from `apps/dokploy/lib/panel-repo.ts` and `services/panel-build.ts`. Upstream's links
  describe a build the operator is not running. New upstream screens arrive with the hardcoded
  Dokploy links; check for them after a sync.
- `apps/dokploy/pages/dashboard/settings/sso.tsx` - renders this fork's `GoogleAuthSettings` card,
  since upstream's page has no way to configure Google sign-in.
- `packages/server/src/index.ts`, `packages/server/src/db/schema/index.ts` - export this fork's own
  `services/social-auth.ts` and `db/schema/social-auth.ts` alongside upstream's.
- `README.md` and `install.sh` - describe and install this fork's image rather than upstream's.
  `install.sh` also generates `BETTER_AUTH_SECRET_FILE`, because the panel otherwise signs sessions
  and encrypts columns with a constant from public source. A panel installed before this keeps that
  constant. Moving such a panel from the constant to a generated secret keeps its data readable,
  because `legacyFallbackKeys` in `lib/encryption.ts` holds the constant's key and a row is
  re-encrypted on its next write. Rows nobody writes stay under the public key until a script
  re-encrypts them. `apps/dokploy/scripts/migrate-auth-secret.ts` covers only 2FA secrets. Rotating
  from one generated secret to another has no fallback, so it needs every `encryptedText` column
  re-encrypted first.
  Upstream's installer is a separate repository; this one is the fork's own.
- `.env.production` - tracked here with `PORT` and `NODE_ENV`, because `Dockerfile` copies it into
  the image as `.env`. CI overwrites it from `.env.production.example` before the build.
- `.gitignore` and `.vscode/settings.json` - editor settings are per-developer, so the tracked file
  is gone and the path is ignored, along with `scratch/`.

This fork also carries fixes for defects it found in upstream's code while reviewing a sync. Each
one is upstream's file, so a later sync brings upstream's version back the moment upstream fixes it
itself, which is the point at which the fix here should go:

- `packages/server/src/utils/dns/route53.ts` - a CNAME is replaced rather than merged into the
  existing record set. Route53 rejects a CNAME set holding more than one value, so merging made
  every repoint of an existing CNAME fail.
- `apps/dokploy/pages/api/[...trpc].ts` - the Content-Type is reduced to its media type before
  trpc-openapi compares it, which it does against the whole header. A client sending
  `application/json; charset=utf-8` otherwise arrives with an empty body and fails validation on
  every field.
- `packages/server/src/services/compose.ts` - the "fresh volumes" teardown runs with `HOME` set so
  the docker CLI can read its config, and a failure is logged instead of swallowed by `|| true`.
  Swallowing it deployed onto the old volumes and reported success, so a database the operator
  believed was reset still held its data.
- `apps/dokploy/server/api/routers/application.ts` - the nginx quickstart honours
  `remoteServersOnly`, so it cannot schedule onto a control plane the operator kept empty.
- `apps/dokploy/scripts/reset-onboarding.ts` - refuses to run under `NODE_ENV=production` and
  deletes only within organizations the named user owns. It deleted every project and server of
  every organization they merely belonged to, unprompted.
- `apps/dokploy/components/dashboard/onboarding/` - `isCloud` defaults to false while the query is
  in flight, the wizard's lock lives in `sessionStorage` so an
  abandoned run dies with the tab rather than following the browser's next user, the plan step is
  loaded dynamically so `@stripe/stripe-js` stays out of a self-hosted bundle, and the server step
  waits for validation to succeed before provisioning a host that already exists.
- `apps/dokploy/components/dashboard/settings/servers/delete-server-modal.tsx` - the delete button
  waits for the service list to arrive, rather than reading a loading or failed query as "no
  services will be affected".
- `apps/dokploy/components/dashboard/monitoring/paid/servers/network-chart.tsx` - an absent value
  formats as `0`. The guard tested `Number.isNaN`, which is false for `undefined`.
- `apps/dokploy/server/api/routers/backup.ts`, `apps/dokploy/server/api/routers/deployment.ts` - a
  web-server backup requires an owner or admin, from `server/api/utils/web-server-backup-access.ts`.
  The settings page sends the user's id as `databaseId`, which upstream's check reads as a service
  that does not exist, so every panel restore failed. An empty `databaseId` skipped that check, so
  any signed-in user could replace the panel. Drop this once upstream branches on the web-server
  type before its service check. Upstream's decision to leave these destinations unscoped stays.
- `apps/dokploy/server/api/routers/settings.ts` - `getWebServerSettings` hides `sshPrivateKey` and
  the metrics token from members, who read that row for flags such as `remoteServersOnly`. A member
  with `monitoring: read` still gets the token from `user.getMetricsToken`, because the monitoring
  page sends it from the browser to the metrics server.
  `updateEnforceSSO` refuses to enable with no SSO provider registered, and
  `routers/proprietary/sso.ts` clears the flag when the last provider goes or the first one arrives,
  because registering tests no login.
- `packages/server/src/lib/auth.ts`, `apps/dokploy/pages/index.tsx` - enforcement follows
  `isSsoEnforced` in `services/proprietary/sso.ts`: the stored flag and at least one provider.
  Upstream made the flag block password, social and passkey sign-in on the server, so a flag with
  no provider behind it locks every user out with SQL as the only way back. A registered provider
  that stops working still locks them out. Recover with
  `UPDATE "webServerSettings" SET "enforceSSO" = false;`. Drop this once upstream checks for a
  provider.
- `packages/server/src/services/transfer.ts`, `apps/dokploy/server/api/routers/transfer.ts` - a
  transfer is refused when it would lose data: an uploaded application has its only copy of the code
  on the source, and bind copies run inside the panel container, so they find nothing on the way out
  of the panel host and land in the container's layer on the way in. A compose project's `files`
  directory is copied, because `removeCompose` deletes it whatever `removeSourceData` says. The
  control plane is refused as a target under `remoteServersOnly`. Drop each once upstream handles it.
- `packages/server/src/services/application.ts` - a preview without a build server pushes to no
  registry. Upstream stopped clearing the registries so that a build server can carry the image to
  the deploy server, which also pushed every pull request's code to the release registry of every
  other application, failed the preview on a token that cannot push, and left the image behind on
  removal. Drop this once upstream limits the push to build servers.
- `packages/server/src/setup/traefik-setup.ts` - stops Traefik and renames it again when Docker
  refuses to rename a running container on an overlay network, which Docker 27.5.1 to 29.7.2 do.
  From [upstream PR #5889](https://github.com/Dokploy/dokploy/pull/5889), open at this sync, along
  with its cases in `apps/dokploy/__test__/traefik/standalone-traefik-recreate.test.ts`. Take
  upstream's version once it merges.
- `packages/server/src/utils/access-log/handler.ts` - cleanup rewrites `access.log` in place, so a
  container that file-binds it keeps reading the live file. This is upstream's `9b0db9aed`, which
  landed after v0.31.0. The next sync brings it back.
- `apps/dokploy/__test__/api/update-server.test.ts` - expects `PANEL_IMAGE` where upstream's test
  names its own image.
- `apps/dokploy/server/api/routers/backup.ts` - refuses a schedule whose `databaseType` disagrees with
  its target: `web-server` with a service id, or a service type with none. The schedule dispatches on
  the type alone, so a member could otherwise dump the panel. Drop this once upstream checks the pair.
- `packages/server/src/services/settings.ts` - `reloadDockerResource` restarts the panel with no
  `--image`. `PANEL_VERSION` has no leading `v` and CI publishes only the prefixed tag, so upstream's
  command stops the panel and then fails to pull. This one stays while this fork's tags differ.
- `apps/dokploy/server/api/routers/volume-backups.ts`, `apps/dokploy/server/api/utils/volume-backup-target.ts`,
  `packages/server/src/db/schema/volume-backups.ts` - volume restore checks the service grant and
  takes a file name that holds no shell syntax. Create requires exactly one service, of the row's
  type. Input sets no `appName`, and update changes no service id. Upstream's restore reaches the
  shell for any member, and upstream's update moves a row to any service. Drop this when upstream
  checks the grant and narrows these inputs.
- `packages/server/src/db/schema/backups.ts`, `packages/server/src/db/schema/utils.ts`,
  `packages/server/src/utils/backups/`, `packages/server/src/utils/volume-backups/` - a backup prefix
  and compose service name are validated on input and quoted in each command, because a stored
  value reaches the shell on the service's server. Drop this when upstream does both.
- `apps/dokploy/server/api/routers/backup.ts`, `apps/dokploy/server/api/utils/web-server-backup-access.ts` -
  a backup names exactly the service its `databaseType` selects, because upstream checks the grant on
  the first id and dumps the type's id. A member restores only files under the service's own folder.
  Owners and admins restore across services. Drop these when upstream scopes both.
- `apps/dokploy/server/wss/deployment-log-access.ts`, `apps/dokploy/server/wss/listen-deployment.ts` - the
  log socket tails only a path a deployment recorded, for a caller with access to that deployment's
  service or server. Upstream's check accepts any path under the base path, which holds SSH keys and
  certificates. Drop this when upstream ties the path to a row.
- `packages/server/src/lib/auth.ts`, `packages/server/src/services/proprietary/sso.ts`,
  `apps/dokploy/server/api/routers/proprietary/sso.ts` - an SSO provider cannot sign in an owner or a
  member of another organization unless that person registered the provider, and it cannot use the
  id of a built-in sign-in method. `requireLocalEmailVerified: false` and `trustEmailVerified: true`
  otherwise let an organization admin's identity provider take any account. Keep this while panels
  skip email verification.
- `packages/server/src/services/transfer.ts` - also reads a stack's binds and volumes from its
  service spec, and refuses a deployed project with no containers or services, because Docker then
  cannot list its binds. It refuses a volume the transfer would not copy and the cleanup would strand:
  an external volume, an anonymous volume, or a stack volume on another node. It copies an unlabelled
  volume named `<appName>_*`, which an earlier transfer created.
- `packages/server/src/services/logs-and-metrics/service.ts`, `packages/server/src/services/vault-provider.ts` -
  a stored credential needs re-entering when its destination changes. That covers the Datadog `site`,
  the CloudWatch `region`, and each vault provider's URL, region or Phase `apiUrl`. Drop this when
  upstream does so.
- `packages/server/src/utils/builders/`, `packages/server/src/utils/filesystem/directory.ts` - quote the build
  path, env file path and removed file mount path, because each can hold shell syntax. Drop this when
  upstream quotes them.
- `install.sh` - runs only `deploy_panel` when the `dokploy` service exists. The panel holds the
  checked ports, so the free port check blocks the documented upgrade, and the host bootstrap
  recreates Traefik with no env or ports. Drop this when upstream's installer upgrades in place.
- `packages/server/src/utils/backups/utils.ts` - reads the backup row inside the scheduled job,
  because a transfer does not re-register the job and the registered row names the old server. The job
  logs a failure, because node-schedule rethrows a rejected job as an unhandled rejection. The backup
  command stays out of the panel log, because it holds the database password. Drop each when upstream
  does so.
- `packages/server/src/services/deployment.ts` - reads a libsql backup's server, because its log folder
  otherwise never exists on that server. Drop this when upstream reads it.
- `packages/server/src/utils/volume-backups/backup.ts`, `packages/server/src/utils/volume-backups/utils.ts` -
  a volume backup of a remote database runs on that database's server. Upstream runs it on the panel
  host, which creates an empty volume and uploads an empty archive with status success. Drop this when
  upstream reads the server of every service type.
- `packages/server/src/db/schema/utils.ts` - `BUCKET_PATH_REGEX` allows letters of any script, digits,
  spaces and `. _ - + @ = , : /`, with no `..` segment. Stored prefixes and old file names use these.
  A stored prefix with any other character needs a new prefix before the row can be edited.
- `apps/dokploy/components/dashboard/database/backups/handle-backup.tsx`,
  `apps/dokploy/components/dashboard/database/backups/restore-backup.tsx`,
  `apps/dokploy/components/dashboard/application/volume-backups/restore-volume-backups.tsx`,
  `apps/dokploy/components/dashboard/settings/servers/actions/toggle-enforce-sso.tsx` - show the
  server's refusal in a toast. These refusals otherwise look like a button that does nothing.
- `Dockerfile` - copies `LICENSE.MD` and `NOTICE` into the image, as Apache-2.0 section 4 requires of a
  published image. Drop this when upstream's image carries them.
- `apps/dokploy/server/api/routers/proprietary/sso.ts`, `packages/server/src/lib/auth.ts` - removing a
  provider deletes its account rows, and better-auth's `/sso/update-provider` and
  `/sso/delete-provider` routes are closed. A later provider under the same id or issuer would
  otherwise sign in to those accounts. Drop this when upstream ties account links to the issuer.
- `apps/dokploy/server/api/routers/settings.ts` - only an owner with an SSO sign-in can enforce SSO,
  because enforcement blocks every other sign-in. An admin can still turn it off. Drop this when
  upstream refuses a self-lockout.
- `packages/server/src/lib/auth.ts` - `trustedProviders` holds only SSO provider ids. Naming GitHub or
  Google links an account from an unverified address. Drop this when upstream stops trusting social
  providers by name.
- `apps/dokploy/migration.ts` - exits non-zero on a failed migration. Upstream's catch swallows the
  error, so `migration && server` boots on a partial schema. Drop this once upstream exits.
- `packages/server/src/services/logs-and-metrics/service.ts` - refuses a new endpoint that arrives
  without the stored credentials, which readers cannot see and a test would send to the new host.
  Drop this once upstream checks the endpoint.
- `packages/server/src/services/transfer.ts` - also refuses a compose project with a writable bind
  outside its `files` directory, read from Docker, because a compose file's binds are in no mount row.
  Drop this once upstream copies them.
- `apps/dokploy/__test__/logs-and-metrics/telemetry-provider-service.test.ts`,
  `apps/dokploy/__test__/wss/listen-deployment.test.ts` - add cases for the telemetry guards and the
  deployment log guard above. Keep them when taking upstream's versions of these tests.

Take upstream's changes to any of these deliberately rather than by default.

The two lists above are the whole set. `git diff --name-only HEAD <NEW> -- . ':(exclude)*/proprietary/*'`
after a sync prints these files, together with the ones this fork adds rather than edits: the
replacement modules named above, `UPSTREAM.md`, `NOTICE`, its migration under
`apps/dokploy/drizzle/`, `apps/dokploy/scripts/panel-version.mjs`,
`packages/server/src/services/social-auth.ts`, and its own tests under `apps/dokploy/__test__/`. Anything else it names is
a hunk the sync dropped or an undocumented divergence, and one of the two has to be fixed before the
sync is done.

After a sync, re-check that imports still resolve:

```sh
cd apps/dokploy && ./node_modules/.bin/tsc --noEmit
cd packages/server && ./node_modules/.bin/tsc --noEmit
```

If a sync adds an import from a `proprietary` path that nothing here provides, add the symbol to the
matching replacement module.

`pnpm build` rewrites `packages/server/package.json` to its `dist` exports and leaves it there. Run
`pnpm --filter=@dokploy/server run switch:dev` before committing, because the typecheck of
`apps/dokploy` needs the `src` exports upstream commits.

## Accepted risks

- A member with a service grant can get root on that service's host. Upstream's model lets them bind
  `/var/run/docker.sock` or any host path, and name any volume in a volume backup or restore, including
  `dokploy-postgres`. `mount.volumeName` has no pattern either. This fork keeps that model, so grant a
  service only to someone you would trust with its host.
- An organization admin acts on the whole panel. They can back up or restore the panel, replace the
  Google client, and enforce SSO if they are an owner. Enforcement covers every organization. Give
  admin only to people you would trust with the panel.
- A rogue SSO provider can accept another organization's invitation. Its admin asserts the invited
  address, better-auth creates the user, and accepting compares only the email. This needs a panel with
  several organizations and an untrusted organization admin.
- The SSO link rule runs when an account row is created, not at each sign-in. A provider keeps its
  sign-in for a user who later joins another organization or becomes an owner. Promote a user only if
  you trust the identity providers they have linked.
- An SSO account links on a provider's verified email claim, so a provider can sign in any new address
  it asserts. A provider stays limited by the link rule for existing users.
- A panel moved from a licensed upstream install posts stored licence keys and its public IP to
  `licenses-api.dokploy.com` every three days. `packages/server/src/utils/crons/enterprise.ts` runs on
  every start. Nothing in this fork writes a key.
- A member with `backup:read` can list every object name in a destination, because the listing names
  no service. Restoring still requires a file in the service's own folder.
- Members lose AI access in this release, because upstream gates it behind a permission static members
  do not hold. This fork has no override.
- The panel fetches templates from `templates.dokploy.com` by default when someone opens the template
  list. It sends no panel data, and an operator can set another base URL.
- OIDC registration fails for a provider whose token or userinfo endpoint is on a different origin from
  its issuer, which includes Google and Entra. `lib/sso-trusted-origins.ts` trusts only the issuer and
  discovery origins.

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
