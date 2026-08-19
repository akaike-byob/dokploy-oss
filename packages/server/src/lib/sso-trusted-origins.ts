/**
 * The SSO plugin refuses to fetch an OIDC discovery document unless the identity provider's
 * origin appears in better-auth's `trustedOrigins`. For the discovery URL specifically, being
 * publicly routable is not enough, so without an allowlist entry no external IdP can ever be
 * registered. Dokploy keeps trusted origins on the owner's user row and exposes no UI for the
 * field, which leaves a self-hosted panel with no supported way to configure one.
 *
 * Registering a provider is itself the act of trusting its issuer, so these origins are derived
 * from the providers that exist rather than kept as a second list to maintain: remove the
 * provider and its origin stops being trusted. They are granted only on `/sso` paths, because
 * `trustedOrigins` also drives the CORS and redirect checks on every other auth endpoint, where
 * an identity provider has no business being trusted.
 */

/** A provider's issuer and its serialized `oidcConfig`, as stored on the `sso_provider` row. */
export interface StoredProviderEndpoints {
	issuer: string;
	oidcConfig: string | null;
}

/** The origin of `url`, or null when it is absent or not a parseable absolute URL. */
export const originOf = (url: string | null | undefined): string | null => {
	if (!url) return null;
	try {
		return new URL(url).origin;
	} catch {
		return null;
	}
};

/** Deduplicated origins of `urls`, dropping every entry that has none. */
export const collectOrigins = (
	urls: (string | null | undefined)[],
): string[] => {
	const origins = new Set<string>();
	for (const url of urls) {
		const origin = originOf(url);
		if (origin) origins.add(origin);
	}
	return Array.from(origins);
};

/** The discovery endpoint recorded in a provider's serialized `oidcConfig`, if it has one. */
const discoveryEndpointOf = (oidcConfig: string | null): string | null => {
	if (!oidcConfig) return null;
	try {
		const parsed: unknown = JSON.parse(oidcConfig);
		if (typeof parsed !== "object" || parsed === null) return null;
		const endpoint = (parsed as { discoveryEndpoint?: unknown })
			.discoveryEndpoint;
		return typeof endpoint === "string" ? endpoint : null;
	} catch {
		return null;
	}
};

/** Origins of the issuers, and explicit discovery endpoints, of already registered providers. */
export const registeredIssuerOrigins = (
	providers: StoredProviderEndpoints[],
): string[] =>
	collectOrigins(
		providers.flatMap((provider) => [
			provider.issuer,
			discoveryEndpointOf(provider.oidcConfig),
		]),
	);

/**
 * Origins named by a `/sso/register` request body. The provider row does not exist yet while
 * that call is being served, so registration cannot be covered by
 * {@link registeredIssuerOrigins}.
 */
export const registrationOrigins = (body: unknown): string[] => {
	if (typeof body !== "object" || body === null) return [];
	const { issuer, oidcConfig } = body as {
		issuer?: unknown;
		oidcConfig?: { discoveryEndpoint?: unknown };
	};
	const discoveryEndpoint =
		typeof oidcConfig === "object" && oidcConfig !== null
			? oidcConfig.discoveryEndpoint
			: null;
	return collectOrigins([
		typeof issuer === "string" ? issuer : null,
		typeof discoveryEndpoint === "string" ? discoveryEndpoint : null,
	]);
};
