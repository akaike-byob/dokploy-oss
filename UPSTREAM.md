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
git diff <BASE>..<NEW> -- . ':(exclude)*/proprietary/*' > /tmp/upstream.patch
git apply --3way /tmp/upstream.patch
```

Resolve conflicts, then update the base commit recorded at the top of this file so the next sync
diffs from the right place.

## Push hygiene

This clone keeps upstream's objects locally so patches can be generated. Only `main` is safe to
publish. Push it by name and never with `--all` or `--mirror`, which would carry local branches that
do contain upstream history.

Before any push to a new remote, confirm no proprietary blob is reachable:

```sh
git rev-list --objects main | grep proprietary   # must print nothing
```

Upstream files that import from a proprietary path are replaced here by local implementations. When
a sync touches one of those files, re-check that its imports still resolve.

## Relationship to upstream

This is a modified fork, not affiliated with or endorsed by Dokploy Technology, Inc. Apache
License 2.0 §4(b) requires modified files to carry notice of the change; the modifications relative
to the base commit above are the record of that. "Dokploy" is upstream's name and is not claimed
here.
