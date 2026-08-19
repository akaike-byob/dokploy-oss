# Replacement modules

Upstream Dokploy keeps its source-available (DSAL) enterprise code in directories named
`proprietary`. None of that code is in this repository: see `UPSTREAM.md`.

These files are original work for this fork, written to the import contract that the surrounding
Apache-2.0 code expects, so that upstream files import a working module without being edited. That
keeps the fork upgradable: `git diff` against upstream excludes `*/proprietary/*`, so upstream
patches never touch or conflict with anything here.

The directory name is upstream's module path, not a statement about these files. They carry no
DSAL code and no DSAL terms.

Contract implemented here:

| Symbol                  | Behaviour in this fork                                    |
| ----------------------- | --------------------------------------------------------- |
| `hasValidLicense`       | always true; this fork has no licensing tier               |
| `createAuditLog`        | real insert into the Apache-side `audit_log` table         |
| `getOrganizationOwnerId`| real lookup on the Apache-side `organization` table        |

If an upstream sync adds a new import from a `proprietary` path, add the symbol here.
