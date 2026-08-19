/**
 * Where the running panel's own source lives. Upstream links its release notes and issue
 * tracker straight at Dokploy/dokploy, which on a fork sends the operator to release notes
 * that do not describe the build they are being offered, and bug reports to a project that
 * did not ship it.
 *
 * Client-side, so it cannot read the server's environment: `NEXT_PUBLIC_PANEL_REPO_URL` has to
 * be set at build time to change it, which is the same moment the image itself is chosen.
 */
export const PANEL_REPO_URL =
	process.env.NEXT_PUBLIC_PANEL_REPO_URL ||
	"https://github.com/akaike-byob/dokploy-oss";

/** Release notes for the versions the update dialog offers. */
export const panelReleasesUrl = `${PANEL_REPO_URL}/releases`;

/** Issue tracker for the build actually running. */
export const panelIssuesUrl = `${PANEL_REPO_URL}/issues`;
