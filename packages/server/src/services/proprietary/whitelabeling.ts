/**
 * Upstream puts whitelabeling (custom logos, colours, CSS, error pages) behind its
 * enterprise licence. This fork does not implement it and renders Dokploy's own branding.
 */
export interface Whitelabeling {
	enabled: false;
}

export const getWhitelabeling = async (): Promise<Whitelabeling> => ({
	enabled: false,
});
