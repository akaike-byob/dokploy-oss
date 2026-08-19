/**
 * The image this panel updates itself to.
 *
 * Upstream hardcodes `dokploy/dokploy` in its update path, so on a fork the "Update Available"
 * button would replace the running panel with upstream and silently undo the fork. Every place
 * that names the panel image reads it from here instead.
 *
 * Override with PANEL_IMAGE to track a different build.
 */
export const PANEL_IMAGE =
	process.env.PANEL_IMAGE || "ujjwalakaike/dokploy-oss";

/** Docker Hub tag listing for PANEL_IMAGE, used to discover the latest published version. */
export const panelImageTagsUrl = () =>
	`https://hub.docker.com/v2/repositories/${PANEL_IMAGE}/tags`;
