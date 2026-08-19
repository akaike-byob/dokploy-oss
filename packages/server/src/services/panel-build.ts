/**
 * Identity of the running panel build: which image it updates itself to, and which version it
 * believes it is.
 *
 * Upstream hardcodes `dokploy/dokploy` in its update path, so on a fork the "Update Available"
 * button would replace the running panel with upstream and silently undo the fork. Every place
 * that names the panel image reads it from here instead.
 *
 * The version comes from the environment rather than package.json because CI stamps a fresh
 * version into every build, and package.json is copied into the image before dependencies are
 * installed: writing to it there would invalidate the dependency layer on every single build.
 */
export const PANEL_IMAGE =
	process.env.PANEL_IMAGE || "ujjwalakaike/dokploy-oss";

/** Set on the image by CI. Falls back to the upstream base version for local runs. */
export const PANEL_VERSION =
	process.env.PANEL_VERSION || process.env.npm_package_version || "0.0.0-dev";

/** Docker Hub tag listing for PANEL_IMAGE, used to discover the latest published version. */
export const panelImageTagsUrl = () =>
	`https://hub.docker.com/v2/repositories/${PANEL_IMAGE}/tags`;

/**
 * Where this panel's source lives. Upstream points its release notes, issue tracker and email
 * artwork at Dokploy/dokploy, which on a fork describes a build the operator is not running.
 */
export const PANEL_REPO_URL =
	process.env.PANEL_REPO_URL || "https://github.com/akaike-byob/dokploy-oss";

/** Logo shown in notification emails, served from the repo the running build came from. */
export const panelLogoUrl = () =>
	`${PANEL_REPO_URL.replace("github.com", "raw.githubusercontent.com")}/refs/heads/main/apps/dokploy/logo.png`;
