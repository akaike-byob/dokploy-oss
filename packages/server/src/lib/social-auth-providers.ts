import type { OAuthProvider } from "better-auth/oauth2";
import { github, google } from "better-auth/social-providers";
import {
	type SocialAuthProviderId,
	socialAuthProviderIds,
} from "../db/schema/social-auth";

export interface OAuthClientCredentials {
	clientId: string;
	clientSecret: string;
}

export type StoredSocialCredentials = Partial<
	Record<SocialAuthProviderId, OAuthClientCredentials>
>;

/**
 * better-auth resolves a social provider out of `context.socialProviders`, an array built once
 * from the options the instance was created with. Credentials registered from the panel land in
 * the database instead, so the provider has to be rebuilt with them before a handler looks it
 * up. These are the endpoints that do the lookup: `/sign-in/social` and `/link-social` start a
 * flow, `/callback/:id` finishes one, and the `/account/*` endpoints refresh or revoke a token.
 */
export const resolvesSocialProvider = (path: string | undefined): boolean =>
	Boolean(path) &&
	["/sign-in/social", "/link-social", "/callback/", "/account/"].some(
		(prefix) => path?.startsWith(prefix),
	);

const providerFactories: Record<
	SocialAuthProviderId,
	(credentials: OAuthClientCredentials) => OAuthProvider
> = {
	google: (credentials) => google(credentials),
	github: (credentials) => github(credentials),
};

export const isSocialAuthProviderId = (
	value: string,
): value is SocialAuthProviderId =>
	(socialAuthProviderIds as readonly string[]).includes(value);

/**
 * The provider list better-auth should serve this request with: every provider it was
 * configured with, plus the ones registered from the panel. Stored credentials win over the
 * environment, so a panel-registered client takes effect without a restart, and a provider
 * configured only in the database is added rather than ignored.
 */
export const withStoredCredentials = (
	configured: OAuthProvider[],
	stored: StoredSocialCredentials,
): OAuthProvider[] => {
	const overridden = Object.entries(stored).map(([providerId, credentials]) =>
		providerFactories[providerId as SocialAuthProviderId](credentials),
	);
	const overriddenIds = new Set(overridden.map((provider) => provider.id));
	return [
		...configured.filter((provider) => !overriddenIds.has(provider.id)),
		...overridden,
	];
};
