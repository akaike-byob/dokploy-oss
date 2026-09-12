/**
 * Upstream puts whitelabeling (custom logos, colours, CSS, error pages) behind its
 * enterprise licence. This fork does not implement it and renders Dokploy's own branding.
 */
export interface Whitelabeling {
	enabled: false;
}

export interface PublicWhitelabelingConfig {
	appName: string | null;
	appDescription: string | null;
	ogImageUrl: string | null;
	faviconUrl: string | null;
	customCss: string | null;
}

export const getWhitelabeling = async (): Promise<Whitelabeling> => ({
	enabled: false,
});

export const getPublicWhitelabelingConfig =
	async (): Promise<PublicWhitelabelingConfig | null> => null;
